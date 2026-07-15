import { Badge } from "@/components/ui/badge";
import type { CrmProvider } from "@/lib/deal-detection/types";

const PROVIDER_LABELS: Record<CrmProvider, string> = {
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
};

export function ProviderBadge({ provider }: { provider: CrmProvider }) {
  return <Badge variant="secondary">{PROVIDER_LABELS[provider]}</Badge>;
}
