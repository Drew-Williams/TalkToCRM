import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProviderBadge } from "./ProviderBadge";
import { ShimmerBar } from "./VoiceIndicator";
import { useDealSnapshot } from "../hooks/useDealSnapshot";
import { connectCrm } from "@/lib/crm-connect/connect";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface DealStatusCardProps {
  deal: DetectedDeal | null;
  loading: boolean;
  /** Called after successfully reconnecting a revoked connection, so the header's CRM badge picks up "Connected" again too. */
  onReconnected?: () => void;
}

function formatAmount(amountCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (amountCents == null) return null;
  return (amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  });
}

export function DealStatusCard({ deal, loading, onReconnected }: DealStatusCardProps) {
  const { snapshot, loading: snapshotLoading, errorCode, refresh } = useDealSnapshot(deal);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  async function handleReconnect() {
    if (!deal) return;
    setReconnecting(true);
    setReconnectError(null);
    try {
      await connectCrm(deal.provider);
      refresh();
      onReconnected?.();
    } catch (e) {
      setReconnectError(e instanceof Error ? e.message : "Failed to reconnect.");
    } finally {
      setReconnecting(false);
    }
  }

  if (loading) {
    return (
      <Card className="mb-3">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary shadow-[0_0_6px_rgba(180,62,54,0.7)]" />
            <p className="text-sm text-muted-foreground">Checking this tab for a deal…</p>
          </div>
          <ShimmerBar />
        </CardContent>
      </Card>
    );
  }

  if (!deal) {
    return (
      <Card className="mb-3">
        <CardContent className="space-y-1 p-3">
          <p className="text-sm font-medium text-foreground">No deal detected</p>
          <p className="text-xs text-muted-foreground">
            Open a Pipedrive deal in this window to get started — Corner reads it straight off the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (errorCode === "connection_revoked") {
    const crmName = deal.provider === "hubspot" ? "HubSpot" : "Pipedrive";
    return (
      <Card className="mb-3 border-destructive/40">
        <CardContent className="space-y-2 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {crmName} connection needs reconnecting
          </p>
          <p className="text-xs text-muted-foreground">
            Corner's connection to {crmName} was disconnected or revoked on {crmName}'s side — this deal won't load until
            it's reconnected.
          </p>
          <Button size="sm" className="w-full" onClick={handleReconnect} disabled={reconnecting}>
            {reconnecting ? "Reconnecting…" : `Reconnect ${crmName}`}
          </Button>
          {reconnectError && <p className="text-xs text-destructive">{reconnectError}</p>}
        </CardContent>
      </Card>
    );
  }

  const amount = formatAmount(snapshot?.amountCents, snapshot?.currency);

  return (
    <Card className="mb-3">
      <CardContent className="space-y-2 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            <p className="truncate text-sm font-medium text-foreground" title={snapshot?.name ?? undefined}>
              {snapshot?.name ?? (snapshotLoading ? "Loading deal…" : `Deal ${deal.dealId}`)}
            </p>
          </div>
          <ProviderBadge provider={deal.provider} />
        </div>

        {(amount || snapshot?.stage) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {amount && (
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-slate-200">
                {amount}
              </span>
            )}
            {snapshot?.stage && (
              <span className="max-w-full truncate rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-slate-200">
                {snapshot.stage}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Read-only for now</p>
      </CardContent>
    </Card>
  );
}
