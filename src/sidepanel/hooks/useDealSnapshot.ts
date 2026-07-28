import { useEffect, useRef, useState } from "react";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { DealSnapshot } from "@/lib/crm-proxy/types";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";

interface DealSnapshotState {
  snapshot: DealSnapshot | null;
  loading: boolean;
}

/**
 * Fetches name/amount/stage for the compact deal card via crm-proxy.
 * Refetches only when the detected deal's identity actually changes
 * (provider+dealId) — useActiveDeal can re-resolve to the *same* deal on
 * transient tab-focus blips, and this shouldn't fire a redundant CRM call
 * (or flash back to a loading state) each time that happens.
 */
export function useDealSnapshot(deal: DetectedDeal | null): DealSnapshotState {
  const [state, setState] = useState<DealSnapshotState>({ snapshot: null, loading: false });
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deal) {
      lastKeyRef.current = null;
      setState({ snapshot: null, loading: false });
      return;
    }

    const key = `${deal.provider}:${deal.dealId}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    let cancelled = false;
    setState({ snapshot: null, loading: true });
    fetchDealSnapshot(deal).then((result) => {
      if (cancelled) return;
      setState({ snapshot: "snapshot" in result ? result.snapshot : null, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [deal]);

  return state;
}
