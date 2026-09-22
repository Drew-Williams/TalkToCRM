// Read-only scopes only, matching step 2's "reads only in this step" scope.
// Write scopes (crm.objects.deals.write) get added when push_to_crm lands.
const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.owners.read",
].join(" ");

export function buildHubspotAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_HUBSPOT_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: HUBSPOT_SCOPES,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}
