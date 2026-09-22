import { useEffect, useState } from "react";
import { Mic, CircleCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryMicrophonePermission, openMicrophoneSettings } from "@/lib/chrome/microphone";

type Status = "checking" | "granted" | "prompt" | "denied" | "requesting";

/**
 * A real full browser tab, not the side panel — this is the whole point of
 * this page. Chrome's getUserMedia permission prompt has a documented
 * reliability problem specifically inside side panels (it can silently
 * auto-deny without ever showing a dialog). Requesting the *same*
 * microphone permission from a normal tab of this extension is more
 * reliable, and since Chrome grants media permissions per *origin*
 * (chrome-extension://<id>), not per-page, a grant here covers the side
 * panel too — nothing else needs to ask again.
 *
 * Registered as this extension's options page (see manifest.config.ts) so
 * it can be opened via chrome.runtime.openOptionsPage() from anywhere in
 * the extension — both proactively right after install
 * (src/background/index.ts) and on demand from TalkToCrmCard's
 * mic-blocked alert.
 */
export default function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    queryMicrophonePermission().then((state) => {
      setStatus(state ?? "prompt");
    });
  }, []);

  async function requestAccess() {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus("granted");
    } catch {
      setStatus("denied");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Microphone access
          </CardTitle>
          <CardDescription>Corner needs your microphone to talk with you about your deals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "checking" && <p className="text-sm text-muted-foreground">Checking current permission…</p>}

          {status === "granted" && (
            <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 p-3 text-sm">
              <CircleCheck className="h-4 w-4 shrink-0 text-primary" />
              <p>Microphone access is granted. You can close this tab and go back to Corner's side panel.</p>
            </div>
          )}

          {(status === "prompt" || status === "requesting") && (
            <Button className="w-full" onClick={requestAccess} disabled={status === "requesting"}>
              {status === "requesting" ? "Requesting…" : "Allow microphone access"}
            </Button>
          )}

          {status === "denied" && (
            <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                Microphone access was denied
              </p>
              <p className="text-muted-foreground">
                Chrome may have blocked this without showing a prompt. Click below to open the exact setting and
                change Microphone to "Allow," then come back to this tab and try again.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={openMicrophoneSettings}>
                Open microphone settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
