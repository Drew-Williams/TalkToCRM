import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { connectCrm } from "@/lib/crm-connect/connect";
import type { CrmConnectionInfo } from "../hooks/useCrmConnections";
import type { CrmProvider } from "@/lib/deal-detection/types";

interface ConnectCrmCardProps {
  connections: Partial<Record<CrmProvider, CrmConnectionInfo>>;
  loading: boolean;
  onConnected: () => void;
}

const PROVIDERS: Array<{ id: CrmProvider; label: string }> = [
  { id: "hubspot", label: "HubSpot" },
  { id: "pipedrive", label: "Pipedrive" },
];

export function ConnectCrmCard({ connections, loading, onConnected }: ConnectCrmCardProps) {
  const [connectingProvider, setConnectingProvider] = useState<CrmProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(provider: CrmProvider) {
    setError(null);
    setConnectingProvider(provider);
    try {
      await connectCrm(provider);
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to connect ${provider}.`);
    } finally {
      setConnectingProvider(null);
    }
  }

  return (
    <Card className="mb-3">
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="text-sm">CRM connections</CardTitle>
        <CardDescription className="text-xs">Connect the CRM you sell in so Corner can read your deals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-1.5">
        {PROVIDERS.map(({ id, label }) => {
          const connection = connections[id];
          const isConnecting = connectingProvider === id;
          return (
            <div key={id} className="flex min-w-0 items-center justify-between gap-2">
              <span className="shrink-0 text-sm">{label}</span>
              {loading ? (
                <span className="text-xs text-muted-foreground">…</span>
              ) : connection ? (
                <span className="truncate text-xs text-muted-foreground">
                  Connected{connection.accountRef ? ` as ${connection.accountRef}` : ""}
                </span>
              ) : (
                <Button size="sm" variant="outline" disabled={isConnecting} onClick={() => handleConnect(id)}>
                  {isConnecting ? "Connecting…" : `Connect ${label}`}
                </Button>
              )}
            </div>
          );
        })}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
