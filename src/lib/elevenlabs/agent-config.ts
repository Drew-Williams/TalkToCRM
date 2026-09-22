// The live session (starting a conversation, mid-call client tools,
// transcript wiring) is built — see useTalkSession.ts, client-tools.ts, and
// TalkToCrmCard.tsx.
//
// overrides.agent.firstMessage is now used (see useTalkSession.ts +
// session-start-prompt.ts): enabled under this agent's Security settings
// (conversation_config_override.agent.first_message, via the Convai API —
// disabled by default, passing it before enabling it would throw) so the
// greeting can open with the actual deal already summarized, built from
// data the extension fetched itself, rather than the agent's static
// default ("I'm ready. Open a deal and ask me...").
//
// overrides.agent.prompt.prompt (the full session-start *system prompt*,
// not just the greeting) is deliberately still NOT enabled or used. Unlike
// firstMessage, prompt.prompt is a complete *replacement* of the base
// system prompt, not an append — the base prompt carries the tool-usage
// instructions for all six configured client tools (when to call
// get_recent_activities vs. get_deal_snapshot, the two-step confirmation
// rules for push_to_crm, etc.), so building a replacement would need to
// reproduce all of that first. Revisit only once there's an actual need for
// deal-specific *system-prompt* context beyond what a good greeting and the
// client tools already cover.
export const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
