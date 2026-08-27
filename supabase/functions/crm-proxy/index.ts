// The one edge function ElevenLabs client tools (and the side panel) call to
// read a deal. It picks the right adapter, transparently refreshes the
// access token when needed, and always returns the same DealSnapshot shape
// regardless of provider — see supabase/functions/_shared/deal-snapshot.ts.
// Read-only in step 2; push_to_crm (writes) comes later and will live in
// this same function behind a separate action.
import { getCallerUser, serviceRoleClient } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { hubspotAdapter } from "../_shared/crm-hubspot.ts";
import { pipedriveAdapter } from "../_shared/crm-pipedrive.ts";
import type { CrmAdapter } from "../_shared/deal-snapshot.ts";
import { CrmAuthRevokedError } from "../_shared/crm-errors.ts";

const ADAPTERS: Record<"hubspot" | "pipedrive", CrmAdapter> = {
  hubspot: hubspotAdapter,
  pipedrive: pipedriveAdapter,
};

// How many activities (calls, meetings, notes, emails combined) the coach
// can see for a deal. This used to be 5, which was fine for a brand-new
// deal but silently dropped most of a deal's real history the moment it
// had more than 5 touchpoints total — e.g. a deal with months of email
// back-and-forth would only ever show its last handful of meetings, with
// the agent unable to answer questions about anything older. 40 comfortably
// covers deals with a long history while staying well under what a single
// LLM tool-call response should carry.
const RECENT_ACTIVITIES_LIMIT = 40;

interface ConnectionRow {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  api_base: string | null;
}

async function getFreshAccessToken(
  adapter: CrmAdapter,
  connection: ConnectionRow,
): Promise<{ accessToken: string; apiBase: string | null }> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  const needsRefresh = expiresAt !== null && Date.now() > expiresAt - 5 * 60 * 1000;

  if (!needsRefresh || !connection.refresh_token) {
    return { accessToken: connection.access_token, apiBase: connection.api_base };
  }

  const refreshed = await adapter.refreshAccessToken(connection.refresh_token);
  if (!refreshed) {
    return { accessToken: connection.access_token, apiBase: connection.api_base };
  }

  const admin = serviceRoleClient();
  await admin
    .from("crm_connections")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      token_expires_at: refreshed.expiresAt,
      api_base: refreshed.apiBase ?? connection.api_base,
    })
    .eq("id", connection.id);

  return { accessToken: refreshed.accessToken, apiBase: refreshed.apiBase ?? connection.api_base };
}

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
    const { provider, dealId, action } = await req.json();
    if (provider !== "hubspot" && provider !== "pipedrive") {
      return jsonResponse({ error: "provider must be 'hubspot' or 'pipedrive'" }, { status: 400 });
    }
    if (!dealId || typeof dealId !== "string") {
      return jsonResponse({ error: "dealId is required" }, { status: 400 });
    }
    // "get_recent_activities" backs the client tool of the same name already
    // configured on the ElevenLabs agent. push_to_crm (writes) still has no
    // action here — that's step 4/5.
    if (action && action !== "get_deal" && action !== "get_recent_activities") {
      return jsonResponse({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const admin = serviceRoleClient();
    const { data: connection, error: connectionError } = await admin
      .from("crm_connections")
      .select("id, access_token, refresh_token, token_expires_at, api_base")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();

    if (connectionError) {
      console.error("[crm-proxy] connection lookup failed:", connectionError.message);
      return jsonResponse({ error: "Failed to look up CRM connection" }, { status: 500 });
    }
    if (!connection) {
      return jsonResponse({ error: `No ${provider} connection for this account. Connect it in the side panel first.` }, { status: 409 });
    }

    const adapter = ADAPTERS[provider as "hubspot" | "pipedrive"];

    try {
      const { accessToken, apiBase } = await getFreshAccessToken(adapter, connection as ConnectionRow);

      if (action === "get_recent_activities") {
        const activities = await adapter.getRecentActivities(accessToken, dealId, apiBase, RECENT_ACTIVITIES_LIMIT);
        return jsonResponse({ activities });
      }

      const snapshot = await adapter.getDeal(accessToken, dealId, apiBase);
      return jsonResponse({ deal: snapshot });
    } catch (e) {
      // A 401 from the CRM almost always means this connection is dead —
      // most commonly, the rep (or an admin) disconnected/uninstalled on
      // the CRM's side, which Corner has no reliable way to be told about
      // directly (see crm-errors.ts's comment on why a real uninstall
      // webhook isn't reachable for this app). Clearing the stored row
      // here, reactively, the next time it's actually used, is the
      // fallback: the side panel already knows how to render "not
      // connected" and route back through the Connect step, the same as
      // if the rep had never connected at all.
      if (e instanceof CrmAuthRevokedError) {
        await admin.from("crm_connections").delete().eq("id", (connection as ConnectionRow).id);
        return jsonResponse(
          { error: `Your ${provider} connection was disconnected or revoked. Reconnect it in the side panel.`, code: "connection_revoked" },
          { status: 409 },
        );
      }
      throw e;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[crm-proxy]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
