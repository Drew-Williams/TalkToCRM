import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";

const NOT_IMPLEMENTED = "This capability isn't available yet in Talk to CRM.";

/** Shared by both real tools below — resolves the session token or a clear reason there isn't one. */
async function getAccessTokenOrReason(): Promise<{ accessToken: string } | { error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: "The rep is signed out of Talk to CRM. Ask them to sign in first." };
  }
  return { accessToken };
}

async function callCrmProxy(deal: DetectedDeal, action: "get_deal" | "get_recent_activities", accessToken: string) {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ provider: deal.provider, dealId: deal.dealId, action }),
  });
}

/**
 * Client tools registered with the ElevenLabs SDK. The agent already has six
 * client tools configured in the ElevenLabs dashboard (checked directly via
 * the Convai API): get_deal_snapshot and get_recent_activities now have real
 * backends (crm-proxy's get_deal / get_recent_activities actions). The other
 * three (recall_notebook, lookup_playbook, save_note, push_to_crm — that's
 * four, actually) mirror capabilities from later steps (coaching memory, the
 * playbook, and the two-step CRM write flow) that don't have storage/APIs
 * built yet, so they're registered as stubs purely so a tool call doesn't
 * surface as an "unhandled client tool" — all of them are configured with
 * expects_response: false in the dashboard (fire-and-forget), so the string
 * returned here is never actually read by the agent regardless.
 *
 * getCurrentDeal is a function, not a captured value, so both real tools
 * always read whichever deal is active *at call time* even if the rep
 * switches tabs mid-conversation. Neither takes parameters from the agent
 * (their ElevenLabs tool configs both have parameters: null) — they always
 * operate on "whatever deal is currently open."
 */
export function buildClientTools(getCurrentDeal: () => DetectedDeal | null) {
  return {
    async get_deal_snapshot(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a HubSpot or Pipedrive deal first.";
      }
      const tokenResult = await getAccessTokenOrReason();
      if ("error" in tokenResult) return tokenResult.error;

      try {
        const res = await callCrmProxy(deal, "get_deal", tokenResult.accessToken);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return typeof body?.error === "string" ? body.error : `Failed to load the deal (status ${res.status}).`;
        }
        return JSON.stringify(body.deal);
      } catch (e) {
        return e instanceof Error ? `Failed to load the deal: ${e.message}` : "Failed to load the deal.";
      }
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
      return NOT_IMPLEMENTED;
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
