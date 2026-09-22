import { Sparkles, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfileNudgeBannerProps {
  onSetUpProfile: () => void;
  onDismiss: () => void;
}

/**
 * Stage 3 of the Connect → Talk → Customize funnel (see
 * mem/design/onboarding-v1.md) — shown once, only after the rep's first
 * call has actually finished, never before. Personalization is pitched
 * here as "make the next conversation better," not as setup standing
 * between the rep and their first call.
 */
export function ProfileNudgeBanner({ onSetUpProfile, onDismiss }: ProfileNudgeBannerProps) {
  return (
    <Card className="mb-3 border-primary/40">
      <CardContent className="flex items-start gap-2.5 p-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-foreground">
            Want Corner to sound like it already knows you? Add your name and company — takes 30 seconds.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onSetUpProfile}>
              Set up profile
            </Button>
            <button type="button" onClick={onDismiss} className="text-xs text-muted-foreground hover:underline">
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
