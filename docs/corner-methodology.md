# The Corner Method — how to explain Corner's coaching methodology

Prospect-facing / investor-facing language for "what methodology are you
using, and how does it know what to challenge?" — pulled directly from
the live ElevenLabs agent's system prompt (Convai dashboard → this
agent's "Prompt" tab is the source of truth; this doc is a snapshot for
external explanation, not a config file Corner reads from).

Deliberately **not** a licensed third-party methodology (MEDDIC, BANT,
Sandler, etc.) — see `mem/design/company-profile-v1.md`'s note on why
that was ruled out early on: claiming to coach in a named, licensed
methodology without actually licensing it is a real risk. Everything
below is Corner's own original synthesis, safe to call proprietary.

## The short answer (say this out loud, ~20 seconds)

> "Corner runs on a framework we built specifically for AI deal coaching — we call it the Seven Alignment Gaps. Every session, Corner pulls the live deal record, recent activity, and memory from past coaching conversations into one picture, figures out which *one* of those seven areas is most likely actually holding the deal back right now, and challenges the rep specifically there — instead of running through a fifty-point checklist."

## The longer written answer (website FAQ, deck, one-pager)

> Corner is built on a proprietary deal-diagnosis framework we call the **Seven Alignment Gaps** — not borrowed from a licensed sales methodology, designed from scratch for real-time voice coaching. The seven areas:
>
> 1. **Problem** — is there a business problem important enough to justify organizational change?
> 2. **Stakeholders** — are the people who can actually approve, champion, or block the decision engaged?
> 3. **Process** — do we understand how *this specific customer* will actually reach a decision?
> 4. **Value** — is the value specific and credible enough for the customer to act on?
> 5. **Risk** — what's making the decision feel less safe than simply waiting?
> 6. **Timing** — does the customer have a real, customer-owned reason to act now?
> 7. **Decision** — can the customer actually move from preference to commitment?
>
> Every time a rep talks to Corner, it combines the live CRM record, recent activity (calls, notes, emails), and memory of prior coaching conversations into one coherent picture of the deal — then diagnoses which *one* of these seven gaps is most likely the real blocker right now, and coaches around that specific gap with pointed, evidence-based questions. It doesn't recite a checklist; it finds the single highest-leverage issue and works it, the way an experienced sales manager would in a real 1:1.

## How it actually decides what to challenge (the mechanism, if asked to go deeper)

- **Every challenge is grounded in that specific deal's real data** — a stalled field, a missing stakeholder, a note that contradicts what the rep just said — never a generic or invented objection. The agent's own instructions are explicit: never invent customer statements, meetings, stakeholders, or CRM activity.
- **It separates confirmed fact from inference from missing information**, out loud — "the record shows...", "my read is...", "we don't yet have evidence that..." — rather than presenting a guess as if it were data.
- **It measures customer action, not seller activity.** A rep sending five follow-up emails isn't progress by itself; a customer bringing in procurement, committing to a date, or sharing internal information is.
- **It remembers.** Coaching memory carries forward between sessions on the same deal, so a rep isn't starting from zero with Corner every time — closer to how a manager who's followed a deal for weeks coaches differently than someone seeing it cold.
- **It picks one thing, not everything.** The framework runs as an internal diagnostic lens, not a checklist read aloud — Corner names the *one* gap most likely determining whether the deal moves, mentions a second only if it directly feeds the first, and never overwhelms the rep with a full audit.

## What NOT to say

- Don't name it after (or imply it's licensed from) MEDDIC, MEDDPICC, BANT, Sandler, Challenger, or any other named commercial methodology — Corner's framework is original, and claiming affiliation with a licensed one is a real legal/trust risk, not just a nitpick.
- Don't describe it as "AI reading a script" — the differentiator is the *synthesis and diagnosis* (evidence → which single gap is real → one recommendation), not that it asks sales questions.
