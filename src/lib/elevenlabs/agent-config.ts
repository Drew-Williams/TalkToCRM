// The live session (starting a conversation, mid-call client tools,
// transcript wiring) is built — see useTalkSession.ts, client-tools.ts, and
// TalkToCrmCard.tsx. This file now only holds the agent ID plus the
// ConversationOverrides shape for a still-unused future step.
//
// Per the brief, sessions were meant to use per-session dynamic overrides
// rather than a static agent-level prompt:
//   overrides.agent.prompt.prompt      — the assembled session-start prompt
//   overrides.agent.firstMessage       — the dynamic opening line
// Neither is actually passed to startSession() yet: checked directly via the
// Convai API, this agent's Security settings don't have `first_message` or
// `prompt.prompt` enabled under conversation_config_override, so passing
// either would throw. `prompt.prompt` is also a full *replacement* of the
// base system prompt (not an append) — the base prompt already has the
// tool-usage instructions for all six configured client tools, so replacing
// it from the extension would need to reproduce all of that first. Once
// those override fields are enabled (and, for prompt.prompt, once whatever
// builds the replacement also carries forward the base instructions), a
// session-start-prompt.ts using this shape can build one from a
// DealSnapshot to open with deal-specific context instead of the agent's
// static default first message.

export const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export interface ConversationOverrides {
  agent: {
    prompt: {
      prompt: string;
    };
    firstMessage: string;
  };
}
