-- "Ops" views — a lightweight, no-build-required CSM/founder dashboard on
-- top of data that already exists. Query these directly in the Supabase
-- SQL Editor (https://supabase.com/dashboard/project/_/sql/new) — that
-- editor runs as the `postgres` role, which bypasses RLS entirely, so
-- these views work there with no extra grants needed.
--
-- Deliberately NOT granted to `authenticated` or `anon` — every one of
-- these is cross-user by design (that's the whole point), so unlike
-- crm_connections_status/subscription_status (per-row RLS, meant for the
-- extension client), these must never be reachable by a signed-in rep's
-- own session. Only the SQL Editor (as postgres) or a service-role-
-- authenticated call can read them.

-- One row per account — the "customer list" view. Start here for "who is
-- this user and how are they doing."
create or replace view public.ops_account_overview as
select
  u.id as user_id,
  u.created_at as signed_up_at,
  u.is_anonymous,
  u.email,
  p.display_name,
  p.role,
  p.company_name,
  (
    select array_agg(distinct c.provider order by c.provider)
    from public.crm_connections c
    where c.user_id = u.id
  ) as connected_providers,
  (
    select min(c.created_at)
    from public.crm_connections c
    where c.user_id = u.id
  ) as first_crm_connected_at,
  s.status as subscription_status,
  s.trial_end,
  s.current_period_end,
  (
    select count(*)
    from public.coaching_memory m
    where m.user_id = u.id
  ) as total_calls,
  (
    select min(m.created_at)
    from public.coaching_memory m
    where m.user_id = u.id
  ) as first_call_at,
  (
    select max(m.created_at)
    from public.coaching_memory m
    where m.user_id = u.id
  ) as last_call_at
from auth.users u
left join public.user_profile p on p.user_id = u.id
left join public.subscriptions s on s.user_id = u.id;

comment on view public.ops_account_overview is
  'One row per account: signup, CRM connection, subscription, and call activity. SQL Editor only — see file header.';

-- New accounts per day, split anonymous (install-and-go, per the reverse
-- trial funnel) vs. identified (linked an email at some point) — the
-- top-of-funnel number everything else is a percentage of.
create or replace view public.ops_daily_signups as
select
  date_trunc('day', u.created_at)::date as day,
  count(*) as signups,
  count(*) filter (where u.is_anonymous) as anonymous_signups,
  count(*) filter (where not u.is_anonymous) as identified_signups
from auth.users u
group by 1
order by 1 desc;

comment on view public.ops_daily_signups is
  'New accounts per day, anonymous vs. identified. SQL Editor only.';

-- Calls (coaching_memory rows, one per completed ElevenLabs conversation —
-- see 20260728180000_coaching_memory.sql) per day. The core usage metric:
-- installs and connections are necessary but not sufficient, this is
-- whether the product is actually being used for its one job.
create or replace view public.ops_daily_calls as
select
  date_trunc('day', m.created_at)::date as day,
  count(*) as calls,
  count(distinct m.user_id) as reps_who_talked
from public.coaching_memory m
group by 1
order by 1 desc;

comment on view public.ops_daily_calls is
  'Completed coaching calls per day, and how many distinct reps had one. SQL Editor only.';

-- Single-row snapshot of the whole funnel, right now: signup -> connect a
-- CRM -> complete a first call -> convert to paid. Run this one query for
-- "how's Corner doing" instead of piecing it together from four different
-- dashboards (Chrome Web Store, Supabase, Stripe, ElevenLabs).
create or replace view public.ops_funnel_summary as
select
  (select count(*) from auth.users) as total_accounts,
  (select count(distinct user_id) from public.crm_connections) as connected_crm,
  (select count(distinct user_id) from public.coaching_memory) as completed_first_call,
  (select count(*) from public.subscriptions where status = 'trialing') as currently_trialing,
  (select count(*) from public.subscriptions where status = 'active') as active_paid,
  (select count(*) from public.subscriptions where status in ('past_due', 'unpaid', 'incomplete')) as payment_issue,
  (select count(*) from public.subscriptions where status = 'canceled') as canceled;

comment on view public.ops_funnel_summary is
  'One-row funnel snapshot: accounts -> CRM connected -> first call done -> trial/paid/lapsed. SQL Editor only.';

-- Currently-trialing accounts, most urgent (soonest-expiring) first, with
-- the two signals that predict whether they'll convert: did they ever
-- connect a CRM, and did they ever actually complete a call. A trialing
-- account with neither, two days from expiry, is exactly who a CSM would
-- want to nudge before the trial lapses.
create or replace view public.ops_trial_watchlist as
select
  u.id as user_id,
  u.email,
  p.display_name,
  s.trial_end,
  extract(day from s.trial_end - now())::int as days_remaining,
  exists(select 1 from public.crm_connections c where c.user_id = u.id) as has_connected_crm,
  exists(select 1 from public.coaching_memory m where m.user_id = u.id) as has_completed_a_call
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.user_profile p on p.user_id = u.id
where s.status = 'trialing'
order by s.trial_end asc nulls last;

comment on view public.ops_trial_watchlist is
  'Currently-trialing accounts, soonest-expiring first, with whether they''ve connected a CRM or completed a call yet. SQL Editor only.';
