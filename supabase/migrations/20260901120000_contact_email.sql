-- Best-effort contact email capture when a rep connects a CRM — same
-- rationale and pattern as ensure_profile_name
-- (20260729170100_ensure_profile_name.sql): Pipedrive's /users/me and
-- HubSpot's access-tokens-info endpoint both already return the connecting
-- user's own email as part of the OAuth exchange, at zero extra friction
-- (see crm-pipedrive.ts/crm-hubspot.ts's ownerEmail).
--
-- Deliberately a distinct concept from auth.users.email (the "linked
-- recovery email" a rep explicitly adds via LinkAccountBanner's day-5
-- nudge, or provides at Stripe checkout) — this column exists specifically
-- because most trial accounts are anonymous with no linked email at all,
-- which made outreach (ops_trial_watchlist, ops-dashboard.html) mostly
-- blank even for reps who'd already connected a real CRM account under
-- their own work email. Never surfaced to the rep themselves in the
-- extension UI — this is an ops/support contact signal only.
--
-- NOTE: this migration was actually deployed to the live database back
-- when it was first written, but the file itself was lost before being
-- committed to git (an environment reset wiped an uncommitted session).
-- Recreated here, matching the original timestamp, purely so git history
-- reflects what's actually already live — `supabase migration list`
-- already shows this timestamp as applied remotely with no local file,
-- which is what surfaced the gap. Re-running this against the live
-- database is a no-op either way (every statement here is idempotent:
-- add column/create-or-replace/drop-then-create), so it's safe regardless
-- of whether the CLI decides to re-apply it.
alter table public.user_profile add column if not exists contact_email text;

create or replace function public.ensure_profile_email(p_user_id uuid, p_contact_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (user_id, contact_email)
  values (p_user_id, p_contact_email)
  on conflict (user_id) do update
    set contact_email = excluded.contact_email
    where public.user_profile.contact_email is null or public.user_profile.contact_email = '';
end;
$$;

-- ops_account_overview/ops_trial_watchlist/ops_lapsed_trials
-- (20260831130000_ops_views.sql, 20260831130100_ops_views_trial_accuracy.sql)
-- all select `email` from auth.users directly, which is blank for the
-- large majority of accounts (anonymous, no linked recovery email) —
-- redefined here to prefer the CRM-sourced contact_email captured above,
-- falling back to auth.users.email when that's all there is. Column name
-- stays `email` in all three views so ops-dashboard.html's existing
-- rendering (`r.email`) picks this up with no changes needed there.
-- create-or-replace can't change an existing column's type (coalesce()
-- with a plain-text column widens the result from auth.users.email's
-- varchar(255)) — drop first in each case.
drop view if exists public.ops_account_overview;
create view public.ops_account_overview as
select
  u.id as user_id,
  u.created_at as signed_up_at,
  u.is_anonymous,
  coalesce(p.contact_email, u.email) as email,
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
  'One row per account: signup, CRM connection, subscription, and call activity. email prefers the CRM-sourced contact_email over auth.users.email (blank for anonymous accounts). SQL Editor only.';

drop view if exists public.ops_trial_watchlist;
create view public.ops_trial_watchlist as
select
  u.id as user_id,
  coalesce(p.contact_email, u.email) as email,
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
  'Accounts still genuinely mid-trial (trial_end in the future), soonest-expiring first. email prefers the CRM-sourced contact_email over auth.users.email. SQL Editor only.';

drop view if exists public.ops_lapsed_trials;
create view public.ops_lapsed_trials as
select
  u.id as user_id,
  coalesce(p.contact_email, u.email) as email,
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
  'Trial ended without converting to paid or being explicitly canceled — reactivation candidates. email prefers the CRM-sourced contact_email over auth.users.email. SQL Editor only.';
