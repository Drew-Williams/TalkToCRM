import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation, type Conversation as ConversationInstance } from "@elevenlabs/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import { buildClientTools } from "@/lib/elevenlabs/client-tools";
import { fetchConversationToken } from "@/lib/elevenlabs/conversation-token";

export interface TranscriptEntry {
  id: number;
  role: "user" | "agent";
  text: string;
}

export type TalkSessionStatus = "idle" | "connecting" | "connected" | "ended";

/**
 * Manages one ElevenLabs voice conversation. `deal` is read through a ref
 * (dealRef) rather than closed over directly so a rep switching tabs
 * mid-conversation doesn't require restarting the session for
 * get_deal_snapshot to pick up the new deal.
 */
export function useTalkSession(deal: DetectedDeal | null) {
  const [status, setStatus] = useState<TalkSessionStatus>("idle");
  const [mode, setMode] = useState<"speaking" | "listening">("listening");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dealRef = useRef(deal);
  dealRef.current = deal;
  const conversationRef = useRef<ConversationInstance | null>(null);
  const nextEntryIdRef = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setStatus("connecting");
    try {
      const conversationToken = await fetchConversationToken();
      const conversation = await Conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        clientTools: buildClientTools(() => dealRef.current),
        onStatusChange: ({ status: nextStatus }) => {
          if (nextStatus === "connected") setStatus("connected");
          else if (nextStatus === "disconnected") setStatus("ended");
        },
        onModeChange: ({ mode: nextMode }) => setMode(nextMode),
        onMessage: ({ role, message }) => {
          setTranscript((prev) => [...prev, { id: nextEntryIdRef.current++, role, text: message }]);
        },
        onError: (message) => setError(message),
        onDisconnect: (details) => {
          if (details.reason === "error") setError(details.message);
        },
      });
      conversationRef.current = conversation;
    } catch (e) {
      setStatus("ended");
      setError(e instanceof Error ? e.message : "Failed to start the voice session.");
    }
  }, []);

  const end = useCallback(async () => {
    await conversationRef.current?.endSession();
    conversationRef.current = null;
    setStatus("ended");
  }, []);

  // Belt-and-suspenders: if the side panel itself is closed/unmounted mid-call
  // (not just navigated away from), don't leave the mic hot in the background.
  useEffect(() => {
    return () => {
      conversationRef.current?.endSession();
    };
  }, []);

  return { status, mode, transcript, error, start, end };
}
