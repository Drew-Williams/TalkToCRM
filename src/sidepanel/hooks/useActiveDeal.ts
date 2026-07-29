import { useEffect, useRef, useState } from "react";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { ExtensionMessage } from "@/lib/chrome/messaging";

interface ActiveDealState {
  deal: DetectedDeal | null;
  loading: boolean;
}

// Longer retry chain for the initial resolve only (~2s worst case) — that's
// the one genuinely at risk of a cold-start race (background worker waking
// up, or a just-installed/just-navigated content script not answering
// background's pull yet). A tab the rep switches *to* has normally been
// sitting loaded for a while already, so a couple of quick retries is
// plenty there without making every tab switch feel sluggish.
const INITIAL_RETRY_DELAYS_MS = [250, 400, 600, 800];
const TAB_SWITCH_RETRY_DELAYS_MS = [200, 300];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    async function refresh(retryDelaysMs: number[]) {
      setLoading(true);
      const request: ExtensionMessage = { type: "GET_ACTIVE_DEAL" };
      let response: Extract<ExtensionMessage, { type: "ACTIVE_DEAL_RESULT" }> | undefined;

      // Bounded retries paper over a real race: the background worker can
      // still be waking from an MV3 cold start, or a just-navigated-to/
      // just-injected content script may not have answered background's
      // pull yet — both read back as a confident "no deal" otherwise (see
      // resolveActiveDeal in src/background/index.ts), even though the tab
      // genuinely has one. Given up only after the last attempt still
      // comes back empty.
      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        response = (await chrome.runtime.sendMessage(request).catch(() => undefined)) as
          | Extract<ExtensionMessage, { type: "ACTIVE_DEAL_RESULT" }>
          | undefined;
        if (cancelled) return;
        if (response?.deal) break;
        if (attempt < retryDelaysMs.length) await sleep(retryDelaysMs[attempt]);
      }

      if (cancelled) return;
      activeTabIdRef.current = response?.tabId ?? null;
      setDeal(response?.deal ?? null);
      setLoading(false);
    }

    refresh(INITIAL_RETRY_DELAYS_MS);

    function onMessage(message: ExtensionMessage) {
      if (message.type === "ACTIVE_DEAL_UPDATED" && message.tabId === activeTabIdRef.current) {
        setDeal(message.deal);
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);

    // Rep switched to a different tab in this window — re-resolve which
    // deal (if any) that tab is on. In-tab SPA navigation to a different
    // deal is already covered by ACTIVE_DEAL_UPDATED above. Much lower
    // race risk than the initial resolve (a tab being switched *to* has
    // normally been sitting loaded for a while), so a short retry chain is
    // plenty — no reason to make every tab switch feel sluggish.
    function onTabActivated() {
      refresh(TAB_SWITCH_RETRY_DELAYS_MS);
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
