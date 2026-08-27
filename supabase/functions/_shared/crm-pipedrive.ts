// Pipedrive adapter — read-only for step 2. See crm-hubspot.ts for why OAuth
// token exchange happens via a POST the extension calls (chrome.identity)
// rather than a GET redirect callback.
import type { CrmAdapter, DealActivity, DealContact, DealSnapshot } from "./deal-snapshot.ts";
import { CrmAuthRevokedError } from "./crm-errors.ts";

const PIPEDRIVE_CLIENT_ID = Deno.env.get("PIPEDRIVE_CLIENT_ID") ?? "";
const PIPEDRIVE_CLIENT_SECRET = Deno.env.get("PIPEDRIVE_CLIENT_SECRET") ?? "";
const DEFAULT_API_BASE = "https://api.pipedrive.com";

function authHeader(): string {
  return `Basic ${btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)}`;
}

async function fetchParticipants(apiBase: string, accessToken: string, dealId: string): Promise<DealContact[]> {
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

// A deal's primary contact (deal.person_id) is a *separate* relationship
// from "participants" above — plenty of real deals have a person_id set but
// no participants at all (confirmed against a real deal), which was making
// contacts come back empty even though the deal clearly showed a linked
// person in Pipedrive's own UI. Only used as a fallback when there are no
// participants, to avoid listing the same person twice if they're already
// a participant.
async function fetchPrimaryContact(apiBase: string, accessToken: string, personId: number): Promise<DealContact | null> {
  try {
    const res = await fetch(`${apiBase}/api/v2/persons/${personId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const person = (await res.json()).data;
    if (!person) return null;
    const emails = person.emails as Array<{ value: string; primary?: boolean }> | undefined;
    return {
      name: person.name ?? null,
      title: null, // Pipedrive persons have no job-title field by default
      email: emails?.find((e) => e.primary)?.value ?? emails?.[0]?.value ?? null,
    };
  } catch {
    return null;
  }
}

// Strips the CRM's rich-text note markup down to plain text for the agent
// to read out loud — a raw "&nbsp;<br><br>" in a spoken response would be
// read literally by the TTS voice.
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text || null;
}

// Pipedrive's standalone "Notes" are a separate resource from activities'
// own `note` field above — a deal can have either, both, or neither.
// Covered by the deals:read scope already granted (confirmed: no separate
// notes:read scope exists), unlike mail below.
async function fetchNotes(apiBase: string, accessToken: string, dealId: string): Promise<DealActivity[]> {
  try {
    const res = await fetch(`${apiBase}/v1/notes?deal_id=${dealId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data ?? []) as Array<Record<string, unknown>>).map((n) => ({
      type: "note",
      subject: null,
      note: stripHtml(n.content as string | null | undefined),
      occurredAt: (n.add_time as string) ?? null,
      done: null,
    }));
  } catch {
    return [];
  }
}

// Requires the mail:read scope (already granted on this connection) and a
// mail connection set up on the connected Pipedrive user's account — if
// neither the rep nor their team has connected a mailbox to Pipedrive, this
// always returns empty, which isn't distinguishable here from "no emails
// yet" (both are non-fatal either way). Uses the message list's `snippet`
// (a plain-text preview, already HTML-free, capped at 225 characters by
// Pipedrive) rather than fetching each message's full body — an extra
// request per email for what would still need HTML-stripping isn't worth
// it for a spoken summary.
async function fetchEmails(apiBase: string, accessToken: string, dealId: string): Promise<DealActivity[]> {
  try {
    const res = await fetch(`${apiBase}/v1/deals/${dealId}/mailMessages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data ?? []) as Array<Record<string, unknown>>).map((m) => {
      const from = (m.from as Array<{ name?: string; email_address?: string }> | undefined)?.[0];
      const fromLabel = from?.name || from?.email_address || null;
      const snippet = (m.snippet as string) ?? null;
      return {
        type: "email",
        subject: (m.subject as string) ?? null,
        note: [fromLabel ? `From ${fromLabel}:` : null, snippet].filter(Boolean).join(" ") || null,
        occurredAt: (m.message_time as string) ?? null,
        done: null,
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
    let ownerName: string | null = null;
    const apiBase: string | null = data.api_domain ?? null;
    try {
      const meRes = await fetch(`${apiBase ?? DEFAULT_API_BASE}/api/v2/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        const companyDomain = me.data?.company_domain as string | undefined;
        accountRef = companyDomain ?? null;
        // The connecting user's own name — Pipedrive's /users/me already
        // identifies exactly who authorized this connection, no extra
        // lookup needed (unlike HubSpot, which only gives an email here).
        ownerName = (me.data?.name as string | undefined) ?? null;
      }
    } catch {
      // Non-fatal — account_ref/ownerName are both best-effort informational signals, neither required for the connection to work.
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      accountRef,
      apiBase,
      scopes: typeof data.scope === "string" ? data.scope.split(" ") : [],
      ownerName,
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
    if (res.status === 401) throw new CrmAuthRevokedError("pipedrive");
    if (!res.ok) {
      throw new Error(`Pipedrive get deal failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const deal = data.data ?? {};

    const [participants, stageName, pipelineName] = await Promise.all([
      fetchParticipants(base, accessToken, dealId),
      deal.stage_id != null ? fetchName(base, accessToken, "stages", deal.stage_id) : Promise.resolve(null),
      deal.pipeline_id != null ? fetchName(base, accessToken, "pipelines", deal.pipeline_id) : Promise.resolve(null),
    ]);

    let contacts = participants;
    if (contacts.length === 0 && deal.person_id != null) {
      const primary = await fetchPrimaryContact(base, accessToken, deal.person_id);
      if (primary) contacts = [primary];
    }

    return {
      provider: "pipedrive",
      dealId: String(dealId),
      name: deal.title ?? null,
      stage: stageName ?? (deal.stage_id != null ? String(deal.stage_id) : null),
      pipeline: pipelineName ?? (deal.pipeline_id != null ? String(deal.pipeline_id) : null),
      amountCents: deal.value != null ? Math.round(Number(deal.value) * 100) : null,
      currency: deal.currency ?? null,
      closeDate: deal.expected_close_date ?? null,
      // owner_id is also a raw numeric id in v2 (same as stage_id/pipeline_id
      // above), so `.name` never resolves — leaving this null rather than a
      // meaningless number. A GET /api/v2/users/{id} lookup (same pattern as
      // fetchName above) 403'd with "Scope and URL mismatch" when tried
      // against this OAuth app's granted scopes, so resolving it properly
      // needs a broader Pipedrive scope, not just a code change.
      ownerName: null,
      lastActivityAt: deal.last_activity_date ?? null,
      contacts,
      description: null, // Pipedrive deals have no free-text description field by default
      fetchedAt: new Date().toISOString(),
    };
  },

  // Merges three genuinely separate Pipedrive resources into one
  // chronological feed — matching this tool's own description in the
  // ElevenLabs dashboard, which already lists "an email, call, note, or
  // meeting" as the things it should be able to answer for. Each source is
  // best-effort (a failure in one doesn't drop the others); the combined
  // list is what actually gets capped to `limit`, not each source
  // individually, so a request for "the last 3 things that happened" can
  // mix types correctly instead of e.g. always showing 3 activities before
  // any notes/emails are even considered.
  async getRecentActivities(accessToken, dealId, apiBase, limit): Promise<DealActivity[]> {
    const base = apiBase ?? DEFAULT_API_BASE;

    const activitiesRes = await fetch(`${base}/api/v2/activities?deal_id=${dealId}&limit=${Math.max(1, limit)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (activitiesRes.status === 401) throw new CrmAuthRevokedError("pipedrive");
    if (!activitiesRes.ok) {
      throw new Error(`Pipedrive get activities failed (${activitiesRes.status}): ${await activitiesRes.text()}`);
    }
    const activitiesData = await activitiesRes.json();
    const activities = ((activitiesData.data ?? []) as Array<Record<string, unknown>>).map((a) => ({
      type: (a.type as string) ?? null,
      subject: (a.subject as string) ?? null,
      note: stripHtml(a.note as string | null | undefined),
      occurredAt: (a.marked_as_done_time as string) || (a.due_date as string) || null,
      done: typeof a.done === "boolean" ? a.done : null,
    }));

    const [notes, emails] = await Promise.all([fetchNotes(base, accessToken, dealId), fetchEmails(base, accessToken, dealId)]);

    return [...activities, ...notes, ...emails]
      .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
      .slice(0, limit);
  },
};
