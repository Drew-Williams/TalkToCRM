import type { DetectedDeal } from "@/lib/deal-detection/types";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";
import { fetchRecentActivities } from "@/lib/crm-proxy/get-recent-activities";
import { fetchRecentMemories } from "@/lib/coaching-memory/get-memory";
import { fetchUserProfile } from "@/lib/user-profile/get-profile";

const NOT_IMPLEMENTED = "This capability isn't available yet in Corner.";

/**
 * Client tools registered with the ElevenLabs SDK. get_deal_snapshot,
 * get_recent_activities, recall_notebook, and lookup_playbook now have real
 * backends (crm-proxy's get_deal / get_recent_activities actions,
 * coaching_memory, and user_profile's "playbook light" company fields
 * respectively — recall_notebook and lookup_playbook both shipped with
 * expects_response: false back when they were stubs, so each got flipped
 * to true via the Convai Tools API as it was wired up here). The remaining
 * two (save_note, push_to_crm — the two-step CRM write flow) still have no
 * storage/API built, so they're registered as stubs purely so a tool call
 * doesn't surface as an "unhandled client tool" — those two are still
 * configured with expects_response: false in the dashboard, so the string
 * returned here is never actually read by the agent regardless.
 *
 * getCurrentDeal is a function, not a captured value, so every deal-scoped
 * tool always reads whichever deal is active *at call time* even if the
 * rep switches tabs mid-conversation. None take parameters from the agent
 * (their ElevenLabs tool configs all have parameters: null) — they always
 * operate on "whatever deal is currently open" (or, for lookup_playbook,
 * the rep's own company profile, which isn't deal-scoped at all).
 */
export function buildClientTools(getCurrentDeal: () => DetectedDeal | null) {
  return {
    async get_deal_snapshot(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a Pipedrive deal first.";
      }
      const result = await fetchDealSnapshot(deal);
      if ("error" in result) return result.error;
      // lastActivityAt deliberately omitted: it's Pipedrive's own summary
      // field, tracked separately from (and frequently empty even on
      // deals with real history compared to) the activity digest already
      // supplied in session context — real testing showed the agent
      // reading this field in isolation and flatly contradicting activity
      // it had already correctly referenced moments earlier in the same
      // conversation. Removing the temptation at the source is more
      // reliable than only instructing the agent not to be misled by it.
      const { lastActivityAt: _lastActivityAt, ...snapshotForAgent } = result.snapshot;
      return JSON.stringify(snapshotForAgent);
    },

    // Session context (see session-start-prompt.ts's buildActivityDigest)
    // already folds in a short digest of the deal's most recent activity
    // before this tool is ever needed — this is the fallback for "more
    // than the digest," a longer history, or a refresh after new
    // information, not the primary way the agent learns about a deal's
    // history on a first review (that was the actual bug reported: the
    // agent would only call this reactively, after being pushed on it
    // twice, instead of already knowing).
    async get_recent_activities(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a Pipedrive deal first.";
      }
      const result = await fetchRecentActivities(deal);
      if ("error" in result) return result.error;
      return result.activities.length === 0
        ? "No recent activities (calls, meetings, emails, tasks) are logged against this deal."
        : JSON.stringify(result.activities);
    },

    async recall_notebook(): Promise<string> {
      const deal = getCurrentDeal();
      if (!deal) {
        return "No deal is currently open in the browser. Ask the rep to open a Pipedrive deal first.";
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
      const profile = await fetchUserProfile();
      const hasAnyCompanyContext = !!(profile?.companyName || profile?.valueProp || profile?.icp || profile?.industry || profile?.competitors);
      if (!hasAnyCompanyContext) {
        return "No company playbook is set up yet — the rep hasn't added their company profile in Corner's settings.";
      }
      // The registered tool takes no parameters (topic-based retrieval
      // isn't meaningful for a profile this small — see
      // mem/design/company-profile-v1.md) — always return the whole
      // compact profile and let the agent pull out what's relevant.
      const parts = [
        profile?.companyName ? `Company: ${profile.companyName}` : null,
        profile?.industry ? `Industry: ${profile.industry}` : null,
        profile?.valueProp ? `Value proposition: ${profile.valueProp}` : null,
        profile?.icp ? `Ideal customer profile: ${profile.icp}` : null,
        profile?.competitors ? `Known competitors: ${profile.competitors}` : null,
      ].filter(Boolean);
      return parts.join("\n");
    },
    async save_note(): Promise<string> {
      return NOT_IMPLEMENTED;
    },
    async push_to_crm(): Promise<string> {
      return NOT_IMPLEMENTED;
    },
  };
}
