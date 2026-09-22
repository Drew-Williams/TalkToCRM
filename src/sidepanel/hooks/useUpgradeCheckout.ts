import { useState } from "react";
import { fetchCheckoutUrl } from "@/lib/billing/checkout";

/**
 * Shared by PaywallView (the hard day-7 stop) and TrialStatusBar (the
 * "upgrade now" option visible throughout the trial) — both just need to
 * open Stripe Checkout in a real tab and know whether that succeeded.
 * Polling for the resulting subscription update is each caller's own
 * concern (via useSubscription's refresh), not this hook's.
 */
export function useUpgradeCheckout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpened, setCheckoutOpened] = useState(false);

  async function startCheckout() {
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

  return { startCheckout, pending, error, checkoutOpened };
}
