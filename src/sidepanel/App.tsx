import { useState } from "react";
import { Settings } from "lucide-react";
import { useActiveDeal } from "./hooks/useActiveDeal";
import { useSupabaseSession } from "./hooks/useSupabaseSession";
import { useCrmConnections } from "./hooks/useCrmConnections";
import { useSubscription } from "./hooks/useSubscription";
import { useOnboardingFlags } from "./hooks/useOnboardingFlags";
import { DealStatusCard } from "./components/DealStatusCard";
import { ConnectCrmCard } from "./components/ConnectCrmCard";
import { ProfileCard } from "./components/ProfileCard";
import { ProfileNudgeBanner } from "./components/ProfileNudgeBanner";
import { CrmStatusBadges } from "./components/CrmStatusBadges";
import { TalkToCrmCard } from "./components/TalkToCrmCard";
import { PaywallView } from "./components/PaywallView";
import { LinkAccountBanner } from "./components/LinkAccountBanner";
import { TrialStatusBar } from "./components/TrialStatusBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { dismissProfileNudge } from "@/lib/onboarding/state";

export default function App() {
  const { deal, loading: dealLoading, refresh: refreshActiveDeal } = useActiveDeal();
  const { session, loading: sessionLoading } = useSupabaseSession();
  const { connections, loading: connectionsLoading, refresh: refreshConnections } = useCrmConnections(!!session);

  // Connecting a CRM's OAuth popup can close and return focus without ever
  // actually deactivating/reactivating the deal tab, which is the trigger
  // useActiveDeal normally listens for — see that hook's own comment on why
  // its window-focus-based fallback for this isn't fully reliable on its
  // own. Re-resolving the active deal directly, tied to the real "a CRM
  // connection just finished" event, is the deterministic fix layered on
  // top of that.
  function handleCrmConnected() {
    refreshConnections();
    refreshActiveDeal();
  }
  const {
    subscription,
    isActive: subscriptionActive,
    daysRemaining,
    shouldNudge,
    loading: subscriptionLoading,
    refresh: refreshSubscription,
  } = useSubscription(session);

  // An anonymous session has no recovery path at all (no email, no
  // password) — signing out of one is permanent data loss with no warning,
  // so the option is hidden until there's a real account to sign back into.
  const canSignOut = !!session && !session.user.is_anonymous;

  const [crmSettingsOpen, setCrmSettingsOpen] = useState(false);
  const hasAnyConnection = Object.keys(connections).length > 0;
  // The full connect card stays open until at least one CRM is hooked
  // up (nothing to hide behind the cog yet) — after that, it's tucked away
  // by default and only reappears when the cog is clicked.
  const showConnectCard = crmSettingsOpen || (!connectionsLoading && !hasAnyConnection);

  // Connect → Talk → Customize (mem/design/onboarding-v1.md): before a CRM
  // is connected, the panel below the header is ConnectCrmCard and nothing
  // else — no ProfileCard, no cog — so the very first open asks for
  // exactly one thing. Personalization only becomes reachable, and only
  // gets actively surfaced, once the rep has already connected and (per
  // the nudge below) had a first conversation.
  const { hasCompletedFirstCall, profileNudgeDismissed } = useOnboardingFlags();
  const showProfileNudge = hasAnyConnection && hasCompletedFirstCall && !profileNudgeDismissed && !showConnectCard;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background px-3 py-4 text-foreground">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Corner</h1>
          <p className="truncate text-xs text-muted-foreground">The private deal coach you talk to.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CrmStatusBadges connections={connections} loading={connectionsLoading} />
          {hasAnyConnection && (
            <button
              type="button"
              onClick={() => setCrmSettingsOpen((v) => !v)}
              aria-label="Manage CRM connections"
              aria-pressed={showConnectCard}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          {canSignOut && (
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          )}
        </div>
      </header>

      {sessionLoading || subscriptionLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !subscriptionActive ? (
        <PaywallView subscription={subscription} onRefresh={refreshSubscription} />
      ) : (
        <>
          {subscription?.status === "trialing" && <TrialStatusBar daysRemaining={daysRemaining} onRefresh={refreshSubscription} />}
          {shouldNudge && <LinkAccountBanner />}
          {showConnectCard && (
            <>
              <ConnectCrmCard connections={connections} loading={connectionsLoading} onConnected={handleCrmConnected} />
              {hasAnyConnection && <ProfileCard />}
            </>
          )}
          <DealStatusCard deal={deal} loading={dealLoading} onReconnected={handleCrmConnected} />
          <TalkToCrmCard deal={deal} />
          {showProfileNudge && (
            <ProfileNudgeBanner
              onSetUpProfile={() => {
                setCrmSettingsOpen(true);
                dismissProfileNudge();
              }}
              onDismiss={dismissProfileNudge}
            />
          )}
        </>
      )}
    </div>
  );
}
