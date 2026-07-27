import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchCheckoutUrl } from "@/lib/billing/checkout";
import type { SubscriptionState } from "../hooks/useSubscription";

interface PaywallViewProps {
  subscription: SubscriptionState | null;
  /** Re-checks subscription_status — called on click and polled while a checkout tab may be open, so a completed payment is picked up without the rep needing to do anything back in the side panel. */
  onRefresh: () => void;
}

const POLL_INTERVAL_MS = 5000;

// Shown once the reverse trial's 7 free days are up (or a paid subscription
// has lapsed) — the hard stop in "7 days of Pro on the house, $19/month
// after." subscription is null for two different reasons that read the
// same way to a rep: the trigger's initial trialing row somehow never
// existed, or (far more likely) it existed and has since lapsed long enough
// ago it's not worth distinguishing in this copy. Either way, the fix is
// the same button.
export function PaywallView({ subscription, onRefresh }: PaywallViewProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!checkoutOpened) return;
    // Polling, not a Realtime subscription: this is a short-lived, one-time
    // wait for a single webhook-driven row update, not an ongoing live
    // feed — not worth a persistent Realtime channel for that.
    pollRef.current = window.setInterval(onRefresh, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [checkoutOpened, onRefresh]);

  async function handleUpgrade() {
    setPending(true);
    setError(null);
    try {
      const checkoutUrl = await fetchCheckoutUrl();
      // Stripe Checkout is a full hosted page — it can't be embedded in the
      // side panel (payment processors block iframing that for security),
      // so it always opens in a real browser tab.
      await chrome.tabs.create({ url: checkoutUrl });
      setCheckoutOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout.");
    } finally {
      setPending(false);
    }
  }

  const everSubscribed = subscription !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{everSubscribed ? "Your free trial has ended" : "Upgrade to keep using Corner"}</CardTitle>
        <CardDescription>
          {everSubscribed
            ? "Your 7 free days are up. Upgrade to Corner Pro to keep talking through your deals."
            : "Corner isn't active on this account. Upgrade to Corner Pro to keep going."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={handleUpgrade} disabled={pending}>
          {pending ? "Opening checkout…" : "Upgrade to Pro — $19/month"}
        </Button>
        {checkoutOpened && (
          <p className="text-sm text-muted-foreground">
            Complete checkout in the tab that just opened — this updates automatically once you're done, no need to come back
            and refresh.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
