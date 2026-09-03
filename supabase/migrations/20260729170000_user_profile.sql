-- Personalization + "playbook light" context: the rep's own name/role, and
-- a lightweight, AI-inferred company profile (value prop, ICP, industry,
-- competitors) from their company's website — deliberately not a full
-- document-ingestion knowledge base (that's the bigger, deferred "org
-- playbook" idea from mem/design/coaching-memory-v1.md). Individual-scoped
-- only, same posture as coaching_memory/subscriptions/etc.
--
-- Unlike every other table so far, this one really is rep-edited directly
-- (their own name, their own company description) — but writes still go
-- through the company-profile edge function rather than a direct RLS
-- insert/update policy, both to keep this project's "only edge functions
-- write" convention consistent, and because saving is also the moment a
-- fresh AI-inferred profile gets persisted alongside whatever the rep
-- edited by hand.
create table public.user_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Deliberately not a sales-methodology field (MEDDIC/BANT/Sandler/etc.)
  -- — considered and dropped: claiming to coach in a named, licensed
  -- methodology without actually licensing it is a real risk, not worth
  -- the personalization value. Role is a safer, still-useful signal for
  -- calibrating coaching depth/tone.
  role text check (role in ('account_executive', 'sdr_bdr', 'founder', 'sales_manager', 'other')),
  company_url text,
  company_name text,
  value_prop text,
  icp text,
  industry text,
  competitors text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profile enable row level security;

create policy "user_profile_select_own" on public.user_profile
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for `authenticated` — only the
-- company-profile edge function writes here (service role).
grant select on public.user_profile to authenticated;

create trigger user_profile_set_updated_at
  before update on public.user_profile
  for each row
  execute function public.set_updated_at();
