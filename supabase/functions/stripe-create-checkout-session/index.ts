// Reverse-trial pivot: there's no landing-page checkout anymore (Lovable's
// funnel goes straight to the Chrome Web Store, no email/card upfront) —
// this is now only ever called from *inside* the extension, at the day-7
// paywall, by an already-authenticated user (anonymous or permanent; the
// reverse trial itself is tracked entirely by the handle_new_user_trial
// trigger, not by anything Stripe-related). Requiring auth here, unlike the
// very first version of this function, is what lets client_reference_id
// carry the caller's existing user id through to stripe-webhook — so a
// still-anonymous rep who never linked an email during the trial (skipped
// the LinkAccountBanner nudge) still gets their payment attached to the
// *same* account they were already using, not a disconnected new one.
import { getCallerUser } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";

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
    const { successUrl, cancelUrl } = await req.json();
    if (!successUrl || !cancelUrl || typeof successUrl !== "string" || typeof cancelUrl !== "string") {
      return jsonResponse({ error: "successUrl and cancelUrl are required" }, { status: 400 });
    }

    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      // The one thing stripe-webhook actually needs to attach this payment
      // to the right account. No trial_period_days here — the 7 free days
      // already happened before the rep ever reached this paywall.
      client_reference_id: user.id,
    };
    // If this account already has a linked email (either it was never
    // anonymous, or the rep accepted the day-5 nudge), pre-fill Stripe's
    // checkout form with it rather than asking again. Still-anonymous
    // accounts leave this unset — Stripe collects an email as a normal
    // part of payment either way, and stripe-webhook backfills it onto
    // this same account from the completed session.
    if (user.email) params.customer_email = user.email;

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[stripe-create-checkout-session] Stripe API error:", res.status, detail);
      return jsonResponse({ error: "Failed to create checkout session" }, { status: 502 });
    }
    const session = await res.json();
    return jsonResponse({ checkoutUrl: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[stripe-create-checkout-session]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
