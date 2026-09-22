-- crm_connections: one row per (user, provider) OAuth connection. Tokens are
-- written/read only by edge functions using the service role key — the
-- extension never sees access_token/refresh_token directly (see
-- crm_connections_status view below for what the client is allowed to read).
create table if not exists public.crm_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'pipedrive')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  -- HubSpot: portal/hub id. Pipedrive: company subdomain. Used to render
  -- "connected as {account_ref}" in the side panel and to sanity-check that
  -- a detected deal's accountRef matches the connected account.
  account_ref text,
  -- Pipedrive returns a per-company API domain on token exchange (their
  -- OAuth apps are multi-tenant across many *.pipedrive.com hosts). Null for
  -- HubSpot, which always uses the fixed api.hubapi.com host.
  api_base text,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.crm_connections enable row level security;

-- Reps can see that a connection exists (for UI state) but all actual token
-- reads/writes happen server-side with the service role key, which bypasses
-- RLS entirely. These policies matter for the safety-net view below, not for
-- edge functions.
create policy "crm_connections_select_own" on public.crm_connections
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for `authenticated` — connections are only
-- ever written by the oauth-exchange edge functions via the service role key.

grant select on public.crm_connections to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger crm_connections_set_updated_at
  before update on public.crm_connections
  for each row
  execute function public.set_updated_at();

-- Client-safe view: no access_token/refresh_token columns. security_invoker
-- means the view runs with the CALLER's permissions, so the RLS policy above
-- still applies per-row even though the extension queries the view, not the
-- base table.
create or replace view public.crm_connections_status
  with (security_invoker = true) as
select id, user_id, provider, account_ref, scopes, created_at
from public.crm_connections;

grant select on public.crm_connections_status to authenticated;
