// HubSpot adapter — read-only for step 2 (see mem/design/deal-detection-v1.md
// sibling doc mem/design/crm-proxy-v1.md for why OAuth token exchange lives
// here instead of a GET redirect callback: the extension uses
// chrome.identity.launchWebAuthFlow, which requires the token exchange to
// happen via a POST the extension itself calls, not a browser redirect).
import type { CrmAdapter, DealContact, DealSnapshot } from "./deal-snapshot.ts";

const HUBSPOT_CLIENT_ID = Deno.env.get("HUBSPOT_CLIENT_ID") ?? "";
const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET") ?? "";
const API_BASE = "https://api.hubapi.com";

const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "pipeline",
  "closedate",
  "description",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
  "hs_deal_amount_currency_code",
].join(",");

async function fetchStageLabel(accessToken: string, pipelineId: string | null, stageId: string | null): Promise<{ stageLabel: string | null; pipelineLabel: string | null }> {
  if (!stageId) return { stageLabel: null, pipelineLabel: null };
  try {
    const res = await fetch(`${API_BASE}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { stageLabel: stageId, pipelineLabel: pipelineId };
    const data = await res.json();
    for (const pipeline of data.results ?? []) {
      const stage = (pipeline.stages ?? []).find((s: { id: string }) => s.id === stageId);
      if (stage) {
        return { stageLabel: stage.label ?? stageId, pipelineLabel: pipeline.label ?? pipelineId };
      }
    }
  } catch {
    // Fall through to raw ids below — a missing label is better than a failed read.
  }
  return { stageLabel: stageId, pipelineLabel: pipelineId };
}

async function fetchOwnerName(accessToken: string, ownerId: string | null): Promise<string | null> {
  if (!ownerId) return null;
  try {
    const res = await fetch(`${API_BASE}/crm/v3/owners/${ownerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email || null;
  } catch {
    return null;
  }
}

async function fetchContacts(accessToken: string, dealId: string): Promise<DealContact[]> {
  try {
    const assocRes = await fetch(`${API_BASE}/crm/v4/objects/deals/${dealId}/associations/contacts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!assocRes.ok) return [];
    const assocData = await assocRes.json();
    const contactIds: string[] = (assocData.results ?? []).map((r: { toObjectId: number | string }) => String(r.toObjectId)).slice(0, 10);
    if (contactIds.length === 0) return [];

    const batchRes = await fetch(`${API_BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: contactIds.map((id) => ({ id })), properties: ["firstname", "lastname", "email", "jobtitle"] }),
    });
    if (!batchRes.ok) return [];
    const batchData = await batchRes.json();
    return (batchData.results ?? []).map((c: { properties?: Record<string, string> }) => ({
      name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || null,
      title: c.properties?.jobtitle ?? null,
      email: c.properties?.email ?? null,
    }));
  } catch {
    return [];
  }
}

export const hubspotAdapter: CrmAdapter = {
  async exchangeCode(code, redirectUri) {
    const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`HubSpot token exchange failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();

    let accountRef: string | null = null;
    try {
      const infoRes = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${data.access_token}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        accountRef = String(info.hub_id ?? info.portal_id ?? "") || null;
      }
    } catch {
      // Non-fatal — account_ref is informational (shown in the side panel), not required for the connection to work.
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      accountRef,
      apiBase: null, // HubSpot always uses api.hubapi.com regardless of portal
      scopes: typeof data.scope === "string" ? data.scope.split(" ") : [],
    };
  },

  async refreshAccessToken(refreshToken) {
    const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      apiBase: null,
    };
  },

  async getDeal(accessToken, dealId, _apiBase): Promise<DealSnapshot> {
    const res = await fetch(`${API_BASE}/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPERTIES}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`HubSpot get deal failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const props: Record<string, string | undefined> = data.properties ?? {};

    const [{ stageLabel, pipelineLabel }, ownerName, contacts] = await Promise.all([
      fetchStageLabel(accessToken, props.pipeline ?? null, props.dealstage ?? null),
      fetchOwnerName(accessToken, props.hubspot_owner_id ?? null),
      fetchContacts(accessToken, dealId),
    ]);

    return {
      provider: "hubspot",
      dealId,
      name: props.dealname ?? null,
      stage: stageLabel,
      pipeline: pipelineLabel,
      amountCents: props.amount ? Math.round(Number(props.amount) * 100) : null,
      currency: props.hs_deal_amount_currency_code ?? null,
      closeDate: props.closedate ?? null,
      ownerName,
      lastActivityAt: props.hs_lastmodifieddate ?? null,
      contacts,
      description: props.description ?? null,
      fetchedAt: new Date().toISOString(),
    };
  },
};
