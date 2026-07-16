import { useEffect, useRef } from "react";
import { Mic, PhoneOff, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTalkSession } from "../hooks/useTalkSession";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface TalkToCrmCardProps {
  deal: DetectedDeal | null;
}

// Takes the rep straight to Chrome's permission toggle for this exact
// extension, rather than a generic "check your settings" instruction —
// chrome://settings/content/siteDetails?site=<origin> opens Chrome's
// per-origin permission page pre-scoped to this extension's own
// chrome-extension:// origin, where microphone access shows up as
// "Blocked" with a one-click dropdown to change it to "Allow." This is the
// same fix documented for this exact "permission silently denied, never
// visibly prompted" failure mode in Chrome's own extension-samples issue
// tracker — there's no way to make the prompt itself reliably appear, so
// this is the fastest path to the guaranteed-correct manual fix.
function openMicrophoneSettings() {
  const origin = `chrome-extension://${chrome.runtime.id}/`;
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}` }).catch(() => {
    // Opening chrome://settings can fail if disallowed by an enterprise
    // policy. The plain-text error alongside this button already tells the
    // rep the general fix if this doesn't work.
  });
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
  const { status, mode, transcript, error, micBlocked, start, end } = useTalkSession(deal);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isActive = status === "connecting" || status === "connected";

  if (!deal && !isActive) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Talk it through</CardTitle>
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

        {micBlocked ? (
          <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Microphone is blocked for this extension
            </p>
            <p className="text-muted-foreground">
              Chrome didn't show a permission prompt, so it's likely already set to "Block." Click below to open the
              exact setting, change Microphone to "Allow," then come back and click "Talk about this deal" again.
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={openMicrophoneSettings}>
              Open microphone settings
            </Button>
          </div>
        ) : (
          error && <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
