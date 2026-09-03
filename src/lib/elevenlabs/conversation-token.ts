import { supabase } from "@/lib/supabase/client";
import { ELEVENLABS_AGENT_ID } from "./agent-config";

/**
 * Mints a short-lived WebRTC conversation token via the elevenlabs-
 * conversation-token edge function — the extension never calls ElevenLabs
 * directly for this, so ELEVENLABS_API_KEY never has to leave the edge
 * function. See that function for why WebRTC rather than WebSocket.
 */
export async function fetchConversationToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("You're signed out — sign in again and retry.");
  }

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-conversation-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ agentId: ELEVENLABS_AGENT_ID }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || "Failed to start a voice session.");
  }
  return body.token as string;
}
