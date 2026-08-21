# Personalization + company profile ("playbook light") v1

## Why

Follow-up to `mem/design/coaching-memory-v1.md`'s context-sources discussion.
Two gaps called out from real usage: the coach only ever addresses the rep
as "the rep"/"the seller" (impersonal for a voice-first product), and it
knows nothing about the rep's own company — what they sell, to whom, in
what industry — beyond whatever's implicitly buried in CRM deal data.

Two things were explicitly *not* built here, by direct request:
- **A named sales-methodology field** (MEDDIC/BANT/Sandler/etc.) — dropped
  entirely. Claiming to coach in a licensed methodology without actually
  licensing it is a real risk, not worth the personalization value. `role`
  (see below) is the safer substitute signal.
- **A staleness/"no activity in N days" flag** — dropped. The CRM already
  surfaces this natively; a Corner-side duplicate would just be redundant,
  not a new context source.

## Personalization: name + role

**Name capture, zero extra friction.** Pipedrive's OAuth connect already
calls `/api/v2/users/me` (previously just for `company_domain`); it also
returns the connecting user's own name for free. HubSpot's OAuth flow only
gives an email from the access-token-info endpoint, so getting a name
needs one extra lookup via the Owners API (`GET /crm/v3/owners?email=...`,
covered by the `crm.objects.owners.read` scope already requested).
`exchangeAndStoreConnection` (`_shared/store-connection.ts`) calls a new
RPC, `ensure_profile_name`, after every successful connection — best-effort,
and deliberately never overwrites a name the rep already set by hand
(connecting a *second* CRM later shouldn't clobber it).

`ensure_profile_name` takes an explicit `user_id` parameter rather than
reading `auth.uid()` (contrast with `ensure_trial_started`, which is safe
for direct client RPC precisely *because* it reads `auth.uid()`) — this one
is never granted to `authenticated`, only ever called from the OAuth
exchange edge functions via the service role.

**Role** is a plain enum (`account_executive`, `sdr_bdr`, `founder`,
`sales_manager`, `other`) the rep sets once in the new Profile card —
there's no CRM signal for this, so it's just asked directly.

**How the agent actually uses these.** Neither is folded into the
scripted `firstMessage` override alone (well — the name is, for the very
first line: "Hey Drew, you've got..."). Both are also passed as
`dynamicVariables` (`corner_rep_name`, `corner_rep_role`) at
`Conversation.startSession()`, and the agent's *base system prompt* now
has a new "SELLER IDENTITY" section referencing `{{corner_rep_name}}` /
`{{corner_rep_role}}` directly — patched in via the Convai API, with empty-
string `dynamic_variable_placeholders` defaults so an unset profile
degrades gracefully rather than leaking literal `{{...}}` syntax into
speech. This is what makes the personalization last the *whole*
conversation (the LLM has this context on every turn), not just the
opening line.

## Company profile ("playbook light")

**What it isn't:** the bigger "org-wide, admin-authored, retrieval-indexed
sales playbook" idea from `coaching-memory-v1.md` — that's still deferred,
still needs an organizations/teams concept that doesn't exist. This is
individual-scoped, tiny (five short fields), and explicitly *not* meant to
absorb a real document corpus.

**How it's generated.** The rep enters their company's URL once (Profile
card, next to CRM connections). `company-profile`'s `analyze` action
fetches that page, strips it to plain text (script/style stripped, capped
at 6000 chars — plenty for a homepage, deliberately not a multi-page
crawl), and asks an LLM (`gpt-4o-mini` — cheap, and this only runs once per
rep or whenever they change their URL, so cost/latency barely matter
either way) to infer: company name, one-line value proposition, ICP,
industry, and likely competitors. Requires a new secret,
`OPENAI_API_KEY` — unlike coaching memory, this genuinely doesn't fit
anything ElevenLabs' own infrastructure already does for us.

**The rep reviews before it's saved.** `analyze` never writes to the
database — it just returns the inferred JSON for the Profile card to show
in an editable form. Only `save` (a separate action, explicit rep click)
persists the final fields, edited or not. First-pass AI inference from a
homepage alone won't always be right, and getting this wrong matters more
for coaching quality than a one-off note would — worth the one extra
click.

**How it reaches the coach, take one: `lookup_playbook` — didn't work
reliably in practice.** The agent's base prompt already had a fully-
designed `lookup_playbook(topic)` tool contract ("company-specific advice
would be more useful than general advice") sitting unused
(`expects_response: false`, so whatever it returned was silently ignored).
Flipped to `true` and wired to return the profile's five fields as a
compact block, regardless of `topic` — the registered tool takes no actual
parameters (same as every other client tool here), and five short fields
are small enough that there's no real benefit to topic-based filtering.
The theory was that the agent would call this on demand (an objection,
"how do we usually position against X," etc.), avoiding the cost of extra
prompt tokens on every turn the way dynamic-variable injection would.

In real testing, this failed: the agent has no built-in reason to
proactively call a tool just to "get oriented" at the start of a
conversation, and with a saved profile sitting right there, it told the
seller "I don't have the full picture of your company yet" instead of
fetching it — name/role personalization (dynamic variables, prompt-
injected) worked in the same session, confirming the gap was specifically
the tool-call delivery path, not the underlying data.

**Take two, and what actually shipped: prompt injection, same as name/
role.** `corner_company_name`/`corner_value_prop`/`corner_icp`/
`corner_industry`/`corner_competitors` are now passed as `dynamicVariables`
at `Conversation.startSession()` and referenced directly in a new COMPANY
CONTEXT section of the base prompt (patched in via the Convai API,
alongside SELLER IDENTITY), with explicit instructions not to recite them
as a list and to proceed normally when a field is empty. Five short fields
is a small enough prompt-token cost that the "auto" tool-call theory's
efficiency argument didn't hold up against just... reliably working.
`lookup_playbook` stays wired as a fallback the agent can still reach for
explicitly, but the prompt is now the primary, always-present path.

An ElevenLabs-native Knowledge Base attachment (`overrides.agent.prompt.
knowledgeBase`) was also considered and ruled out before either of the
above: that override field isn't exposed by `@elevenlabs/client`'s browser
session config (checked both the installed version and latest on npm),
and even if it were, this agent's own security settings currently have
`prompt.knowledge_base` disabled for client overrides entirely.

## The same lesson, generalized: activity history had the identical bug

Real usage surfaced the exact same failure mode a second time, for a
different tool: `get_recent_activities` (calls/meetings/notes/emails) was
also purely reactive, and `get_deal_snapshot` alone doesn't include
activity — so on a *first* review, the agent would only discover a deal
had call/note history after the seller had to point it out (twice, in the
observed transcript), rather than already knowing.

Fixed the same way: `useTalkSession.ts` now fetches recent activities in
parallel with the deal snapshot, and `buildActivityDigest` (`session-
start-prompt.ts`) turns the 5 most recent into a short, dated one-line-
each digest passed as `corner_recent_activity` — referenced directly in
SESSION BEHAVIOR, alongside the deal snapshot and coaching-memory recap.
`get_recent_activities` stays wired as the fallback for a longer history
than the digest covers.

The pattern is now consistent across every piece of "the agent should
already know this at the start of a call" context: name, role, company
profile, and recent activity all ride along as prompt-injected session
context, not something gated behind the agent choosing to call a tool
first. Reserve actual tool calls for genuinely on-demand retrieval —
something not already summarized, or a level of detail beyond what a
short digest can reasonably carry.

## A third instance: synthesis, not just delivery

Even with the activity digest reliably present, real testing surfaced a
related but distinct failure: the agent would correctly reference a note
in its opening line, then two turns later flatly contradict itself —
"the last activity timestamp is empty, which means there's been no
logged customer contact" — because `get_deal_snapshot`'s own
`lastActivityAt` field (Pipedrive's own summary field, tracked separately
from real activity history and frequently empty even on deals with a lot
of it) came back null, and the agent reported that field in isolation
without reconciling it against the activity digest and its own prior
statement.

This isn't a data-delivery problem (the earlier fixes above solved that)
— it's a synthesis problem: multiple context sources being treated as
separate facts to report one at a time rather than one coherent picture.
Fixed on two fronts:

- **Removed the temptation at the source**: `get_deal_snapshot`'s
  `lastActivityAt` field is now stripped out of what's actually returned
  to the agent (`client-tools.ts`) — it isn't used anywhere in this
  app's own UI either, so there was no reason to keep exposing a field
  proven to actively mislead.
- **Added an explicit synthesis instruction** ("ONE PICTURE, NOT
  SEPARATE FACTS", patched into the base prompt after PRIMARY OBJECTIVE):
  combine every context source into one understanding before responding,
  treat an empty snapshot field as a data-entry gap rather than evidence
  of no activity, and never contradict something already said earlier in
  the same conversation.
