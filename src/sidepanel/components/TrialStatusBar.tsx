import { useEffect, useRef } from "react";
import { useUpgradeCheckout } from "../hooks/useUpgradeCheckout";

interface TrialStatusBarProps {
  daysRemaining: number | null;
  /** Re-checks subscription_status — same polling pattern as PaywallView, so upgrading mid-trial is picked up automatically. */
  onRefresh: () => void;
}

const POLL_INTERVAL_MS = 5000;

/**
 * A simple, always-visible "N days left — Upgrade now" strip while trialing
 * — deliberately not dismissible (unlike LinkAccountBanner's soft nudge):
 * this is billing information the rep should always be able to see at a
 * glance, not a one-time tip. Renders nothing once the trial's expired
 * (PaywallView takes over entirely at that point) or once paid.
 */
export function TrialStatusBar({ daysRemaining, onRefresh }: TrialStatusBarProps) {
  const { startCheckout, pending, error, checkoutOpened } = useUpgradeCheckout();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!checkoutOpened) return;
    pollRef.current = window.setInterval(onRefresh, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [checkoutOpened, onRefresh]);

  if (daysRemaining === null || daysRemaining < 0) return null;

  const label = daysRemaining === 0 ? "Trial ends today" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in trial`;

  return (
    <div className="mb-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-2">
        <span className="text-xs font-medium text-slate-200">{label}</span>
        <button
          type="button"
          onClick={startCheckout}
          disabled={pending}
          className="shrink-0 text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline disabled:opacity-60"
        >
          {pending ? "Opening…" : "Upgrade now"}
        </button>
      </div>
      {checkoutOpened && <p className="text-[11px] text-muted-foreground">Complete checkout in the tab that just opened.</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
