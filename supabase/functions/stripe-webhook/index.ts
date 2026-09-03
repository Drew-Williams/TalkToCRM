// Stripe is the only source of truth for "did they actually pay" — this is
// the one function that's allowed to create subscriptions rows or accounts;
// nothing else in the app ever does. Also the one function in this project
// with no getCallerUser check, deliberately: Stripe calls this directly,
// there's no Supabase session to check, and it authenticates itself via the
// webhook signature instead (verifyStripeSignature below).
import { verifyStripeSignature } from "../_shared/stripe-webhook-verify.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { serviceRoleClient } from "../_shared/auth.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// Stripe delivers checkout.session.completed at-least-once, and any rep
// checking out again after a prior canceled/expired subscription should
// land on their existing account, not a duplicate — so this always checks
// before creating.
async function findOrCreateUserByEmail(email: string): Promise<string> {
  const lookupRes = await adminFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
  if (lookupRes.ok) {
    const { users } = await lookupRes.json();
    if (users?.[0]?.id) return users[0].id;
  }

  const createRes = await adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create user for ${email}: ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  return created.id;
}

async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}) {
  const admin = serviceRoleClient();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      status: params.status,
      trial_end: params.trialEnd,
      current_period_end: params.currentPeriodEnd,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to upsert subscription: ${error.message}`);
}

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");
  const isValid = await verifyStripeSignature(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("[stripe-webhook] signature verification failed");
    return jsonResponse({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          customer: string;
          subscription: string | null;
          client_reference_id?: string | null;
          customer_details?: { email?: string };
          metadata?: { signup_email?: string };
        };
        const email = session.customer_details?.email ?? session.metadata?.signup_email;

        // client_reference_id is the caller's existing user id, set by
        // stripe-create-checkout-session for every checkout this project
        // creates post-reverse-trial-pivot — the rep already has an
        // account (anonymous or permanent) by the time they reach the
        // day-7 paywall, so this attaches payment to *that* account
        // instead of finding/creating one by email. The email fallback
        // below only matters for a checkout session created some other
        // way (e.g. manually in the Stripe Dashboard) with no
        // client_reference_id at all.
        let userId = session.client_reference_id ?? null;
        if (!userId) {
          if (!email) {
            console.error("[stripe-webhook] checkout.session.completed with no client_reference_id or email; skipping");
            break;
          }
          userId = await findOrCreateUserByEmail(email);
        } else if (email) {
          // Backfill the email Stripe collected onto this account if it's
          // still anonymous (skipped the day-5 LinkAccountBanner nudge) —
          // makes the account recoverable/findable by email going forward.
          // Best-effort: a failure here shouldn't block recording the
          // payment itself.
          await adminFetch(`/auth/v1/admin/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify({ email, email_confirm: true }),
          }).catch((e) => console.error("[stripe-webhook] failed to backfill email onto anonymous user:", e));
        }

        // The subscription's own trial_end/current_period_end are more
        // authoritative than anything on the checkout session, but a
        // customer.subscription.updated event for this same subscription
        // typically follows right behind this one anyway and will correct
        // these fields — active/null here is just a reasonable initial
        // state, not the final word. Status is 'active', not 'trialing':
        // the 7 free days already happened before this checkout, no
        // second Stripe-side trial is layered on top.
        await upsertSubscription({
          userId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: "active",
          trialEnd: null,
          currentPeriodEnd: null,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as {
          id: string;
          customer: string;
          status: string;
          trial_end: number | null;
          current_period_end: number | null;
        };
        const userId = await findUserIdByStripeCustomerId(subscription.customer);
        if (!userId) break;
        await upsertSubscription({
          userId,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          trialEnd: unixToIso(subscription.trial_end),
          currentPeriodEnd: unixToIso(subscription.current_period_end),
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as { id: string; customer: string };
        const admin = serviceRoleClient();
        const { error } = await admin.from("subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", subscription.id);
        if (error) throw new Error(`Failed to mark subscription canceled: ${error.message}`);
        break;
      }

      default:
        // Not every Stripe event type is relevant here — unhandled ones are
        // intentionally a no-op, not an error.
        break;
    }

    return jsonResponse({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[stripe-webhook]", message);
    // Non-2xx tells Stripe to retry — appropriate here, since these are our
    // own transient failures (a DB write failing), not "this event will
    // never be processable."
    return jsonResponse({ error: message }, { status: 500 });
  }
});

// customer.subscription.* events only carry the Stripe customer id, not the
// Supabase user id — looks it up by whichever subscriptions row already
// recorded that stripe_customer_id (written by checkout.session.completed).
// subscription.created for a given customer should always follow checkout.
// session.completed for the same checkout, not race ahead of it, since both
// are emitted from the same Stripe API call — but if this ever fires first,
// returning null (skip) is the safe choice over guessing.
async function findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const admin = serviceRoleClient();
  const { data, error } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
  if (error) {
    console.error("[stripe-webhook] customer lookup failed:", error.message);
    return null;
  }
  return data?.user_id ?? null;
}
