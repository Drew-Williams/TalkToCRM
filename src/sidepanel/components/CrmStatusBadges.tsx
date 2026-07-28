import type { CrmProvider } from "@/lib/deal-detection/types";
import type { CrmConnectionInfo } from "../hooks/useCrmConnections";

const PROVIDER_LABELS: Record<CrmProvider, string> = {
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
};

interface CrmStatusBadgesProps {
  connections: Partial<Record<CrmProvider, CrmConnectionInfo>>;
  loading: boolean;
}

/**
 * Compact header-level replacement for what used to be a full "CRM
 * connections" card shown at all times — connected providers now show as
 * small pill badges next to the settings cog instead. Renders nothing when
 * there's nothing connected yet (App.tsx keeps the full connect card open
 * in that case, so there's no ambiguity about how to get started).
 */
export function CrmStatusBadges({ connections, loading }: CrmStatusBadgesProps) {
  if (loading) return null;
  const connected = (Object.keys(connections) as CrmProvider[]).filter((provider) => connections[provider]);
  if (connected.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {connected.map((provider) => (
        <span
          key={provider}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-200"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          {PROVIDER_LABELS[provider]}
        </span>
      ))}
    </div>
  );
}
