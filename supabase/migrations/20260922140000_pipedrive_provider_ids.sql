-- Pipedrive's own numeric identifiers for the connecting user (company_id +
-- user id, both from /users/me — see crm-pipedrive.ts) — needed to match an
-- incoming uninstall webhook (which only supplies these numeric IDs, no
-- Corner-side user_id) back to a crm_connections row. Nullable/generic
-- across providers rather than Pipedrive-specific columns, in case HubSpot
-- ever needs the same matching (it doesn't yet — HubSpot's uninstall isn't
-- wired up, only Pipedrive's is, per mem/design/pipedrive-uninstall-v1.md).
--
-- This is what finally makes pipedrive-oauth-redirect's DELETE handling
-- (the uninstall webhook) possible at all — see that function's own
-- comment for why a real Callback URL (and therefore a real place to
-- receive this webhook) didn't exist until this same change.
alter table public.crm_connections add column provider_company_id text;
alter table public.crm_connections add column provider_user_id text;

create index crm_connections_provider_ids_idx
  on public.crm_connections (provider, provider_company_id, provider_user_id);
