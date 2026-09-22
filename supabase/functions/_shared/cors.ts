// Wildcard is safe here: every edge function that uses this either requires
// a Supabase JWT (checked in the function body, not by CORS) or is a
// read-only OAuth exchange keyed to the calling user's own token. Extension
// pages call these from a chrome-extension:// origin, which most third-party
// CORS allowlists can't special-case anyway.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}
