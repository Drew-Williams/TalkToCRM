import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface SupabaseSessionState {
  session: Session | null;
  /** True until the initial getSession() resolves — avoids a sign-in flash for an already-logged-in rep. */
  loading: boolean;
}

export function useSupabaseSession(): SupabaseSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      // Reverse trial: there's no sign-in gate at first launch — an
      // anonymous Supabase user (auth.users row, `is_anonymous: true` on
      // its JWT) is created silently so a rep can start talking to Corner
      // immediately, no email or card. handle_new_user_trial (a Postgres
      // trigger on auth.users, see supabase/migrations) starts their 7-day
      // trial the instant this row exists — anonymous or not, every
      // account gets the same trial. Linking a real email later
      // (LinkAccountBanner.tsx) upgrades the *same* user id to a permanent
      // account rather than creating a new one, so nothing built during
      // the trial is lost.
      const { data: anonData, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("[useSupabaseSession] anonymous sign-in failed", error);
      }
      setSession(anonData.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
