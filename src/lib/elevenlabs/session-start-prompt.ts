import type { DealSnapshot } from "@/lib/crm-proxy/types";

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
export function buildFirstMessage(snapshot: DealSnapshot): string {
  const dealName = snapshot.name ?? "this deal";
  const details: string[] = [];
  if (snapshot.stage) details.push(`${snapshot.stage} stage`);
  if (snapshot.amountCents != null) {
    details.push(
      (snapshot.amountCents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: snapshot.currency ?? "USD",
        maximumFractionDigits: 0,
      }),
    );
  }

  const summary = details.length > 0 ? `open — ${details.join(", ")}` : "open";
  return `You've got ${dealName} ${summary}. What do you want to work through — catch you up, pressure-test it, or figure out the next move?`;
}
