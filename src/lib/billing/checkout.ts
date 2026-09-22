import { supabase } from "@/lib/supabase/client";

/**
 * Starts the day-7 paywall's Stripe Checkout, authenticated as whichever
 * account (anonymous or permanent) is hitting the paywall — stripe-create-
 * checkout-session passes this session's user id through as Stripe's
 * client_reference_id, which is what lets stripe-webhook attach the paid
 * subscription to *this* account (and, if still anonymous, the email
 * Stripe itself collects during checkout) rather than creating a
 * disconnected new one.
 */
export async function fetchCheckoutUrl(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("You're signed out — reopen the side panel and try again.");
  }

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    // Stripe Checkout is a full hosted page (can't be iframed — most
    // payment processors block that for security), so it always opens in
    // a new browser tab, never inside the side panel itself. There's no
    // {CHECKOUT_SESSION_ID} query-string dance to do on return the way the
    // marketing site's version needed: PaywallView just polls
    // useSubscription's refresh() while this tab is open and picks up the
    // webhook-driven status change on its own.
    body: JSON.stringify({
      successUrl: `${import.meta.env.VITE_MARKETING_SITE_URL}/welcome`,
      cancelUrl: `${import.meta.env.VITE_MARKETING_SITE_URL}/pricing`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || "Failed to start checkout.");
  }
  return body.checkoutUrl as string;
}
