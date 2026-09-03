import { useCallback, useEffect, useRef, useState } from "react";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { DealSnapshot } from "@/lib/crm-proxy/types";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";

interface DealSnapshotState {
  snapshot: DealSnapshot | null;
  loading: boolean;
  /** "connection_revoked" specifically means the CRM connection needs reconnecting — see crm-proxy/index.ts. */
  errorCode?: string;
}

/**
 * Fetches name/amount/stage for the compact deal card via crm-proxy.
 * Refetches only when the detected deal's identity actually changes
 * (provider+dealId) — useActiveDeal can re-resolve to the *same* deal on
 * transient tab-focus blips, and this shouldn't fire a redundant CRM call
 * (or flash back to a loading state) each time that happens. `refresh()`
 * bypasses that dedupe deliberately — used after reconnecting a revoked
 * connection, where the deal identity hasn't changed but the fetch needs
 * to run again anyway.
 */
export function useDealSnapshot(deal: DetectedDeal | null): DealSnapshotState & { refresh: () => void } {
  const [state, setState] = useState<DealSnapshotState>({ snapshot: null, loading: false });
  const lastKeyRef = useRef<string | null>(null);
  const dealRef = useRef(deal);
  dealRef.current = deal;

  const load = useCallback((currentDeal: DetectedDeal) => {
    let cancelled = false;
    setState({ snapshot: null, loading: true });
    fetchDealSnapshot(currentDeal).then((result) => {
      if (cancelled) return;
      setState({
        snapshot: "snapshot" in result ? result.snapshot : null,
        loading: false,
        errorCode: "code" in result ? result.code : undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deal) {
      lastKeyRef.current = null;
      setState({ snapshot: null, loading: false });
      return;
    }

    const key = `${deal.provider}:${deal.dealId}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    return load(deal);
  }, [deal, load]);

  const refresh = useCallback(() => {
    if (dealRef.current) load(dealRef.current);
  }, [load]);

  return { ...state, refresh };
}
