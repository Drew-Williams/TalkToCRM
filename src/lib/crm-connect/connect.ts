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
// Pipedrive requires its one registered Callback URL to be a real, publicly
// reachable HTTPS endpoint — confirmed both by a Pipedrive team member on
// their own developer forum ("the callback url should be publicly
// accessible... so Pipedrive Marketplace team will be able to install and
// test the app") and independently here: a plain
// https://<extension-id>.chromiumapp.org/... URL doesn't even resolve over
// DNS (NXDOMAIN) — it's a Chrome-internal pseudo-domain
// chrome.identity.launchWebAuthFlow intercepts before any real network
// request happens, not something Pipedrive (or anyone) can actually reach.
// That's what was silently blocking "Send to review" this whole time, not
// a picky form validator as first suspected.
//
// pipedrive-oauth-redirect (a real Supabase edge function) is the fix: a
// genuinely live URL, registered as Pipedrive's Callback URL instead, whose
// only job on a GET is to 302-forward the code/state/error query params on
// to the extension's real chromiumapp.org URL. Chrome's launchWebAuthFlow
// watches every navigation in its flow window for a URL matching that
// pattern, however many redirect hops it took to get there (confirmed
// against Chromium's own WebAuthFlow source — IsValidRedirectUrl is a
// plain prefix check with no hop-count restriction), so this extra real
// hop is invisible below — the final responseUrl is still the
// chromiumapp.org one, exactly as before. It also gets us a real endpoint
// to receive Pipedrive's uninstall webhook on, which genuinely didn't
// exist until now (see mem/design/pipedrive-uninstall-v1.md).
//
// HubSpot has no such one-URL-only restriction (their dashboard accepts
// multiple registered redirect URLs), so it keeps using
// chrome.identity.getRedirectURL() directly — no proxy needed there.
const PIPEDRIVE_REDIRECT_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipedrive-oauth-redirect`;

export async function connectCrm(provider: CrmProvider): Promise<{ accountRef: string | null }> {
  // Must be registered as the app's redirect/callback URL in the matching
  // developer dashboard — see the module comment above for why Pipedrive
  // specifically needs a real proxy URL, not chrome.identity.getRedirectURL()
  // directly.
  const redirectUri = provider === "pipedrive" ? PIPEDRIVE_REDIRECT_PROXY : chrome.identity.getRedirectURL(`${provider}-oauth-callback`);
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
