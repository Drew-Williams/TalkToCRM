import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CrmProvider } from "@/lib/deal-detection/types";

export interface CrmConnectionInfo {
  accountRef: string | null;
}

type ConnectionsState = Partial<Record<CrmProvider, CrmConnectionInfo>>;

/**
 * Reads from the crm_connections_status VIEW, never the base crm_connections
 * table — the view deliberately excludes access_token/refresh_token so the
 * extension can render connection state without ever touching raw tokens.
 */
export function useCrmConnections(signedIn: boolean) {
  const [connections, setConnections] = useState<ConnectionsState>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setConnections({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("crm_connections_status").select("provider, account_ref");
    if (!error && data) {
      const next: ConnectionsState = {};
      for (const row of data as Array<{ provider: CrmProvider; account_ref: string | null }>) {
        next[row.provider] = { accountRef: row.account_ref };
      }
      setConnections(next);
    }
    setLoading(false);
  }, [signedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { connections, loading, refresh };
}
