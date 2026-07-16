import { useActiveDeal } from "./hooks/useActiveDeal";
import { useSupabaseSession } from "./hooks/useSupabaseSession";
import { useCrmConnections } from "./hooks/useCrmConnections";
import { DealStatusCard } from "./components/DealStatusCard";
import { SignInView } from "./components/SignInView";
import { ConnectCrmCard } from "./components/ConnectCrmCard";
import { TalkToCrmCard } from "./components/TalkToCrmCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export default function App() {
  const { deal, loading: dealLoading } = useActiveDeal();
  const { session, loading: sessionLoading } = useSupabaseSession();
  const { connections, loading: connectionsLoading, refresh: refreshConnections } = useCrmConnections(!!session);

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Corner</h1>
          <p className="text-sm text-muted-foreground">The private deal coach you talk to.</p>
        </div>
        {session && (
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        )}
      </header>

      {sessionLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !session ? (
        <SignInView />
      ) : (
        <>
          <ConnectCrmCard connections={connections} loading={connectionsLoading} onConnected={refreshConnections} />
          <DealStatusCard deal={deal} loading={dealLoading} />
          <TalkToCrmCard deal={deal} />
        </>
      )}
    </div>
  );
}
