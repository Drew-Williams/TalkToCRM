import type { DetectedDeal } from "@/lib/deal-detection/types";

// The full message contract between content scripts, the background service
// worker, and the side panel. Keeping every message shape in one place makes
// it easy to see the whole protocol without hunting across three contexts.
export type ExtensionMessage =
  // content script -> background, fired when the detected deal changes
  | { type: "DEAL_DETECTED"; deal: DetectedDeal }
  | { type: "DEAL_CLEARED" }
  // background -> content script, "pull" path used when the service worker's
  // in-memory cache is empty (e.g. it was just evicted and woke back up)
  | { type: "GET_CURRENT_DEAL" }
  | { type: "CURRENT_DEAL_RESULT"; deal: DetectedDeal | null }
  // side panel -> background, asks for the active tab's deal right now
  | { type: "GET_ACTIVE_DEAL" }
  | { type: "ACTIVE_DEAL_RESULT"; deal: DetectedDeal | null; tabId: number | null }
  // background -> side panel (broadcast), fired whenever a tracked tab's deal changes
  | { type: "ACTIVE_DEAL_UPDATED"; deal: DetectedDeal | null; tabId: number }
  // background -> side panel (broadcast), fired on the "toggle-talk" keyboard
  // shortcut (see manifest.config.ts commands) — useTalkSession decides
  // whether that means start or end based on its own current status.
  | { type: "TOGGLE_TALK" };
