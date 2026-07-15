// The normalized shape every CRM adapter must return. ElevenLabs client
// tools (and the side panel) only ever see this — never HubSpot's or
// Pipedrive's raw API response shapes. Every field is either directly from
// the CRM or explicitly null; nothing here is inferred or invented, per the
// "every AI claim must trace to CRM data or a saved note" rule.
export interface DealContact {
  name: string | null;
  title: string | null;
  email: string | null;
}

export interface DealSnapshot {
  provider: "hubspot" | "pipedrive";
  dealId: string;
  name: string | null;
  stage: string | null;
  pipeline: string | null;
  amountCents: number | null;
  currency: string | null;
  closeDate: string | null;
  ownerName: string | null;
  /** ISO timestamp of the CRM's own "last activity" field, when it has one. */
  lastActivityAt: string | null;
  contacts: DealContact[];
  description: string | null;
  fetchedAt: string;
}

export interface CrmAdapter {
  /** Exchange an OAuth authorization code for tokens. redirectUri must match what was used to obtain the code. */
  exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    accountRef: string | null;
    /** Pipedrive returns a per-company API domain on token exchange; null for providers with a fixed API host (HubSpot). */
    apiBase: string | null;
    scopes: string[];
  }>;
  /** Refresh an access token. Returns null if the provider has no refresh flow (e.g. a non-expiring token). */
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    apiBase: string | null;
  } | null>;
  getDeal(accessToken: string, dealId: string, apiBase: string | null): Promise<DealSnapshot>;
}
