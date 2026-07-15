import { useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

// Email + one-time code, not a magic link: a link would open in a new browser
// tab and there's no reliable way to hand that tab's resulting session back
// into the side panel's own document. A typed code needs no redirect at all.
export function SignInView() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setPending(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setStage("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message);
    }
    // On success, onAuthStateChange in useSupabaseSession picks up the new
    // session automatically — nothing else to do here.
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          {stage === "email"
            ? "Sign in to connect HubSpot or Pipedrive and get coached on your deals."
            : `Enter the 6-digit code we just emailed to ${email}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stage === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-3">
            <Input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending code…" : "Send sign-in code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <Input
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Verifying…" : "Verify code"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => {
                setStage("email");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
