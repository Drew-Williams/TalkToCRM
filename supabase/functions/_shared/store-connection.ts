import { serviceRoleClient } from "./auth.ts";
import type { CrmAdapter } from "./deal-snapshot.ts";

/**
 * Shared body for both OAuth exchange functions: resolve the code to tokens
 * via the given adapter, then upsert into crm_connections keyed by
 * (user_id, provider). Never returns the tokens to the caller — only enough
 * for the side panel to render "Connected as {accountRef}".
 */
export async function exchangeAndStoreConnection(
  adapter: CrmAdapter,
  provider: "hubspot" | "pipedrive",
  userId: string,
  code: string,
  redirectUri: string,
): Promise<{ accountRef: string | null }> {
  const result = await adapter.exchangeCode(code, redirectUri);

  const admin = serviceRoleClient();
  const { error } = await admin
    .from("crm_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        token_expires_at: result.expiresAt,
        account_ref: result.accountRef,
        api_base: result.apiBase,
        scopes: result.scopes,
      },
      { onConflict: "user_id,provider" },
    );

  if (error) {
    throw new Error(`Failed to store ${provider} connection: ${error.message}`);
  }

  return { accountRef: result.accountRef };
}
