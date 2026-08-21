import type { DealActivity, DealSnapshot } from "@/lib/crm-proxy/types";
import type { CoachingMemory } from "@/lib/coaching-memory/types";

/**
 * Builds a genuinely open-ended greeting — the way a real coach opens a
 * session, by asking what's going on and letting the rep set the agenda,
 * not by reciting the deal record back at someone who's already looking
 * at it in the side panel. Earlier versions of this tried to prove the
 * coach "already knew" the deal by folding in stage/amount/recent-activity
 * facts up front, which just relocated the robotic-recitation problem
 * into a scripted line instead of fixing it — real feedback confirmed
 * even a well-written recap of CRM facts reads as stiff the moment it's
 * spoken verbatim rather than said.
 *
 * The coach still has everything (deal facts, activity history, company
 * context) the instant any of it is actually relevant — get_deal_snapshot
 * is already reliably called the moment the conversation needs deal
 * facts, and the activity digest/company context ride along as ambient
 * session context regardless of what this greeting says. This line's
 * only job is to open the conversation like a person would, not to prove
 * anything.
 *
 * Passed as overrides.agent.firstMessage, which only needed a one-line
 * enablement in the agent's Security settings — much lower-risk than
 * prompt.prompt's full base-prompt replacement.
 */
export function buildFirstMessage(snapshot: DealSnapshot, memory?: CoachingMemory | null, displayName?: string | null): string {
  const dealName = snapshot.name ?? "this deal";
  // First name only, spoken — "Hey Andrea Fields..." reads fine on a
  // screen but not out loud. Degrades gracefully to a plain "Hey" if
  // there's no name on file yet.
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hey ${firstName} — ` : "Hey — ";

  // Coaching memory is the one thing still worth calling back to directly
  // in the greeting — unlike CRM facts, it's a genuine "did you do the
  // thing we agreed on" continuity check, exactly how a real coach
  // follows up between sessions, not a recited data field.
  if (memory?.nextAction) {
    return `${greeting}last time, the next step was ${memory.nextAction}. Did that happen? What do you want to work through today?`;
  }

  return `${greeting}what's going on with the ${dealName} deal, and what do you want to work through?`;
}

/**
 * A short, dated digest of a deal's most recent activity (calls, meetings,
 * notes, emails) — passed as the corner_recent_activity dynamic variable
 * and referenced in the base prompt's SESSION BEHAVIOR section, so the
 * agent already has this on a *first* review instead of only calling
 * get_recent_activities reactively after the seller has to point out that
 * history exists (the exact gap real testing surfaced: get_deal_snapshot
 * alone doesn't include activity, and the agent had no built-in reason to
 * proactively fetch a separate tool for it).
 *
 * Deliberately short (5 items, each capped) — this rides along in the
 * prompt for the whole conversation, unlike a one-off tool call, so it
 * needs to stay cheap. get_recent_activities is still available for a
 * longer history than this digest covers.
 */
export function buildActivityDigest(activities: DealActivity[], limit = 5): string {
  if (activities.length === 0) return "";
  return activities
    .slice(0, limit)
    .map((activity) => {
      const date = activity.occurredAt
        ? new Date(activity.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "undated";
      const label = activity.type ?? "activity";
      const text = activity.subject || activity.note || "";
      const truncated = text.length > 140 ? `${text.slice(0, 140)}…` : text;
      return `${date} — ${label}: ${truncated}`;
    })
    .join("\n");
}
