import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation, type Conversation as ConversationInstance } from "@elevenlabs/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { ExtensionMessage } from "@/lib/chrome/messaging";
import { buildClientTools } from "@/lib/elevenlabs/client-tools";
import { fetchConversationToken } from "@/lib/elevenlabs/conversation-token";
import { fetchDealSnapshot } from "@/lib/crm-proxy/get-deal-snapshot";
import { fetchRecentActivities } from "@/lib/crm-proxy/get-recent-activities";
import { buildActivityDigest, buildFirstMessage } from "@/lib/elevenlabs/session-start-prompt";
import { queryMicrophonePermission } from "@/lib/chrome/microphone";
import { fetchLatestMemory } from "@/lib/coaching-memory/get-memory";
import { fetchUserProfile } from "@/lib/user-profile/get-profile";
import { supabase } from "@/lib/supabase/client";

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
  // ElevenLabs' own conversation id, captured right as the session opens —
  // this is what the post-call summary UI (usePostCallSummary.ts) polls
  // coaching_memory for once the call ends, since that table's rows are
  // keyed by this same id (see the webhook that writes them).
  const [conversationId, setConversationId] = useState<string | null>(null);

  const dealRef = useRef(deal);
  dealRef.current = deal;
  const conversationRef = useRef<ConversationInstance | null>(null);
  const nextEntryIdRef = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    setMicBlocked(false);
    setTranscript([]);
    setConversationId(null);
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
      // the whole call over. Same for coaching memory: a failed/empty
      // lookup just means no "last time..." callback in the greeting.
      const [conversationToken, snapshotResult, memory, sessionData, profile, activitiesResult] = await Promise.all([
        fetchConversationToken(),
        dealRef.current ? fetchDealSnapshot(dealRef.current) : Promise.resolve(null),
        dealRef.current ? fetchLatestMemory(dealRef.current) : Promise.resolve(null),
        supabase.auth.getSession(),
        fetchUserProfile(),
        dealRef.current ? fetchRecentActivities(dealRef.current) : Promise.resolve(null),
      ]);
      const activities = activitiesResult && "activities" in activitiesResult ? activitiesResult.activities : [];
      const activityDigest = buildActivityDigest(activities);
      const firstMessage =
        snapshotResult && "snapshot" in snapshotResult ? buildFirstMessage(snapshotResult.snapshot, memory, profile?.displayName) : undefined;
      const userId = sessionData.data.session?.user.id;
      const deal = dealRef.current;

      const conversation = await Conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        // The SDK's default AudioWorklet loading strategy creates a blob:
        // URL at runtime and addModule()s that — Chrome's default MV3
        // extension_pages CSP (script-src 'self' 'wasm-unsafe-eval', no
        // blob:) blocks that outright, which surfaced as "Failed to load
        // the rawAudioProcessor worklet module" and no audio capture at
        // all. Self-hosting the two worklet scripts (copied from
        // @elevenlabs/client's own generated source into public/, so
        // they're served from this extension's own origin, which *is*
        // covered by 'self') avoids blob: entirely — see
        // createWorkletModuleLoader in the SDK, which explicitly supports
        // this as "the CSP-friendly approach" when a path is provided.
        // Re-copy these two files (from
        // node_modules/@elevenlabs/client/dist/platform/web/*.generated.js,
        // stripping the wrapper import/createWorkletModuleLoader call
        // around the template-literal source) if upgrading
        // @elevenlabs/client ever changes them.
        workletPaths: {
          rawAudioProcessor: chrome.runtime.getURL("audio-worklets/rawAudioProcessor.generated.js"),
          audioConcatProcessor: chrome.runtime.getURL("audio-worklets/audioConcatProcessor.generated.js"),
        },
        ...(firstMessage ? { overrides: { agent: { firstMessage } } } : {}),
        // userId + dynamicVariables round-trip through to the post-call
        // webhook payload (as data.user_id and
        // conversation_initiation_client_data.dynamic_variables
        // respectively) — that's how elevenlabs-post-call-webhook knows
        // which rep and deal a given conversation's summary belongs to,
        // without this app needing to track its own call-to-deal mapping
        // separately. Omitted entirely when there's no deal open (or no
        // signed-in user, which shouldn't happen but is possible if the
        // session expires mid-click) — a coaching memory row with no deal
        // to attach to isn't useful, so the webhook just skips those.
        //
        // corner_rep_name/corner_rep_role/corner_company_* are different —
        // none of those are for the webhook at all, they're referenced
        // directly in the agent's own base prompt (the SELLER IDENTITY and
        // COMPANY CONTEXT sections added via the Convai API) via
        // {{corner_rep_name}} etc. template syntax, so the LLM has this
        // context for the *whole* conversation, not just the scripted
        // opening line.
        //
        // Company profile fields, and now corner_recent_activity, were
        // originally (or in the tool's original design) only reachable via
        // an on-demand client tool — that turned out unreliable in
        // practice for both: the agent has no built-in reason to
        // proactively call a tool just to "get oriented" at the start of a
        // call. Real testing caught this exactly for activity history —
        // the agent only called get_recent_activities after the seller had
        // to twice point out that call/note history existed, since
        // get_deal_snapshot alone doesn't include it. Baking a short
        // digest into the prompt the same way name/role/company profile
        // already work fixes that; get_recent_activities stays wired as a
        // fallback for a longer history than this digest covers.
        //
        // Always included (falling back to empty strings) since the
        // prompt's own placeholder defaults expect that, not an absent
        // variable.
        ...(userId ? { userId } : {}),
        dynamicVariables: {
          ...(deal ? { corner_provider: deal.provider, corner_deal_id: deal.dealId } : {}),
          corner_rep_name: profile?.displayName ?? "",
          corner_rep_role: profile?.role ?? "",
          corner_company_name: profile?.companyName ?? "",
          corner_value_prop: profile?.valueProp ?? "",
          corner_icp: profile?.icp ?? "",
          corner_industry: profile?.industry ?? "",
          corner_competitors: profile?.competitors ?? "",
          corner_recent_activity: activityDigest,
        },
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
      setConversationId(conversation.getId());
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

  return { status, mode, transcript, error, micBlocked, conversationId, start, end };
}
