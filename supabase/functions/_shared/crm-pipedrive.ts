// Pipedrive adapter — read-only for step 2. See crm-hubspot.ts for why OAuth
// token exchange happens via a POST the extension calls (chrome.identity)
// rather than a GET redirect callback.
import type { CrmAdapter, DealContact, DealSnapshot } from "./deal-snapshot.ts";

const PIPEDRIVE_CLIENT_ID = Deno.env.get("PIPEDRIVE_CLIENT_ID") ?? "";
const PIPEDRIVE_CLIENT_SECRET = Deno.env.get("PIPEDRIVE_CLIENT_SECRET") ?? "";
const DEFAULT_API_BASE = "https://api.pipedrive.com";

function authHeader(): string {
  return `Basic ${btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)}`;
}

async function fetchContacts(apiBase: string, accessToken: string, dealId: string): Promise<DealContact[]> {
  try {
    const res = await fetch(`${apiBase}/api/v2/deals/${dealId}/participants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data ?? []) as Array<Record<string, unknown>>).slice(0, 10).map((p) => {
      const person = p.person as Record<string, unknown> | undefined;
      const emails = person?.email as Array<{ value: string }> | undefined;
      return {
        name: (person?.name as string) ?? null,
        title: (person?.job_title as string) ?? null,
        email: emails?.[0]?.value ?? null,
      };
    });
  } catch {
    return [];
  }
}

// The v2 /deals/{id} response only includes raw stage_id/pipeline_id
// integers, not nested name objects (unlike v1) — so a friendly stage/
// pipeline name needs its own lookup. Best-effort: falls back to the raw
// numeric ID (stringified) if the lookup fails, same as before this fix.
async function fetchName(apiBase: string, accessToken: string, resource: "stages" | "pipelines", id: number): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/api/v2/${resource}/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.name as string) ?? null;
  } catch {
    return null;
  }
}

export const pipedriveAdapter: CrmAdapter = {
  async exchangeCode(code, redirectUri) {
    const res = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error(`Pipedrive token exchange failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();

    let accountRef: string | null = null;
    const apiBase: string | null = data.api_domain ?? null;
    try {
      const meRes = await fetch(`${apiBase ?? DEFAULT_API_BASE}/api/v2/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        const companyDomain = me.data?.company_domain as string | undefined;
        accountRef = companyDomain ?? null;
      }
    } catch {
      // Non-fatal — account_ref is informational (shown in the side panel), not required for the connection to work.
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      accountRef,
      apiBase,
      scopes: typeof data.scope === "string" ? data.scope.split(" ") : [],
    };
  },

  async refreshAccessToken(refreshToken) {
    const res = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      apiBase: data.api_domain ?? null,
    };
  },

  async getDeal(accessToken, dealId, apiBase): Promise<DealSnapshot> {
    const base = apiBase ?? DEFAULT_API_BASE;
    const res = await fetch(`${base}/api/v2/deals/${dealId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Pipedrive get deal failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const deal = data.data ?? {};

    const [contacts, stageName, pipelineName] = await Promise.all([
      fetchContacts(base, accessToken, dealId),
      deal.stage_id != null ? fetchName(base, accessToken, "stages", deal.stage_id) : Promise.resolve(null),
      deal.pipeline_id != null ? fetchName(base, accessToken, "pipelines", deal.pipeline_id) : Promise.resolve(null),
    ]);

    return {
      provider: "pipedrive",
      dealId: String(dealId),
      name: deal.title ?? null,
      stage: stageName ?? (deal.stage_id != null ? String(deal.stage_id) : null),
      pipeline: pipelineName ?? (deal.pipeline_id != null ? String(deal.pipeline_id) : null),
      amountCents: deal.value != null ? Math.round(Number(deal.value) * 100) : null,
      currency: deal.currency ?? null,
      closeDate: deal.expected_close_date ?? null,
      ownerName: deal.owner_id?.name ?? null,
      lastActivityAt: deal.last_activity_date ?? null,
      contacts,
      description: null, // Pipedrive deals have no free-text description field by default
      fetchedAt: new Date().toISOString(),
    };
  },
};
