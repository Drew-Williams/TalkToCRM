-- Self-healing counterpart to handle_new_user_trial (see
-- 20260727190000_reverse_trial.sql). That trigger should always create a
-- trialing row the instant an auth.users row exists, but the client has no
-- way to recover if that somehow didn't happen for a given account
-- (observed in testing: a rep hit the hard "Upgrade to Pro" paywall on a
-- brand-new account that should have had 7 free days) — the previous
-- fallback for subscription === null was to demand payment immediately,
-- which is the wrong fix for "you never got your trial in the first
-- place." This gives the client an idempotent way to ask for its own trial
-- to start, callable directly (no service-role edge function needed,
-- since it can only ever affect the caller's own row).
create or replace function public.ensure_trial_started()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- on conflict do nothing is the safety rail that keeps this from ever
  -- being a "free trial reset" button — a rep whose trial already lapsed,
  -- or who's already paying, still has an existing row here and this is a
  -- no-op for them. It only ever helps an account with zero rows at all.
  insert into public.subscriptions (user_id, stripe_customer_id, status, trial_end)
  values (auth.uid(), null, 'trialing', now() + interval '7 days')
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_trial_started() to authenticated;
