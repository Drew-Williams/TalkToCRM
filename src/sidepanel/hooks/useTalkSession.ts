import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation, type Conversation as ConversationInstance } from "@elevenlabs/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { ExtensionMessage } from "@/lib/chrome/messaging";
import { buildClientTools } from "@/lib/elevenlabs/client-tools";
import { fetchConversationToken } from "@/lib/elevenlabs/conversation-token";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";
import { buildFirstMessage } from "@/lib/elevenlabs/session-start-prompt";
import { queryMicrophonePermission } from "@/lib/chrome/microphone";

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
      // Check the current permission state first, without prompting —
      // "granted" (e.g. already fixed via the onboarding tab, or via
      // chrome://settings) skips the warmup below entirely, and "denied"
      // skips straight to the mic-blocked UI instead of wasting a doomed
      // getUserMedia attempt first. Only "prompt" (or an unrecognized
      // state — treat the same as "prompt") actually needs the warmup.
      const permissionState = await queryMicrophonePermission();

      if (permissionState === "denied") {
        setStatus("ended");
        setMicBlocked(true);
        setError("Microphone access is blocked for this extension.");
        return;
      }

      if (permissionState !== "granted") {
        // Request (and immediately release) the mic *before* any network
        // call. getUserMedia's permission prompt needs to fire right on
        // the click's user-gesture, with no async gap first — otherwise
        // Chrome can silently auto-dismiss it ("NotAllowedError:
        // Permission dismissed") without the rep ever seeing a prompt to
        // respond to. fetchConversationToken() below is itself an async
        // network round-trip, so it must come after this, not before.
        //
        // In practice this prompt sometimes never visibly appears at all
        // inside a side panel specifically (a documented Chrome
        // reliability issue, not a bug in this app) — leaving the origin
        // blocked with no dialog ever shown. There's no code fix for that
        // particular quirk, so micBlocked drives the rep to a full-tab
        // page (src/onboarding) where the same permission request is more
        // reliable, rather than just an explanation to act on themselves.
        try {
          const warmupStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          warmupStream.getTracks().forEach((track) => track.stop());
        } catch {
          setStatus("ended");
          setMicBlocked(true);
          setError("Microphone access is blocked for this extension.");
          return;
        }
      }

      // Fetched in parallel, not sequence — independent network calls, and
      // this is already the delay between clicking "Talk" and the call
      // actually starting, so it's worth not stacking them. If there's no
      // deal open, or crm-proxy fails for any reason (not connected, token
      // expired, deal deleted, etc.), firstMessage is simply omitted below
      // and the agent falls back to its own static default greeting —
      // this is a nice-to-have, not something worth blocking or erroring
      // the whole call over.
      const [conversationToken, snapshotResult] = await Promise.all([
        fetchConversationToken(),
        dealRef.current ? fetchDealSnapshot(dealRef.current) : Promise.resolve(null),
      ]);
      const firstMessage = snapshotResult && "snapshot" in snapshotResult ? buildFirstMessage(snapshotResult.snapshot) : undefined;

      const conversation = await Conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        ...(firstMessage ? { overrides: { agent: { firstMessage } } } : {}),
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

  // "toggle-talk" keyboard shortcut (background broadcasts TOGGLE_TALK — see
  // src/background/index.ts). Toggles based on current status: idle/ended
  // starts a call (only if a deal is actually open — silently a no-op
  // otherwise, matching the hero button's own disabled-when-no-deal state),
  // connecting/connected ends it.
  useEffect(() => {
    function onMessage(message: ExtensionMessage) {
      if (message.type !== "TOGGLE_TALK") return;
      if (status === "connecting" || status === "connected") {
        end();
      } else if (dealRef.current) {
        start();
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [status, start, end]);

  return { status, mode, transcript, error, micBlocked, start, end };
}
