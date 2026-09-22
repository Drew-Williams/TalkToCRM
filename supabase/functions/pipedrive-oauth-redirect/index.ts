// The fix for Pipedrive Marketplace's actual submission blocker: Pipedrive
// requires the app's one registered Callback URL to be a real, publicly
// reachable HTTPS endpoint — "so Pipedrive Marketplace team will be able
// to install and test the app during the review process" (confirmed by a
// Pipedrive team member on their own developer forum, and independently by
// us: `https://<extension-id>.chromiumapp.org/...` does not even resolve
// over DNS — NXDOMAIN. It's a Chrome-internal pseudo-domain that
// chrome.identity.launchWebAuthFlow intercepts before any real network
// request happens; nobody, including Pipedrive, can ever actually reach it.
//
// This function is registered as that one real Callback URL instead. It
// has two jobs, matching the two things Pipedrive sends to whatever URL is
// registered there (see mem/design/pipedrive-uninstall-v1.md, written
// before this fix existed, for the fuller history of why a real endpoint
// wasn't in place until now):
//
// 1. GET — the live OAuth authorization redirect (Pipedrive sending back
//    `code`/`state`/`error` after the user approves or declines). This
//    function just forwards those query params onward via a 302 to the
//    extension's real chromiumapp.org URL. Chrome's launchWebAuthFlow
//    watches every navigation in its flow window for a URL matching
//    `https://<extension-id>.chromiumapp.org/*`, however many redirects
//    it took to get there — confirmed directly against Chromium's own
//    WebAuthFlow source (web_auth_flow.cc's IsValidRedirectUrl is a plain
//    prefix check with no restriction on hop count) — so this extra real
//    hop is invisible to the extension's own connectCrm() code, which
//    still just gets the final chromiumapp.org URL back as before.
// 2. DELETE — the uninstall webhook, authenticated via HTTP Basic Auth
//    with PIPEDRIVE_CLIENT_ID:PIPEDRIVE_CLIENT_SECRET. This is genuinely
//    new capability, not just a workaround — there was no real server
//    behind the Callback URL before this, so Corner could never receive
//    this webhook at all (the reactive 401-triggered cleanup in
//    crm-proxy/index.ts was the only fallback). Best-effort: revokes the
//    refresh token with Pipedrive and deletes the matching crm_connections
//    row, but a failure here doesn't need to be surfaced anywhere — the
//    reactive fallback still covers it if this doesn't run for any reason.
import { serviceRoleClient } from "../_shared/auth.ts";

const PIPEDRIVE_CLIENT_ID = Deno.env.get("PIPEDRIVE_CLIENT_ID") ?? "";
const PIPEDRIVE_CLIENT_SECRET = Deno.env.get("PIPEDRIVE_CLIENT_SECRET") ?? "";
// The extension's real, published Chrome Web Store ID (distinct from the
// pinned local/unpacked dev ID — see README.md's "pinned extension ID"
// section) plus the path segment connect.ts's chrome.identity.getRedirectURL
// call uses for Pipedrive specifically. An env var, not hardcoded, so a
// future republish under a different ID/path is a config change, not a
// redeploy.
const REDIRECT_TARGET =
  Deno.env.get("PIPEDRIVE_REDIRECT_TARGET") ?? "https://dpadpffnlgkbpakbfnnjnegdolfgfeio.chromiumapp.org/pipedrive-oauth-callback";

function verifyBasicAuth(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const expected = `Basic ${btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)}`;
  return header === expected;
}

async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch("https://oauth.pipedrive.com/oauth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }),
    });
  } catch (e) {
    console.error("[pipedrive-oauth-redirect] token revocation failed (non-fatal):", e);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const target = new URL(REDIRECT_TARGET);
    for (const [key, value] of url.searchParams) {
      target.searchParams.set(key, value);
    }
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  }

  if (req.method === "DELETE") {
    if (!verifyBasicAuth(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const body = await req.json();
      const companyId = body?.company_id != null ? String(body.company_id) : null;
      const userId = body?.user_id != null ? String(body.user_id) : null;
      if (companyId && userId) {
        const admin = serviceRoleClient();
        const { data: connections } = await admin
          .from("crm_connections")
          .select("id, refresh_token")
          .eq("provider", "pipedrive")
          .eq("provider_company_id", companyId)
          .eq("provider_user_id", userId);
        for (const connection of connections ?? []) {
          if (connection.refresh_token) await revokeRefreshToken(connection.refresh_token);
          await admin.from("crm_connections").delete().eq("id", connection.id);
        }
      }
    } catch (e) {
      // Response body/status here isn't read or processed by Pipedrive
      // (per their own uninstall docs) — log and move on, the reactive
      // 401-triggered cleanup in crm-proxy still covers this account
      // either way the next time it's used.
      console.error("[pipedrive-oauth-redirect] uninstall webhook handling failed (non-fatal):", e);
    }
    return new Response(null, { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
