import { supabase } from "@/lib/supabase/client";
import type { CrmProvider } from "@/lib/deal-detection/types";
import { buildHubspotAuthUrl } from "./hubspot";
import { buildPipedriveAuthUrl } from "./pipedrive";

const EXCHANGE_ENDPOINT: Record<CrmProvider, string> = {
  hubspot: "hubspot-oauth-exchange",
  pipedrive: "pipedrive-oauth-exchange",
};

const AUTH_URL_BUILDERS: Record<CrmProvider, (redirectUri: string) => string> = {
  hubspot: buildHubspotAuthUrl,
  pipedrive: buildPipedriveAuthUrl,
};

/**
 * Runs the full connect flow for a provider: opens the CRM's OAuth consent
 * screen via chrome.identity (no popup window of our own, no page redirect
 * we have to catch), gets the resulting auth code back directly, then POSTs
 * it to the matching *-oauth-exchange edge function to do the actual token
 * exchange server-side. Throws with a message safe to show the rep.
 */
export async function connectCrm(provider: CrmProvider): Promise<{ accountRef: string | null }> {
  // Stable per-installation URL like https://<extension-id>.chromiumapp.org/
  // — this is what must be registered as the app's redirect URI in the
  // HubSpot/Pipedrive developer dashboard.
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = AUTH_URL_BUILDERS[provider](redirectUri);

  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!responseUrl) {
    throw new Error("Sign-in was cancelled.");
  }

  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) {
    const errorParam = new URL(responseUrl).searchParams.get("error");
    throw new Error(errorParam ? `${provider} declined: ${errorParam}` : `${provider} did not return an authorization code.`);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("You're signed out — sign in again and retry connecting.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/${EXCHANGE_ENDPOINT[provider]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ code, redirectUri }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to connect ${provider}.`);
  }
  return { accountRef: body?.accountRef ?? null };
}
