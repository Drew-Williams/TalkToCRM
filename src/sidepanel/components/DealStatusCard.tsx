import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderBadge } from "./ProviderBadge";
import type { DetectedDeal } from "@/lib/deal-detection/types";

interface DealStatusCardProps {
  deal: DetectedDeal | null;
  loading: boolean;
}

export function DealStatusCard({ deal, loading }: DealStatusCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Looking for a deal on this tab…</CardContent>
      </Card>
    );
  }

  if (!deal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No deal detected</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Open a HubSpot or Pipedrive deal in this window to get started. Talk to CRM reads the deal straight off the
          page you're on — nothing to install on the CRM side.
        </CardContent>
      </Card>
    );
  }

  const crmName = deal.provider === "hubspot" ? "HubSpot" : "Pipedrive";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Deal detected</CardTitle>
        <ProviderBadge provider={deal.provider} />
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Deal ID</dt>
          <dd className="font-mono">{deal.dealId}</dd>
          {deal.accountRef && (
            <>
              <dt className="text-muted-foreground">{deal.provider === "hubspot" ? "Portal" : "Account"}</dt>
              <dd className="font-mono">{deal.accountRef}</dd>
            </>
          )}
        </dl>
        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Open in {crmName}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <p className="text-xs text-muted-foreground">
          Coaching and CRM writes aren't wired up yet — step 1 is just confirming we can reliably see the deal you're
          looking at.
        </p>
      </CardContent>
    </Card>
  );
}
