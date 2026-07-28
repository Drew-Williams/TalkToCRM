# Coaching memory (v1)

## Why

CRM data alone is a thin foundation for a coaching conversation — it's
sometimes stale, sometimes just missing the color that actually matters
("stakeholder alignment is shaky" isn't a CRM field). The first real
context upgrade beyond "read the CRM" is giving the coach memory of its
*own* prior conversations about a deal, so a rep doesn't start from zero
every single time they open the side panel.

Two other context sources were considered and explicitly deferred:
- **Rep-authored deal notes** — dropped entirely. If a rep is on the deal
  page in HubSpot/Pipedrive already, they'll just type the note there, and
  `crm-proxy`'s `get_recent_activities` already reads CRM notes/emails (see
  the activity-limit fix from the prior update). A separate Corner-native
  notes feature would just be a second, more hidden place to keep in sync.
- **Org-wide sales playbook** — deferred, not dropped. It's the highest
  long-term leverage of the three context sources discussed, but it also
  quietly requires introducing an organizations/teams concept (who can
  edit a shared playbook vs. just read it) that doesn't exist anywhere in
  this schema today. Revisit when a team actually asks for it.

## Scope: individual-only

Every `coaching_memory` row belongs to exactly one Supabase user (rep) —
no sharing across reps, no org/team concept, same posture as everything
else in this app today (see `mem/design/reverse-trial-v1.md`'s precedent).

## What gets remembered

After each call, three short fields — not the full transcript:

- **summary** — 2-4 sentences on what was actually discussed.
- **risk** — the single biggest risk/concern that came up, if any.
- **next_action** — the single most important next step or open
  commitment, if any.

Deliberately **not** storing the raw transcript long-term: smaller
footprint of sensitive conversation data, and the distilled fields are
what's actually useful for the next conversation anyway.

## How it's generated: ElevenLabs' own post-call analysis

No new AI provider/API key needed — this reuses ElevenLabs' existing
Conversational AI infrastructure (already paid for via `ELEVENLABS_API_KEY`),
specifically:

1. **Data Collection** (`platform_settings.data_collection` on the agent,
   configured via the Convai API): three custom fields — `deal_summary`,
   `deal_risk`, `next_recommended_action` — each with a natural-language
   description telling the agent's own analysis LLM (currently
   `gemini-2.5-flash`, the agent's existing default) what to extract.
2. **Post-call webhook** (`supabase/functions/elevenlabs-post-call-webhook`):
   ElevenLabs POSTs the analysis results here once a call's post-processing
   finishes. Verified via HMAC (`elevenlabs-signature: t=...,v0=...`, same
   scheme as Stripe's webhooks but with a `v0` prefix instead of `v1` — see
   `_shared/elevenlabs-webhook-verify.ts`), then upserted into the
   `coaching_memory` table (service role, bypassing RLS — the one writer,
   same pattern as every other webhook in this project).

### Identifying which user/deal a conversation belongs to

The webhook has no Supabase session to key off of, so the client passes
two pieces of identity at `Conversation.startSession()` time (see
`useTalkSession.ts`), and ElevenLabs round-trips them back into the
webhook payload:

- `userId: session.user.id` → arrives as the webhook payload's top-level
  `user_id` (checked with a `metadata.user_id` fallback, since ElevenLabs'
  own docs are inconsistent about which of the two it actually lands in).
- `dynamicVariables: { corner_provider, corner_deal_id }` → arrives under
  `conversation_initiation_client_data.dynamic_variables`.

This is exactly ElevenLabs' own documented "stateful conversations"
pattern (pass a user id as a dynamic variable at call start, read it back
in the webhook) — not a workaround, just following the intended usage.

`conversation.getId()` (captured client-side right as the session opens)
is the row's `conversation_id` — unique in the table, both so a webhook
redelivery upserts instead of duplicating, and so the client can poll for
"the row this specific call produced" (see below).

## How it comes back into the next conversation

Two paths, both reading straight from `coaching_memory` via the client's
own Supabase session (RLS already scopes every query to the signed-in
rep's own rows — no proxy edge function needed for reads, same as
`crm_connections_status`):

- **Proactively, in the greeting**: `useTalkSession.start()` fetches the
  latest memory row for the open deal in parallel with the deal snapshot,
  and `buildFirstMessage()` folds the open `next_action` (or the general
  `summary` if there's no next action) into the opening line — "Last time,
  the next step was X — did that happen?"
- **On demand, via `recall_notebook`**: this client tool already existed
  as a stub with `expects_response: false` (silently ignored by the agent
  regardless of what it returned) — flipped to `true` via the Convai Tools
  API as part of this change, then wired to return the last 5 memory rows
  for when a rep explicitly asks "what did we cover last time?" beyond
  what's already in the greeting.

## The one thing that *is* shown in the UI: a one-time post-call copy block

Explicitly **not** a persistent "recent conversations" list — that was
considered and rejected to keep the panel clean, given how little screen
real estate a side panel has. Instead: right when a call ends, if the
webhook's analysis has landed by then, a small dismissible block appears
with a single "Copy for your CRM" button — since a rep who just had a
coaching call almost always still has to go log that call in their actual
CRM anyway, and the coach already generated a clean summary for its own
memory. This makes that a paste instead of a re-type from scratch, without
needing to build real CRM *writes* yet (a much bigger, more sensitive
lift — new OAuth write-scopes, real risk of writing something wrong into
someone's live CRM).

Since the webhook is server-side and asynchronous (ElevenLabs' own
analysis pipeline runs after the call, not during it), the client can't
know the moment it's ready — `usePostCallSummary.ts` polls
`coaching_memory` for a row matching the call's `conversation_id` every 2s
for up to 25s, then gives up silently if nothing shows (no error state —
this is a nice-to-have, not something worth surfacing a failure for).

## What's explicitly out of scope for v1

- No editing/deleting summaries.
- No sharing between reps, no org/team concept.
- No retention/expiry policy — rows are kept indefinitely for now.
- No persistent "history" UI — voice-first and the one-time copy block are
  the only two surfaces.

## One manual setup step outside this repo

Creating the ElevenLabs workspace webhook (`POST /v1/workspace/webhooks`)
needs the `webhooks_write` API key permission, which the project's current
`ELEVENLABS_API_KEY` doesn't have (confirmed: agent config PATCHes and
conversation token minting work fine with it; webhook creation and
`GET /v1/user` both 401 with "missing the permission"). The webhook itself
had to be created manually via the ElevenLabs dashboard (Settings →
Webhooks) once a key with that permission was available, and its returned
`webhook_secret` set as the `ELEVENLABS_WEBHOOK_SECRET` Supabase secret,
plus the resulting `webhook_id` set on the agent's
`platform_settings.workspace_overrides.webhooks.post_call_webhook_id`.
