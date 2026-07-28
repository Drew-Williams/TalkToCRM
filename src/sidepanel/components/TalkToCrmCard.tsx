import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTalkSession } from "../hooks/useTalkSession";
import { useKeyboardShortcutLabel } from "../hooks/useKeyboardShortcutLabel";
import { openMicrophoneOnboarding, openMicrophoneSettings } from "@/lib/chrome/microphone";
import { VoiceIndicator, ShimmerBar } from "./VoiceIndicator";
import { TranscriptCopyButton } from "./TranscriptCopyButton";
import { cn } from "@/lib/utils";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface TalkToCrmCardProps {
  deal: DetectedDeal | null;
}

type VoicePhase = "connecting" | "thinking" | "listening" | "speaking";

const PHASE_LABEL: Record<VoicePhase, string> = {
  connecting: "Connecting…",
  thinking: "Thinking…",
  listening: "Listening…",
  speaking: "Speaking…",
};

/**
 * The actual "Talk" experience — an ElevenLabs voice conversation over
 * WebRTC, with get_deal_snapshot wired to crm-proxy so the agent can read
 * (but not yet write) this specific deal. No dynamic prompt/first-message
 * overrides yet: the agent's Security settings don't have those fields
 * enabled for override, and the base system prompt already covers when to
 * call each client tool — see src/lib/elevenlabs/agent-config.ts.
 *
 * `deal` can go null mid-conversation — the rep switching tabs/apps, or the
 * browser window losing focus, makes useActiveDeal briefly report no deal
 * for the active tab. This component must NOT unmount when that happens: it
 * always renders while a session is connecting/connected regardless of
 * `deal`, specifically so App.tsx (which passes `deal` straight through,
 * un-gated) never tears down an in-progress call just because the rep
 * looked away for a second. useTalkSession still reads `deal` live (via a
 * ref) for get_deal_snapshot, so a real tab switch just means that tool
 * call returns "no deal is open" until the rep looks back — it does not
 * kill the call itself.
 */
export function TalkToCrmCard({ deal }: TalkToCrmCardProps) {
  const { status, mode, transcript, error, micBlocked, start, end } = useTalkSession(deal);
  const shortcutLabel = useKeyboardShortcutLabel("toggle-talk");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // The ElevenLabs SDK only reports "speaking"/"listening" — there's no
  // distinct "thinking" signal. Approximated here as a brief transitional
  // flash right as the agent picks up to speak, which is when a real LLM
  // generation delay would actually show up.
  const [thinking, setThinking] = useState(false);
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === "listening" && mode === "speaking") {
      setThinking(true);
      const timer = setTimeout(() => setThinking(false), 450);
      prevModeRef.current = mode;
      return () => clearTimeout(timer);
    }
    prevModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isActive = status === "connecting" || status === "connected";
  const phase: VoicePhase | null = !isActive
    ? null
    : status === "connecting"
      ? "connecting"
      : thinking
        ? "thinking"
        : mode === "speaking"
          ? "speaking"
          : "listening";

  if (!deal && !isActive) return null;

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 p-3">
        {!isActive && deal && (
          <button
            type="button"
            onClick={start}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span className="pointer-events-none absolute inset-0 rounded-xl animate-pulse-glow" />
            <Mic className="relative h-4 w-4 shrink-0" />
            <span className="relative truncate">Talk about this deal</span>
            {shortcutLabel && (
              <span className="relative shrink-0 rounded border border-slate-950/25 bg-slate-950/10 px-1.5 py-0.5 font-mono text-[10px] tracking-tight">
                {shortcutLabel}
              </span>
            )}
          </button>
        )}

        {isActive && phase && (
          <>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-4">
              {phase === "connecting" || phase === "thinking" ? <ShimmerBar /> : <VoiceIndicator speaking={phase === "speaking"} />}
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{PHASE_LABEL[phase]}</p>
            </div>

            <div className="min-h-[3rem] max-h-48 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              {transcript.length === 0 ? (
                <p className="text-muted-foreground">Live captions will appear here once the conversation gets going…</p>
              ) : (
                transcript.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words">
                      <span className="font-medium text-foreground">{entry.role === "user" ? "You" : "Corner"}: </span>
                      <span className={entry.role === "agent" ? "text-slate-200" : "text-muted-foreground"}>{entry.text}</span>
                    </p>
                    {entry.role === "agent" && <TranscriptCopyButton text={entry.text} />}
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            <Button
              variant="outline"
              className={cn("w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive")}
              onClick={end}
            >
              <PhoneOff className="h-4 w-4" />
              End call
            </Button>
          </>
        )}

        {micBlocked ? (
          <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Microphone access needed
            </p>
            <p className="text-muted-foreground">
              Chrome didn't show a permission prompt here. Try granting access from a full browser tab instead — it's
              more reliable — then come back and click "Talk about this deal" again.
            </p>
            <Button size="sm" className="w-full" onClick={openMicrophoneOnboarding}>
              Grant microphone access in a new tab
            </Button>
            <button
              type="button"
              onClick={openMicrophoneSettings}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Already tried that? Open Chrome's microphone setting directly
            </button>
          </div>
        ) : (
          error && <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
