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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
