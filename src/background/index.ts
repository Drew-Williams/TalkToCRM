import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { ExtensionMessage } from "@/lib/chrome/messaging";

// Toolbar icon opens the side panel directly — no popup in this product.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error("[background] failed to set side panel behavior", err);
  });
});

// In-memory cache only. MV3 service workers get evicted whenever Chrome
// feels like it, so this map can be empty even for a tab that already has a
// detected deal — resolveActiveDeal() below falls back to asking the content
// script directly (GET_CURRENT_DEAL) whenever that happens. Never treat this
// map as the source of truth, only as a warm cache to avoid the round trip.
const dealsByTabId = new Map<number, DetectedDeal>();

function broadcastActiveDealUpdate(tabId: number, deal: DetectedDeal | null) {
  const message: ExtensionMessage = { type: "ACTIVE_DEAL_UPDATED", deal, tabId };
  chrome.runtime.sendMessage(message).catch(() => {
    // No side panel open to receive it right now — fine, it'll pull the
    // current state itself the next time it opens.
  });
}

async function resolveActiveDeal(): Promise<Extract<ExtensionMessage, { type: "ACTIVE_DEAL_RESULT" }>> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = activeTab?.id;
  if (tabId === undefined) {
    return { type: "ACTIVE_DEAL_RESULT", deal: null, tabId: null };
  }

  const cached = dealsByTabId.get(tabId);
  if (cached) {
    return { type: "ACTIVE_DEAL_RESULT", deal: cached, tabId };
  }

  const pullMessage: ExtensionMessage = { type: "GET_CURRENT_DEAL" };
  const pullResult = (await chrome.tabs.sendMessage(tabId, pullMessage).catch(() => undefined)) as
    | Extract<ExtensionMessage, { type: "CURRENT_DEAL_RESULT" }>
    | undefined;
  const deal = pullResult?.deal ?? null;
  if (deal) dealsByTabId.set(tabId, deal);
  return { type: "ACTIVE_DEAL_RESULT", deal, tabId };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case "DEAL_DETECTED": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        dealsByTabId.set(tabId, message.deal);
        broadcastActiveDealUpdate(tabId, message.deal);
      }
      return;
    }
    case "DEAL_CLEARED": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        dealsByTabId.delete(tabId);
        broadcastActiveDealUpdate(tabId, null);
      }
      return;
    }
    case "GET_ACTIVE_DEAL": {
      resolveActiveDeal().then(sendResponse);
      return true; // keep the message channel open for the async response
    }
    default:
      return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  dealsByTabId.delete(tabId);
});
