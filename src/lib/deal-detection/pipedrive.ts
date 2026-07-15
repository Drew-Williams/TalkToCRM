import type { DetectedDeal } from "./types";

// Pipedrive deal pages: https://{companyDomain}.pipedrive.com/deal/{dealId}
// companyDomain is the org's Pipedrive subdomain and may contain digits/hyphens
// (e.g. "routerjet-sandbox-f4655c"), so keep the host match permissive.
const PIPEDRIVE_HOST_RE = /^([a-z0-9-]+)\.pipedrive\.com$/i;
const DEAL_PATH_RE = /^\/deal\/(\d+)(?:\/.*)?$/;

export function detectPipedriveDeal(url: string): DetectedDeal | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostMatch = parsed.hostname.match(PIPEDRIVE_HOST_RE);
  if (!hostMatch) return null;

  const pathMatch = parsed.pathname.match(DEAL_PATH_RE);
  if (!pathMatch) return null;

  return {
    provider: "pipedrive",
    dealId: pathMatch[1],
    url,
    detectedAt: Date.now(),
    accountRef: hostMatch[1],
  };
}
