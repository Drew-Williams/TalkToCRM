-- Fixes ops_funnel_summary/ops_trial_watchlist (20260831130000_ops_views.sql)
-- discovered by actually running them against real data: subscriptions.status
-- never flips itself from 'trialing' once trial_end passes — see
-- useSubscription.ts's isActive, which computes "is this trial still live"
-- client-side by comparing trial_end to now(), not from status alone.
-- Nothing server-side ever updates status on trial expiry (Stripe only
-- becomes involved at checkout, on day 7+). So `status = 'trialing'` alone
-- conflates "genuinely mid-trial" with "trial lapsed weeks ago, never
-- converted" — confirmed against production data immediately after
-- deploying the first version of these views.

-- Postgres won't let create-or-replace insert a column in the middle of an
-- existing view's column list (only append at the end) — drop first.
drop view if exists public.ops_funnel_summary;

create view public.ops_funnel_summary as
select
  (select count(*) from auth.users) as total_accounts,
  (select count(distinct user_id) from public.crm_connections) as connected_crm,
  (select count(distinct user_id) from public.coaching_memory) as completed_first_call,
  (select count(*) from public.subscriptions where status = 'trialing' and trial_end > now()) as currently_trialing,
  (select count(*) from public.subscriptions where status = 'trialing' and trial_end <= now()) as trial_lapsed_no_conversion,
  (select count(*) from public.subscriptions where status = 'active') as active_paid,
  (select count(*) from public.subscriptions where status in ('past_due', 'unpaid', 'incomplete')) as payment_issue,
  (select count(*) from public.subscriptions where status = 'canceled') as canceled;

comment on view public.ops_funnel_summary is
  'One-row funnel snapshot: accounts -> CRM connected -> first call done -> trial/lapsed/paid. SQL Editor only.';

-- Only genuinely still-active trials now (trial_end in the future) — this
-- is a "reach out before it's too late" list, not a historical record.
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
where s.status = 'trialing' and s.trial_end > now()
order by s.trial_end asc nulls last;

comment on view public.ops_trial_watchlist is
  'Accounts still genuinely mid-trial (trial_end in the future), soonest-expiring first. SQL Editor only.';

-- The companion list: trial ended, never converted, never explicitly
-- canceled either (status is still just sitting at 'trialing' — see the
-- comment at the top of this file). These are churn/reactivation
-- candidates, distinct from ops_trial_watchlist's "still time to act" list.
create or replace view public.ops_lapsed_trials as
select
  u.id as user_id,
  u.email,
  p.display_name,
  s.trial_end,
  extract(day from now() - s.trial_end)::int as days_since_lapsed,
  exists(select 1 from public.crm_connections c where c.user_id = u.id) as had_connected_crm,
  exists(select 1 from public.coaching_memory m where m.user_id = u.id) as had_completed_a_call
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.user_profile p on p.user_id = u.id
where s.status = 'trialing' and s.trial_end <= now()
order by s.trial_end desc;

comment on view public.ops_lapsed_trials is
  'Trial ended without converting to paid or being explicitly canceled — reactivation candidates. SQL Editor only.';
