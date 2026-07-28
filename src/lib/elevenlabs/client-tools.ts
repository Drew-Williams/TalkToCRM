import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";
import { fetchRecentMemories } from "@/lib/coaching-memory/get-memory";

const NOT_IMPLEMENTED = "This capability isn't available yet in Corner.";

/** Shared by get_recent_activities below — resolves the session token or a clear reason there isn't one. get_deal_snapshot uses fetchDealSnapshot instead, which does this same check internally. */
async function getAccessTokenOrReason(): Promise<{ accessToken: string } | { error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: "The rep is signed out of Corner. Ask them to sign in first." };
  }
  return { accessToken };
}

async function callCrmProxy(deal: DetectedDeal, action: "get_recent_activities", accessToken: string) {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ provider: deal.provider, dealId: deal.dealId, action }),
  });
}

/**
 * Client tools registered with the ElevenLabs SDK. The agent already has six
 * client tools configured in the ElevenLabs dashboard (checked directly via
 * the Convai API): get_deal_snapshot, get_recent_activities, and
 * recall_notebook now have real backends (crm-proxy's get_deal /
 * get_recent_activities actions, and coaching_memory respectively —
 * recall_notebook's expects_response was flipped to true via the Convai
 * Tools API when this was wired up, since it shipped defaulted to false
 * (fire-and-forget) back when it was still a stub). The other two
 * (lookup_playbook, save_note — push_to_crm has since moved to a fifth,
 * still-unbuilt capability) mirror capabilities from later steps (the org
 * playbook and the two-step CRM write flow) that don't have storage/APIs
 * built yet, so they're registered as stubs purely so a tool call doesn't
 * surface as an "unhandled client tool" — those two are still configured
 * with expects_response: false in the dashboard, so the string returned
 * here is never actually read by the agent regardless.
 *
 * getCurrentDeal is a function, not a captured value, so every real tool
 * always reads whichever deal is active *at call time* even if the rep
 * switches tabs mid-conversation. None take parameters from the agent
 * (their ElevenLabs tool configs all have parameters: null) — they always
 * operate on "whatever deal is currently open."
 */
export function buildClientTools(getCurrentDeal: () => DetectedDeal | null) {
  return {
    async get_deal_snapshot(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a HubSpot or Pipedrive deal first.";
      }
      const result = await fetchDealSnapshot(deal);
      return "error" in result ? result.error : JSON.stringify(result.snapshot);
    },

    async get_recent_activities(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a HubSpot or Pipedrive deal first.";
      }
      const tokenResult = await getAccessTokenOrReason();
      if ("error" in tokenResult) return tokenResult.error;

      try {
        const res = await callCrmProxy(deal, "get_recent_activities", tokenResult.accessToken);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return typeof body?.error === "string" ? body.error : `Failed to load recent activity (status ${res.status}).`;
        }
        const activities = body.activities ?? [];
        return activities.length === 0
          ? "No recent activities (calls, meetings, emails, tasks) are logged against this deal."
          : JSON.stringify(activities);
      } catch (e) {
        return e instanceof Error ? `Failed to load recent activity: ${e.message}` : "Failed to load recent activity.";
      }
    },

    async recall_notebook(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a HubSpot or Pipedrive deal first.";
      }
      const memories = await fetchRecentMemories(deal, 5);
      if (memories.length === 0) {
        return "No memory of previous coaching conversations about this deal — this is the first one, or none were saved.";
      }
      // Plain, dated entries rather than trying to force each one into the
      // notebook's own fact/hypothesis/action taxonomy (see this tool's
      // description in the ElevenLabs dashboard) — the agent's own
      // reasoning is better placed than this client code to judge which of
      // those categories a given past summary actually falls into.
      const entries = memories.map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const parts = [m.summary, m.risk ? `Risk: ${m.risk}` : null, m.nextAction ? `Next step: ${m.nextAction}` : null].filter(Boolean);
        return `${date} — ${parts.join(" ")}`;
      });
      return entries.join("\n");
    },
    async lookup_playbook(): Promise<string> {
      return NOT_IMPLEMENTED;
    },
    async save_note(): Promise<string> {
      return NOT_IMPLEMENTED;
    },
    async push_to_crm(): Promise<string> {
      return NOT_IMPLEMENTED;
    },
  };
}
