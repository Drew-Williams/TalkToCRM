import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";

const NOT_IMPLEMENTED = "This capability isn't available yet in Talk to CRM.";

/**
 * Client tools registered with the ElevenLabs SDK. The agent already has six
 * client tools configured in the ElevenLabs dashboard (checked directly via
 * the Convai API), but only get_deal_snapshot has a real backend behind it
 * right now — crm-proxy. The other five (get_recent_activities,
 * recall_notebook, lookup_playbook, save_note, push_to_crm) mirror
 * capabilities from later steps (activity history, coaching memory, the
 * playbook, and the two-step CRM write flow) that don't have storage/APIs
 * built yet, so they're registered as stubs purely so a tool call doesn't
 * surface as an "unhandled client tool" — all five are configured with
 * expects_response: false in the dashboard (fire-and-forget), so the string
 * returned here is never actually read by the agent regardless.
 *
 * getCurrentDeal is a function, not a captured value, so get_deal_snapshot
 * always reads whichever deal is active *at call time* even if the rep
 * switches tabs mid-conversation. get_deal_snapshot itself takes no
 * parameters from the agent (its ElevenLabs tool config has parameters:
 * null) — it always operates on "whatever deal is currently open."
 */
export function buildClientTools(getCurrentDeal: () => DetectedDeal | null) {
  return {
    async get_deal_snapshot(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a HubSpot or Pipedrive deal first.";
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        return "The rep is signed out of Talk to CRM. Ask them to sign in first.";
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ provider: deal.provider, dealId: deal.dealId, action: "get_deal" }),
        });
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
      return NOT_IMPLEMENTED;
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
