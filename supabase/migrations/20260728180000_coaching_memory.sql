-- Coaching memory: an auto-generated summary of each voice conversation the
-- rep has with the coach about a deal, so the next conversation about the
-- same deal can pick up where the last one left off. Individual-scoped only
-- (no team/org concept — see mem/design/reverse-trial-v1.md's precedent of
-- keeping things per-user until a team actually asks for shared context).
--
-- Deliberately does NOT store the full conversation transcript — only the
-- distilled summary/risk/next-action ElevenLabs' own post-call analysis
-- extracts. Smaller footprint of sensitive data, and the summary is what's
-- actually useful for the next conversation anyway.
create table public.coaching_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'pipedrive')),
  deal_id text not null,
  -- ElevenLabs' own conversation id — unique so a webhook redelivery
  -- (ElevenLabs, like most webhook senders, delivers at-least-once) upserts
  -- the same row instead of duplicating it. Also what the side panel polls
  -- on right after a call ends to find "the row for the call that just
  -- happened" (see usePostCallSummary.ts).
  conversation_id text not null unique,
  summary text,
  risk text,
  next_action text,
  created_at timestamptz not null default now()
);

create index coaching_memory_deal_idx on public.coaching_memory (user_id, provider, deal_id, created_at desc);

alter table public.coaching_memory enable row level security;

-- Reps can read their own coaching memory (used to build the next
-- conversation's greeting, back the recall_notebook client tool, and poll
-- for the post-call summary). No insert/update/delete policy for regular
-- users — only supabase/functions/elevenlabs-post-call-webhook writes here,
-- using the service role key (bypasses RLS), same pattern as
-- crm_connections/crm_connections_status.
create policy "coaching_memory_select_own" on public.coaching_memory
  for select using (auth.uid() = user_id);
