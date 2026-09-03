-- subscriptions: one row per user's Stripe subscription (7-day trial ->
-- paid). Only the stripe-webhook edge function writes here, using the
-- service role key and Stripe's own webhook events as the source of truth —
-- the extension/website never tell us "I paid," Stripe does. Mirrors the
-- crm_connections pattern: RLS lets a rep read their own row, but all writes
-- happen server-side.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  -- Mirrors Stripe's own subscription status values directly (trialing,
  -- active, past_due, canceled, incomplete, incomplete_expired, unpaid) —
  -- deliberately not re-encoded into our own enum, so a new Stripe status
  -- doesn't need a migration to become representable here.
  status text not null,
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (stripe_customer_id)
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for `authenticated` — this table is only
-- ever written by the stripe-webhook edge function via the service role key.

grant select on public.subscriptions to authenticated;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

-- Client-safe view: no stripe_customer_id/stripe_subscription_id columns —
-- those aren't secret, exactly, but there's no reason the extension needs
-- them, so they don't leave the base table. security_invoker means the RLS
-- policy above still applies per-row even though the extension queries the
-- view, not the base table.
create or replace view public.subscription_status
  with (security_invoker = true) as
select id, user_id, status, trial_end, current_period_end, created_at
from public.subscriptions;

grant select on public.subscription_status to authenticated;
