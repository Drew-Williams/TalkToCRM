-- crm_writes: audit log of every write Talk to CRM makes back to a CRM, plus
-- the data needed to undo it within the 24h reversible window. Nothing writes
-- to the CRM in step 2 — this table exists now so the schema is stable before
-- push_to_crm (step 4+) starts inserting into it. Rows are only ever written
-- by edge functions with the service role key; the client can read its own
-- rows (to render "undo" in the side panel) but never inserts directly, so
-- every write is guaranteed to have gone through the two-step confirmation
-- contract server-side.
create table if not exists public.crm_writes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'pipedrive')),
  deal_id text not null,
  -- What kind of write this was (e.g. "update_stage", "log_note",
  -- "update_field"). Kept as free text rather than an enum since the exact
  -- set of writable actions is still being defined in step 4/5.
  write_type text not null,
  -- What we sent to the CRM.
  payload jsonb not null default '{}'::jsonb,
  -- What the field(s) looked like before the write, captured at write time —
  -- required to make the write reversible.
  previous_value jsonb,
  reversible boolean not null default true,
  reversible_until timestamptz not null default (now() + interval '24 hours'),
  reverted_at timestamptz,
  -- Verbatim readback the agent spoke to the rep before they confirmed, and
  -- the rep's confirming utterance — the audit trail for the two-step
  -- contract ("agent reads the proposed write back verbatim -> rep says
  -- 'yes, push it' -> write executes").
  readback_text text,
  confirmation_text text,
  created_at timestamptz not null default now()
);

alter table public.crm_writes enable row level security;

create policy "crm_writes_select_own" on public.crm_writes
  for select
  using (auth.uid() = user_id);

-- No insert/update policies for `authenticated` — writes and reverts only
-- ever happen via edge functions using the service role key, so a write can
-- never land in this table without having gone through the CRM-write edge
-- function's confirmation contract.

grant select on public.crm_writes to authenticated;

create index if not exists crm_writes_user_deal_idx on public.crm_writes (user_id, deal_id, created_at desc);
create index if not exists crm_writes_reversible_idx on public.crm_writes (reversible, reversible_until) where reversible;
