import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface SubscriptionState {
  /** Mirrors Stripe's own status values directly — see the subscriptions migration for why. */
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

/**
 * Reads from the subscription_status VIEW, never the base subscriptions
 * table — same pattern as useCrmConnections: the view excludes
 * stripe_customer_id/stripe_subscription_id, and only the stripe-webhook
 * edge function (service role) ever writes a row, using Stripe's own
 * webhook events as the source of truth. No row at all means "never
 * subscribed," not an error.
 */
export function useSubscription(signedIn: boolean) {
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!signedIn) {
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
  }, [signedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stripe's own status already reflects trial vs. paid vs. lapsed
  // accurately (it auto-transitions trialing -> active/past_due/unpaid once
  // the trial ends), so this is the full rule — no separate trial_end
  // comparison needed here.
  const isActive = subscription?.status === "trialing" || subscription?.status === "active";

  return { subscription, isActive, loading, refresh };
}
