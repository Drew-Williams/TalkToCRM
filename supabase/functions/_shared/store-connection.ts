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
        provider_company_id: result.providerCompanyId,
        provider_user_id: result.providerUserId,
      },
      { onConflict: "user_id,provider" },
    );

  if (error) {
    throw new Error(`Failed to store ${provider} connection: ${error.message}`);
  }

  // Best-effort personalization: fills in the rep's display name from
  // whichever CRM they just connected, but only if their profile doesn't
  // already have one (ensure_profile_name never overwrites an existing
  // name) — connecting a *second* CRM later shouldn't clobber whatever
  // name is already set. A failure here is never worth failing the
  // connection itself over.
  if (result.ownerName) {
    const { error: nameError } = await admin.rpc("ensure_profile_name", { p_user_id: userId, p_display_name: result.ownerName });
    if (nameError) {
      console.error(`[store-connection] failed to backfill profile name from ${provider}:`, nameError.message);
    }
  }

  // Same best-effort pattern for a contact email — a separate concept
  // from the rep explicitly linking a recovery email to their Corner
  // account (LinkAccountBanner). Exists so support/ops
  // (ops_trial_watchlist, ops-dashboard.html) has a real way to reach a
  // rep who's connected a CRM but never linked an email — most trial
  // accounts, since the reverse-trial funnel never asks for one upfront.
  if (result.ownerEmail) {
    const { error: emailError } = await admin.rpc("ensure_profile_email", { p_user_id: userId, p_contact_email: result.ownerEmail });
    if (emailError) {
      console.error(`[store-connection] failed to backfill contact email from ${provider}:`, emailError.message);
    }
  }

  return { accountRef: result.accountRef };
}
