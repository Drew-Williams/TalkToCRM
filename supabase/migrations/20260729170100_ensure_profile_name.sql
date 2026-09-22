-- Best-effort name capture when a rep connects a CRM (Pipedrive/HubSpot
-- OAuth already tells us who the connecting user is, at zero extra
-- friction — see crm-pipedrive.ts/crm-hubspot.ts). Deliberately takes an
-- explicit user_id parameter rather than reading auth.uid(), which is safe
-- ONLY because this is never granted to `authenticated` — it's called
-- exclusively from exchangeAndStoreConnection (an edge function, service
-- role), never exposed as a client-callable RPC. Contrast with
-- ensure_trial_started, which IS safe for direct client RPC precisely
-- because it reads auth.uid() internally instead of trusting a caller-
-- supplied id.
--
-- Only fills in a name that's still missing — never overwrites a name the
-- rep already typed into their profile by hand, since the CRM's OAuth
-- "who is this" data isn't necessarily more authoritative than a name
-- someone already deliberately set.
create or replace function public.ensure_profile_name(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (user_id, display_name)
  values (p_user_id, p_display_name)
  on conflict (user_id) do update
    set display_name = excluded.display_name
    where public.user_profile.display_name is null or public.user_profile.display_name = '';
end;
$$;
