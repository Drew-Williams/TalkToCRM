import { useEffect, useRef, useState } from "react";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { ExtensionMessage } from "@/lib/chrome/messaging";

interface ActiveDealState {
  deal: DetectedDeal | null;
  loading: boolean;
}

/**
 * Tracks the detected deal for whichever tab is active in this side panel's
 * window. Pulls the current state on mount/tab-switch and stays live via the
 * background worker's ACTIVE_DEAL_UPDATED broadcasts in between.
 */
export function useActiveDeal(): ActiveDealState {
  const [deal, setDeal] = useState<DetectedDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTabIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      const request: ExtensionMessage = { type: "GET_ACTIVE_DEAL" };
      const response = (await chrome.runtime.sendMessage(request).catch(() => undefined)) as
        | Extract<ExtensionMessage, { type: "ACTIVE_DEAL_RESULT" }>
        | undefined;
      if (cancelled) return;
      activeTabIdRef.current = response?.tabId ?? null;
      setDeal(response?.deal ?? null);
      setLoading(false);
    }

    refresh();

    function onMessage(message: ExtensionMessage) {
      if (message.type === "ACTIVE_DEAL_UPDATED" && message.tabId === activeTabIdRef.current) {
        setDeal(message.deal);
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);

    // Rep switched to a different tab in this window — re-resolve which
    // deal (if any) that tab is on. In-tab SPA navigation to a different
    // deal is already covered by ACTIVE_DEAL_UPDATED above.
    function onTabActivated() {
      refresh();
    }
    chrome.tabs.onActivated.addListener(onTabActivated);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(onTabActivated);
    };
  }, []);

  return { deal, loading };
}
