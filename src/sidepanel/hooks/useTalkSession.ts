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
  // Distinct from `error` so the UI can show a specific "fix it" button
  // instead of just plain text — this is the one failure mode with an exact,
  // guaranteed-correct fix (a specific settings page to visit), not just an
  // explanation. See openMicrophoneSettings() in TalkToCrmCard.tsx.
  const [micBlocked, setMicBlocked] = useState(false);

  const dealRef = useRef(deal);
  dealRef.current = deal;
  const conversationRef = useRef<ConversationInstance | null>(null);
  const nextEntryIdRef = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    setMicBlocked(false);
    setTranscript([]);
    setStatus("connecting");
    try {
      // Request (and immediately release) the mic *before* any network call.
      // getUserMedia's permission prompt needs to fire right on the click's
      // user-gesture, with no async gap first — otherwise Chrome can silently
      // auto-dismiss it ("NotAllowedError: Permission dismissed") without the
      // rep ever seeing a prompt to respond to. fetchConversationToken()
      // below is itself an async network round-trip, so it must come after
      // this, not before. Once granted, permission persists at the
      // extension's origin, so @elevenlabs/client's own later getUserMedia
      // call (inside startSession) resolves instantly with no second prompt.
      //
      // In practice this prompt sometimes never visibly appears at all —
      // Chrome auto-denies without showing anything, leaving the origin
      // permanently blocked until manually changed in chrome://settings.
      // There's no code fix for that (it's a real, documented Chrome/
      // extension-context quirk, not a bug in this app), so micBlocked
      // drives a direct link to the exact fix rather than just an
      // explanation the rep has to act on themselves.
      try {
        const warmupStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        warmupStream.getTracks().forEach((track) => track.stop());
      } catch {
        setStatus("ended");
        setMicBlocked(true);
        setError("Microphone access is blocked for this extension.");
        return;
      }

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

  return { status, mode, transcript, error, micBlocked, start, end };
}
