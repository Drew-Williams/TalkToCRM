// Called from the marketing site (Lovable), *before* the visitor has a
// Corner account — there's no Supabase session to check here, unlike every
// other function in this project. Creates a Stripe Checkout Session for the
// 7-day-trial subscription and hands back its URL for the site to redirect
// to. The actual account creation happens later, in stripe-webhook, once
// Stripe confirms checkout.session.completed — never here, since a rep
// closing the tab mid-checkout shouldn't leave behind a half-created
// account with no paid trial attached.
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { email, successUrl, cancelUrl } = await req.json();
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email is required" }, { status: 400 });
    }
    if (!successUrl || !cancelUrl || typeof successUrl !== "string" || typeof cancelUrl !== "string") {
      return jsonResponse({ error: "successUrl and cancelUrl are required" }, { status: 400 });
    }

    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      customer_email: email,
      "subscription_data[trial_period_days]": "7",
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Comes back on checkout.session.completed so stripe-webhook can find
      // the right email even if the visitor edits it inside Stripe's own
      // checkout form (customer_email only pre-fills the field).
      "metadata[signup_email]": email,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
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
