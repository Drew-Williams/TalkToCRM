import { useActiveDeal } from "./hooks/useActiveDeal";
import { useSupabaseSession } from "./hooks/useSupabaseSession";
import { useCrmConnections } from "./hooks/useCrmConnections";
import { useSubscription } from "./hooks/useSubscription";
import { DealStatusCard } from "./components/DealStatusCard";
import { ConnectCrmCard } from "./components/ConnectCrmCard";
import { TalkToCrmCard } from "./components/TalkToCrmCard";
import { PaywallView } from "./components/PaywallView";
import { LinkAccountBanner } from "./components/LinkAccountBanner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export default function App() {
  const { deal, loading: dealLoading } = useActiveDeal();
  const { session, loading: sessionLoading } = useSupabaseSession();
  const { connections, loading: connectionsLoading, refresh: refreshConnections } = useCrmConnections(!!session);
  const {
    subscription,
    isActive: subscriptionActive,
    shouldNudge,
    loading: subscriptionLoading,
    refresh: refreshSubscription,
  } = useSubscription(session);

  // An anonymous session has no recovery path at all (no email, no
  // password) — signing out of one is permanent data loss with no warning,
  // so the option is hidden until there's a real account to sign back into.
  const canSignOut = !!session && !session.user.is_anonymous;

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Corner</h1>
          <p className="text-sm text-muted-foreground">The private deal coach you talk to.</p>
        </div>
        {canSignOut && (
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        )}
      </header>

      {sessionLoading || subscriptionLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !subscriptionActive ? (
        <PaywallView subscription={subscription} onRefresh={refreshSubscription} />
      ) : (
        <>
          {shouldNudge && <LinkAccountBanner />}
          <ConnectCrmCard connections={connections} loading={connectionsLoading} onConnected={refreshConnections} />
          <DealStatusCard deal={deal} loading={dealLoading} />
          <TalkToCrmCard deal={deal} />
        </>
      )}
    </div>
  );
}
