# Landing page → Chrome install → reverse trial

Corner pivoted to a "reverse trial" funnel (see `mem/design/reverse-trial-v1.md`
for the full architecture) after Lovable proposed it: no landing-page sign-up
at all, install first, monetize after value is delivered. **Lovable's own
plan for the marketing site (quoted below, from its response to an earlier
version of this doc) is approved as-is** — nothing on this list needs to
change; everything else described in this file is what changed on the
extension/backend side to make it work.

## Lovable's plan (approved)

> Primary CTA everywhere → "Add Corner to Chrome", linking directly to the
> Chrome Web Store listing (placeholder URL until published, stored in
> `src/content/site.ts` as `chromeStoreUrl`). Secondary CTA → "Talk to a
> coach now" (scrolls to the existing `LiveCoach` component). Remove the
> Stripe email-capture flow from `EarlyAccessModal.tsx` — stop importing it,
> delete in a follow-up. New "How the trial works" section: install free
> (no card, no account) → 7 days of Pro on the house → $19/month after, or
> free tier. `/welcome` route stays as a lightweight post-install landing
> (linked from inside the extension after first launch, not from Stripe) —
> no `session_id` logic needed there anymore.
>
> Deliberately not in this plan: Stripe Checkout, webhooks, subscription
> entitlement (those live in the extension/backend, triggered on day 7).
> Auth on the landing page (account creation happens inside the extension).
> Any email capture on the marketing site.

## Answering Lovable's open question

**"Do you already have the Chrome Web Store listing URL, or should I ship
with a placeholder?"** Ship with the placeholder
(`https://chrome.google.com/webstore/detail/corner/PLACEHOLDER` or similar)
— Corner hasn't been submitted yet. See `docs/chrome-web-store-listing.md`
for the submission materials, drafted and ready to go once someone
registers a developer account.

## What changed on this side (extension + Supabase) to match

- **No sign-in gate at first launch.** The side panel calls
  `supabase.auth.signInAnonymously()` invisibly the moment there's no
  session — a rep can open a real deal and start talking within seconds of
  installing, no email, no card. (`src/sidepanel/hooks/useSupabaseSession.ts`)
- **The 7-day trial starts the instant that anonymous account exists** — a
  Postgres trigger on `auth.users`, not application code that could forget
  to call it. (`supabase/migrations/20260727190000_reverse_trial.sql`)
- **A day-5-ish soft nudge** invites the rep to add an email so their
  CRM connections/sessions survive clearing browser data — upgrades the
  *same* anonymous account rather than creating a new one.
  (`src/sidepanel/components/LinkAccountBanner.tsx`)
- **A day-7 hard paywall**, inside the extension, opens Stripe Checkout in
  a real browser tab (can't be embedded in the side panel) and
  automatically notices when payment completes.
  (`src/sidepanel/components/PaywallView.tsx`)

## What Corner still needs from you to actually charge a real card

- **Stripe secrets**, added as Cloud Agent secrets so they can be set on
  the Supabase project:
  - `STRIPE_SECRET_KEY` — your Stripe secret API key (`sk_test_...` while
    testing, `sk_live_...` once ready for real charges).
  - `STRIPE_PRICE_ID` — the Price ID (`price_...`, not the Product ID) for
    the $19/month plan.
  - `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Developers → Webhooks
    → Add endpoint →
    `https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/stripe-webhook`,
    subscribed to `checkout.session.completed`,
    `customer.subscription.created`, `customer.subscription.updated`,
    `customer.subscription.deleted`. Stripe shows the signing secret
    (`whsec_...`) once that endpoint is created.
- **The real marketing site domain**, for `VITE_MARKETING_SITE_URL` — used
  as the Stripe Checkout `success_url`/`cancel_url` when the day-7 paywall
  opens checkout.
- **The real Chrome Web Store listing URL**, once published, to replace the
  `chromeStoreUrl` placeholder on the marketing site.

## Still deferred: skipping the second sign-in after install

Not applicable in the same way anymore — there's no sign-in step to skip at
install time at all now (the anonymous account handles that). The
`externally_connectable` handoff idea from the original design doesn't have
a clear use case left in this funnel; revisit only if a concrete need comes
up (e.g. wanting the marketing site to know "this visitor already has an
active Corner trial").
