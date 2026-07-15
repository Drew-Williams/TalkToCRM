import { useEffect, useRef } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTalkSession } from "../hooks/useTalkSession";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface TalkToCrmCardProps {
  deal: DetectedDeal | null;
}

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
  const { status, mode, transcript, error, start, end } = useTalkSession(deal);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isActive = status === "connecting" || status === "connected";

  if (!deal && !isActive) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Talk to CRM</CardTitle>
        {status === "connected" && <Badge variant={mode === "speaking" ? "default" : "secondary"}>{mode}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!isActive && deal && (
          <Button className="w-full" onClick={start}>
            <Mic className="h-4 w-4" />
            Talk about this deal
          </Button>
        )}

        {status === "connecting" && (
          <p className="text-sm text-muted-foreground">Connecting…</p>
        )}

        {isActive && (
          <>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm">
              {transcript.length === 0 ? (
                <p className="text-muted-foreground">Listening…</p>
              ) : (
                transcript.map((entry) => (
                  <p key={entry.id}>
                    <span className="font-medium">{entry.role === "user" ? "You" : "Agent"}: </span>
                    <span className={entry.role === "agent" ? "text-foreground" : "text-muted-foreground"}>
                      {entry.text}
                    </span>
                  </p>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
            <Button variant="destructive" className="w-full" onClick={end}>
              <PhoneOff className="h-4 w-4" />
              End call
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
