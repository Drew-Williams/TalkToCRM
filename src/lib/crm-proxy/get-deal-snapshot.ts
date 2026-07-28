import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { DealSnapshot } from "./types";

/**
 * Calls crm-proxy's get_deal action directly — shared by the
 * get_deal_snapshot client tool (which needs the raw JSON string to hand
 * back to the agent) and useTalkSession's pre-session fetch (which needs
 * the parsed object to build a dynamic first message from). Returns a
 * result union rather than throwing so both callers can decide for
 * themselves how to degrade (a stubbed tool response string vs. silently
 * falling back to the agent's static greeting).
 */
export async function fetchDealSnapshot(deal: DetectedDeal): Promise<{ snapshot: DealSnapshot } | { error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: "The rep is signed out of Corner. Ask them to sign in first." };
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ provider: deal.provider, dealId: deal.dealId, action: "get_deal" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: typeof body?.error === "string" ? body.error : `Failed to load the deal (status ${res.status}).` };
    }
    return { snapshot: body.deal as DealSnapshot };
  } catch (e) {
    return { error: e instanceof Error ? `Failed to load the deal: ${e.message}` : "Failed to load the deal." };
  }
}
