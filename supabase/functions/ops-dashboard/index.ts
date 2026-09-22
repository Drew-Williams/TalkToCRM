// A private, no-SQL-required "CSM/founder dashboard" data source — plain
// JSON on top of the ops_* views
// (supabase/migrations/20260831130000_ops_views.sql,
// 20260831130100_ops_views_trial_accuracy.sql).
//
// This returns JSON, not the rendered dashboard page itself: Supabase
// forcibly rewrites any GET response with a text/html content type to
// text/plain on projects without a paid Custom Domain add-on (anti-abuse
// measure for the shared *.supabase.co domain — see
// https://supabase.com/docs/guides/functions/limits), which was discovered
// by actually trying to serve the dashboard as HTML directly from here and
// finding Chrome received text/plain regardless of the Content-Type header
// this function set. JSON isn't subject to that rewrite, so the actual
// rendering lives client-side in ops-dashboard.html (repo root) instead,
// which fetches from this endpoint.
//
// Auth is a single shared-secret query param (?key=...), not a Supabase
// session — there is no Supabase user calling this, ops-dashboard.html
// calls it directly with the token embedded in it. verify_jwt = false in
// config.toml since there's no bearer token to check at the platform
// level; this function checks its own secret instead. Never share
// ops-dashboard.html or this URL — rotate OPS_DASHBOARD_TOKEN
// (supabase secrets set) if either ever leaks.
import { serviceRoleClient } from "../_shared/auth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const OPS_DASHBOARD_TOKEN = Deno.env.get("OPS_DASHBOARD_TOKEN") ?? "";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  // A 404, not a 401/403 — no reason to confirm this endpoint even exists
  // to an unauthenticated request.
  if (!OPS_DASHBOARD_TOKEN || key !== OPS_DASHBOARD_TOKEN) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const admin = serviceRoleClient();
  const [funnelRes, watchlistRes, lapsedRes, signupsRes, callsRes] = await Promise.all([
    admin.from("ops_funnel_summary").select("*").single(),
    admin.from("ops_trial_watchlist").select("*").order("days_remaining", { ascending: true }).limit(25),
    admin.from("ops_lapsed_trials").select("*").order("trial_end", { ascending: false }).limit(25),
    admin.from("ops_daily_signups").select("day, signups").order("day", { ascending: true }).limit(30),
    admin.from("ops_daily_calls").select("day, calls").order("day", { ascending: true }).limit(30),
  ]);

  if (funnelRes.error) {
    return new Response(JSON.stringify({ error: funnelRes.error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = {
    generatedAt: new Date().toISOString(),
    funnel: funnelRes.data,
    trialWatchlist: watchlistRes.data ?? [],
    lapsedTrials: lapsedRes.data ?? [],
    dailySignups: signupsRes.data ?? [],
    dailyCalls: callsRes.data ?? [],
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
