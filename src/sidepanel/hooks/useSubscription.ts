import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export interface SubscriptionState {
  /** Mirrors Stripe's own status values directly — see the subscriptions migration for why. */
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

const NUDGE_WINDOW_DAYS = 2;

/**
 * Reads from the subscription_status VIEW, never the base subscriptions
 * table — same pattern as useCrmConnections: the view excludes
 * stripe_customer_id/stripe_subscription_id, and only the stripe-webhook
 * edge function (service role) or the handle_new_user_trial trigger ever
 * write a row. `session` (not just "is signed in") is needed here, not just
 * for the query gate: `shouldNudge` also depends on whether the *current*
 * user is still anonymous, which only the session's JWT tells us.
 */
export function useSubscription(session: Session | null) {
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("subscription_status").select("status, trial_end, current_period_end").maybeSingle();
    if (!error && data) {
      setSubscription({ status: data.status, trialEnd: data.trial_end, currentPeriodEnd: data.current_period_end });
    } else {
      setSubscription(null);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stripe's own status already reflects trial vs. paid vs. lapsed
  // accurately (it auto-transitions trialing -> active/past_due/unpaid once
  // the trial ends), so this is the full rule — no separate trial_end
  // comparison needed for *this* check (trial_end is still used below, for
  // the nudge timing and the "N days left" display).
  const isActive = subscription?.status === "trialing" || subscription?.status === "active";

  const daysRemaining =
    subscription?.trialEnd != null ? Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;

  // Only worth nudging an anonymous rep who hasn't linked an email yet —
  // once they have, there's a real account to "save," so the banner would
  // just be noise. Still trialing (not already expired) and within the
  // last couple of days is the "day 5 of 7" moment from the funnel design.
  const shouldNudge =
    !!session?.user.is_anonymous &&
    subscription?.status === "trialing" &&
    daysRemaining !== null &&
    daysRemaining > 0 &&
    daysRemaining <= NUDGE_WINDOW_DAYS;

  return { subscription, isActive, daysRemaining, shouldNudge, loading, refresh };
}
