import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { DealActivity } from "./types";

/**
 * Shared by the get_recent_activities client tool (on-demand, full list)
 * and useTalkSession's pre-session fetch (a short digest folded into
 * session context — see buildActivityDigest in session-start-prompt.ts).
 * Mirrors fetchDealSnapshot's result-union shape.
 */
export async function fetchRecentActivities(deal: DetectedDeal): Promise<{ activities: DealActivity[] } | { error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: "The rep is signed out of Corner. Ask them to sign in first." };
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ provider: deal.provider, dealId: deal.dealId, action: "get_recent_activities" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: typeof body?.error === "string" ? body.error : `Failed to load recent activity (status ${res.status}).` };
    }
    return { activities: (body.activities ?? []) as DealActivity[] };
  } catch (e) {
    return { error: e instanceof Error ? `Failed to load recent activity: ${e.message}` : "Failed to load recent activity." };
  }
}
