import type { DetectedDeal } from "@/lib/deal-detection/types";
import { watchUrlChanges } from "@/lib/spa-url-watcher";
import type { ExtensionMessage } from "@/lib/chrome/messaging";

/**
 * Shared wiring for a per-provider content script: detect the deal on the
 * current URL, re-detect on every SPA navigation, push changes to the
 * background worker, and answer direct pulls (GET_CURRENT_DEAL) from it.
 * `detect` is the only thing that differs between HubSpot and Pipedrive.
 */
export function watchAndReportDeal(detect: (url: string) => DetectedDeal | null) {
  let currentDeal: DetectedDeal | null = null;

  function report(next: DetectedDeal | null) {
    const sameDeal = (currentDeal?.dealId ?? null) === (next?.dealId ?? null) && currentDeal?.provider === next?.provider;
    currentDeal = next;
    if (sameDeal) return; // avoid spamming background on every poll tick when nothing changed

    const message: ExtensionMessage = next ? { type: "DEAL_DETECTED", deal: next } : { type: "DEAL_CLEARED" };
    chrome.runtime.sendMessage(message).catch(() => {
      // Background isn't listening yet (e.g. right after install/reload).
      // Not fatal: the side panel's pull path (GET_CURRENT_DEAL) below will
      // still get the right answer the next time it asks.
    });
  }

  report(detect(window.location.href));
  watchUrlChanges((url) => report(detect(url)));

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "GET_CURRENT_DEAL") {
      const response: ExtensionMessage = { type: "CURRENT_DEAL_RESULT", deal: currentDeal };
      sendResponse(response);
    }
  });
}
