// Pipedrive scopes are configured on the app itself (Pipedrive Marketplace
// Manager), not passed as a query param like HubSpot — the authorize URL
// only needs client_id + redirect_uri.
export function buildPipedriveAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_PIPEDRIVE_CLIENT_ID,
    redirect_uri: redirectUri,
  });
  return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
}
