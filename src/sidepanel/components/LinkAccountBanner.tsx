import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

const DISMISS_STORAGE_KEY = "corner:linkAccountBannerDismissedAt";
// Reappears the next day rather than staying hidden for the rest of the
// nudge window — a single accidental/impatient dismiss shouldn't mean the
// rep never sees this again before hitting the day-7 paywall cold.
const DISMISS_SNOOZE_MS = 24 * 60 * 60 * 1000;

/**
 * The "day 5 of 7" soft nudge from the reverse-trial funnel: an anonymous
 * rep is invited to link a real email so their sessions/connections survive
 * clearing browser data or reinstalling — not required to keep using
 * Corner (see useSubscription's shouldNudge, which already gates whether
 * this renders at all on trial status/timing).
 *
 * Linking uses Supabase's anonymous-user identity linking
 * (updateUser({ email }) + verifyOtp({ type: "email_change" })), which
 * upgrades the *same* user id to a permanent account — distinct from the
 * old signInWithOtp/verifyOtp(type:"email") pair this project used before
 * the reverse-trial pivot, which creates a brand new session rather than
 * linking the current one.
 *
 * No onLinked callback needed: a successful verifyOtp updates the current
 * session in place, which useSupabaseSession's onAuthStateChange listener
 * already picks up — session.user.is_anonymous flips to false, and
 * useSubscription's shouldNudge (which gates whether this component even
 * renders) recomputes to false on its own.
 */
export function LinkAccountBanner() {
  const [dismissed, setDismissed] = useState(true); // default hidden until the stored dismissal is checked, to avoid a flash
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(DISMISS_STORAGE_KEY).then((result) => {
      const dismissedAt = result[DISMISS_STORAGE_KEY] as number | undefined;
      setDismissed(!!dismissedAt && Date.now() - dismissedAt < DISMISS_SNOOZE_MS);
    });
  }, []);

  function dismiss() {
    setDismissed(true);
    chrome.storage.local.set({ [DISMISS_STORAGE_KEY]: Date.now() });
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ email });
    setPending(false);
    if (updateError) {
      // Most common case per Supabase's own docs: this email already
      // belongs to an existing permanent account. Merging that account's
      // data with this trial isn't handled here — out of scope for the
      // nudge banner — so the rep is pointed at signing into that account
      // via Corner's marketing site instead.
      setError(
        updateError.message.toLowerCase().includes("already")
          ? "That email is already linked to a different Corner account. Sign in to that one from corner's website instead."
          : updateError.message,
      );
      return;
    }
    setStage("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "email_change" });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message);
    }
  }

  if (dismissed) return null;

  return (
    <Card className="mb-3 border-primary/40">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="min-w-0 break-words text-base">
          {stage === "email" ? "Save your sessions" : `Enter the code we emailed to ${email}`}
        </CardTitle>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        {stage === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add an email so your CRM connections and sessions aren't lost if you clear browser data or switch computers.
            </p>
            <Input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" size="sm" className="w-full" disabled={pending}>
              {pending ? "Sending code…" : "Save my account"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm" className="w-full" disabled={pending}>
              {pending ? "Verifying…" : "Verify code"}
            </Button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
