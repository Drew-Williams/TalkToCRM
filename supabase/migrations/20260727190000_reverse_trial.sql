-- Pivot to a "reverse trial": install the extension and start talking
-- immediately via an anonymous Supabase user (supabase.auth.signInAnonymously()
-- client-side) — no email, no card, on the landing page or on first launch.
-- The trial clock starts the moment *any* account exists, anonymous or not,
-- so this is driven by a trigger on auth.users rather than application code
-- remembering to call some "start trial" endpoint — there is no such
-- endpoint, and shouldn't be one, since every account (anonymous or a
-- normal email sign-up) should get the same 7 days.

-- stripe_customer_id is no longer known at trial start (no Stripe
-- involvement until the day-7 paywall) — nullable now. The prior
-- unique(stripe_customer_id) constraint still holds: Postgres treats
-- multiple NULLs as distinct for uniqueness purposes, so many trialing
-- users can share a null stripe_customer_id simultaneously.
alter table public.subscriptions alter column stripe_customer_id drop not null;

create or replace function public.handle_new_user_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, stripe_customer_id, status, trial_end)
  values (new.id, null, 'trialing', now() + interval '7 days');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_trial();
