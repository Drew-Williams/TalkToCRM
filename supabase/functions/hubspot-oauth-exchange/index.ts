// Called by the extension right after chrome.identity.launchWebAuthFlow
// resolves with a `code` — NOT a browser redirect callback. See
// mem/design/crm-oauth-v1.md for why: chrome.identity requires the OAuth
// redirect_uri to be the extension's own https://<id>.chromiumapp.org/ URL,
// which Chrome intercepts internally and never actually navigates to, so
// there's no browser request for a GET edge function to catch. The
// extension gets the auth `code` back from the resolved promise and POSTs it
// here (with the SAME redirect_uri, since HubSpot requires it to match the
// one used to obtain the code) to do the actual token exchange server-side.
import { getCallerUser } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { hubspotAdapter } from "../_shared/crm-hubspot.ts";
import { exchangeAndStoreConnection } from "../_shared/store-connection.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getCallerUser(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code, redirectUri } = await req.json();
    if (!code || !redirectUri) {
      return jsonResponse({ error: "code and redirectUri are required" }, { status: 400 });
    }

    const { accountRef } = await exchangeAndStoreConnection(hubspotAdapter, "hubspot", user.id, code, redirectUri);
    return jsonResponse({ connected: true, provider: "hubspot", accountRef });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[hubspot-oauth-exchange]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
