---
name: In-app onboarding v1
description: Sequencing the side panel into Connect → Talk → Customize (Wes Bush-style product-led onboarding) instead of showing every card at once, and the milestone-triggered nudge that surfaces personalization only after the first real conversation
type: design
---

## Why

The reverse-trial funnel (`mem/design/reverse-trial-v1.md`) already gets a
rep from "install" to "the extension is usable" with zero forms. But once
inside the side panel, every first-time surface — CRM connect, personal
profile, deal status, the talk CTA — has been rendering together since the
HUD redesign. That's fine once someone already knows the product, but it's
the wrong shape for the very first open: it asks a brand-new rep to decide
whether to fill in their name/role/company at the exact moment the only
thing that actually matters is "connect Pipedrive."

This is the standard product-led-growth mistake Wes Bush's framework is
built to avoid: don't ask for anything beyond the single next unblocking
action until the user has already reached an "aha moment." Applied here,
that's a three-stage funnel with exactly one job per stage:

1. **Connect** — the one blocking action. Nothing else is shown.
2. **Talk** — the aha moment. Open a deal, hit "Talk about this deal,"
   have an actual coached conversation.
3. **Customize** — optional, deferred, and only offered once, right after
   stage 2 has already happened once. Name/role/company personalization
   makes the *next* conversation better, so it's pitched as a "make this
   better" upsell after value was already delivered once, not a setup
   step standing between the rep and their first conversation.

No new tab, wizard, numbered stepper, or blocking modal — this stays
inside the existing side panel, sequenced by real state (whether a CRM is
connected, whether a call has ever finished) rather than added chrome.
That's consistent with the direct, repeated feedback already baked into
this UI: minimal, voice-first, not a lot of window real estate to spend on
setup screens.

## What's already true today (don't need to build)

- `App.tsx` already tucks `ConnectCrmCard` behind a settings cog once
  `>=1` CRM connection exists (`showConnectCard`) — stage 1 → stage 2
  already collapses correctly today.
- `DealStatusCard` + `TalkToCrmCard` are already exactly the stage-2
  experience: "Open a deal to get started" → "Talk about this deal" hero
  CTA → live call. No functional change needed here.

## What's actually wrong today

- **Stage 1 is not single-focus.** While `showConnectCard` is true because
  there's no connection yet, `ProfileCard` renders directly underneath
  `ConnectCrmCard` — two asks on screen when only one is unblocking
  anything. The settings cog also renders (and does nothing useful) before
  there's anything to tuck away yet.
- **Stage 3 never actually happens.** Once connected, the profile card is
  simply hidden behind the cog forever, with nothing ever pointing a rep
  at it. That's passive availability, not progressive profiling — most
  reps will never think to click a gear icon to find a feature they don't
  know exists.

## The fix

**Stage 1 — hide `ProfileCard` (and the cog) until a CRM is connected.**
`App.tsx` renders `ProfileCard` only when `hasAnyConnection` is true, and
the settings-cog button only renders once there's at least one connection
to manage. Before that, the entire panel below the header is just
`ConnectCrmCard` — one card, one action.

**Stage 3 — a one-time nudge, triggered by the first completed call, not
by time or by opening the panel.** New local (chrome.storage.local, not
`user_profile` — this needs to work instantly, before any Supabase round
trip, and survive the side panel remounting) flags:

- `firstCallCompletedAt` — set once, the first time `useTalkSession`'s
  `status` reaches `"ended"`.
- `profileNudgeDismissed` — set once the rep either clicks through to the
  profile section or explicitly dismisses the nudge.

`App.tsx` shows a small dismissible `ProfileNudgeBanner` under the call
area whenever `firstCallCompletedAt` is set and `profileNudgeDismissed`
is not — "Want Corner to sound like it already knows you? Add your name
and company — takes 30 seconds," with a "Set up profile" button that
opens the same settings section the cog does (`setCrmSettingsOpen(true)`)
and a plain dismiss. Either action sets `profileNudgeDismissed`; it never
reappears after that, on this install.

This is deliberately not gated on whether the profile is already filled
in — even a rep whose name got auto-filled from their CRM connection
(`ensure_profile_name`, see `company-profile-v1.md`) still benefits from
being pointed at company-profile personalization once, and the nudge
costs one click to dismiss if it's not relevant.

## Files

- New `src/lib/onboarding/state.ts` — chrome.storage.local get/set for the
  two flags above.
- New `src/sidepanel/hooks/useOnboardingFlags.ts` — reactive read of those
  flags via `chrome.storage.onChanged`, so a flag written from
  `TalkToCrmCard` (call ends) is immediately visible in `App.tsx` (renders
  the nudge) without prop drilling or a shared context.
- New `src/sidepanel/components/ProfileNudgeBanner.tsx`.
- Edit `TalkToCrmCard.tsx` — call `markFirstCallCompleted()` when `status`
  transitions to `"ended"`.
- Edit `App.tsx` — gate `ProfileCard` and the settings cog on
  `hasAnyConnection`; render `ProfileNudgeBanner` per the flags above.

## Explicitly out of scope for v1

- A visible progress indicator ("Step 1 of 3") — the funnel is inferred
  from real state, not presented as a checklist. Matches the "keep it
  minimal" direction this UI has been held to throughout.
- Gating stage 2 on stage 3 in any way — a rep can ignore the nudge
  forever and the product works fully without ever touching the profile
  card, same as today.
- Any change to the trial banner, sign-in, or paywall — unrelated to this
  funnel and already working.
