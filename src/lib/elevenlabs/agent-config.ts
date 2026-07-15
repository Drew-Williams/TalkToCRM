// Placeholder scaffold only — the live session (starting a conversation,
// mid-call client tools, transcript wiring) is step 4 work and isn't built
// yet. This file exists now so the agent ID has exactly one place to land
// once you create the new ElevenLabs agent (see the project brief: "a fresh
// agent, not the voice-agent-site agent").
//
// Per the brief, sessions use per-session dynamic overrides rather than a
// static agent-level prompt:
//   overrides.agent.prompt.prompt      — the assembled session-start prompt
//   overrides.agent.firstMessage       — the dynamic opening line
// ConversationOverrides mirrors the shape the ElevenLabs SDK's
// startSession({ overrides }) call expects; session-start-prompt.ts (step 4)
// will be the thing that actually builds one of these from a DealSnapshot.

export const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export interface ConversationOverrides {
  agent: {
    prompt: {
      prompt: string;
    };
    firstMessage: string;
  };
}
