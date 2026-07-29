import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderBadge } from "./ProviderBadge";
import { ShimmerBar } from "./VoiceIndicator";
import { useDealSnapshot } from "../hooks/useDealSnapshot";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface DealStatusCardProps {
  deal: DetectedDeal | null;
  loading: boolean;
}

function formatAmount(amountCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (amountCents == null) return null;
  return (amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  });
}

export function DealStatusCard({ deal, loading }: DealStatusCardProps) {
  const { snapshot, loading: snapshotLoading } = useDealSnapshot(deal);

  if (loading) {
    return (
      <Card className="mb-3">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
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

  const crmName = deal.provider === "hubspot" ? "HubSpot" : "Pipedrive";
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

        <div className="flex items-center justify-between gap-2 text-xs">
          <a
            href={deal.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Open in {crmName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <span className="shrink-0 text-muted-foreground">Read-only for now</span>
        </div>
      </CardContent>
    </Card>
  );
}
