import type { DealActivity, DealSnapshot } from "@/lib/crm-proxy/types";
import type { CoachingMemory } from "@/lib/coaching-memory/types";

/**
 * Builds a deal-aware greeting from data the extension already fetched
 * itself, rather than asking the agent's LLM to call get_deal_snapshot and
 * narrate it — that would cost the few seconds of tool-call latency right
 * at the start of every call, and the agent would need to be told to do
 * this proactively in the first place, which we don't control safely (see
 * agent-config.ts: the base system prompt's tool-usage instructions aren't
 * something this override should replace). Passed as
 * overrides.agent.firstMessage, which only needed a one-line enablement in
 * the agent's Security settings — much lower-risk than prompt.prompt's
 * full base-prompt replacement.
 *
 * Deliberately short and factual: this text is spoken verbatim by the TTS
 * voice, and per the "every AI claim must trace to CRM data" rule, nothing
 * here should say more than the snapshot actually contains.
 */
export function buildFirstMessage(snapshot: DealSnapshot, memory?: CoachingMemory | null, displayName?: string | null): string {
  const dealName = snapshot.name ?? "this deal";
  // First name only, spoken — "Hey Andrea Fields, you've got..." reads
  // fine on a screen but not out loud. A first-name-only greeting also
  // degrades gracefully if what's on file is really a full name pulled
  // from a CRM connection rather than something the rep typed themselves.
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hey ${firstName}, ` : "";
  const details: string[] = [];
  if (snapshot.stage) details.push(`${snapshot.stage} stage`);
  if (snapshot.amountCents != null) {
    const dollars = snapshot.amountCents / 100;
    // Rounded to the nearest thousand once it's big enough to matter for
    // speech — a human coach says "about $29K," not "$29,012.47." Odd,
    // precise figures also read as noticeably more awkward once spoken by
    // TTS than a round number does; exact-to-the-cent is still available
    // on request via get_deal_snapshot, just not in a fifteen-second
    // greeting.
    const roundedDollars = dollars >= 1000 ? Math.round(dollars / 1000) * 1000 : Math.round(dollars);
    details.push(
      roundedDollars.toLocaleString("en-US", {
        style: "currency",
        currency: snapshot.currency ?? "USD",
        maximumFractionDigits: 0,
      }),
    );
  }

  const summary = details.length > 0 ? `open — ${details.join(", ")}` : "open";

  // Coaching memory folds in as a short callback — but only the specific
  // open action item, never the full stored summary verbatim. That
  // summary is written like a report ("This coaching conversation
  // reviewed...") because it's meant to be read on screen (the post-call
  // copy-to-CRM block), not spoken — reciting it aloud is exactly what
  // made early greetings sound robotic and repetitive. No fallback to
  // memory.summary here on purpose: a plain, shorter greeting beats a
  // stiff one every time.
  const recap = memory?.nextAction ? ` Last time, the next step was ${memory.nextAction} — did that happen?` : "";

  return `${greeting}You've got ${dealName} ${summary}.${recap} What do you want to work through — catch you up, pressure-test it, or figure out the next move?`;
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
