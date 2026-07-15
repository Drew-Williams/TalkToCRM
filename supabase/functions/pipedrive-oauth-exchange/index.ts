// See hubspot-oauth-exchange/index.ts for why this is a POST the extension
// calls with an auth code, not a GET redirect callback.
import { getCallerUser } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { pipedriveAdapter } from "../_shared/crm-pipedrive.ts";
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

    const { accountRef } = await exchangeAndStoreConnection(pipedriveAdapter, "pipedrive", user.id, code, redirectUri);
    return jsonResponse({ connected: true, provider: "pipedrive", accountRef });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[pipedrive-oauth-exchange]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
