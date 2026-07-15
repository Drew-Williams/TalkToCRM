import type { DetectedDeal } from "./types";

// HubSpot deal record URLs (object type 0-3 = Deals, see
// https://developers.hubspot.com/guides/crm/understanding-the-crm#object-type-ids):
//   https://app.hubspot.com/contacts/{portalId}/record/0-3/{dealId}          (current record UI)
//   https://app.hubspot.com/contacts/{portalId}/record/0-3/{dealId}/view    (record UI w/ tab)
//   https://app.hubspot.com/contacts/{portalId}/deal/{dealId}               (legacy path, still resolves)
const RECORD_PATH_RE = /^\/contacts\/(\d+)\/record\/0-3\/(\d+)(?:\/.*)?$/;
const LEGACY_DEAL_PATH_RE = /^\/contacts\/(\d+)\/deal\/(\d+)(?:\/.*)?$/;

export function detectHubspotDeal(url: string): DetectedDeal | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== "app.hubspot.com") return null;

  const match = parsed.pathname.match(RECORD_PATH_RE) ?? parsed.pathname.match(LEGACY_DEAL_PATH_RE);
  if (!match) return null;

  const [, portalId, dealId] = match;
  return {
    provider: "hubspot",
    dealId,
    url,
    detectedAt: Date.now(),
    accountRef: portalId,
  };
}
