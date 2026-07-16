# Landing page → 7-day trial → Chrome install

Exact spec for the changes needed on the marketing site (built in Lovable).
This agent doesn't have access to that project, so this is written to be
pasted directly into Lovable's AI chat, or handed to whoever's editing that
project by hand.

## The three pieces needed on the Lovable side

### 1. The "Start free trial" / "Get early access" button

Replace (or add behind) the current CTA with a small email-capture step,
then redirect straight into Stripe Checkout:

```
Prompt for Lovable:

Add a "Start your 7-day free trial" flow to the [GET EARLY ACCESS] button.
When clicked, show an email input (inline or in a modal — your choice).
On submit, POST to this endpoint:

  POST https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/stripe-create-checkout-session
  Content-Type: application/json
  Body: {
    "email": "<the email they entered>",
    "successUrl": "https://<this-site's-domain>/welcome?session_id={CHECKOUT_SESSION_ID}",
    "cancelUrl": "https://<this-site's-domain>/pricing"
  }

The response is JSON: { "checkoutUrl": "https://checkout.stripe.com/..." }.
Redirect the browser to that URL (window.location.href = response.checkoutUrl).
Show an inline error if the request fails instead of redirecting.
```

Note the literal `{CHECKOUT_SESSION_ID}` in `successUrl` above — that's
Stripe's own template syntax; Stripe substitutes it automatically when
redirecting back, so the success page receives the real session ID as a
query param without any extra work.

### 2. The `/welcome` success page

```
Prompt for Lovable:

Create a /welcome page. If the URL has a session_id query param, show:

  "You're in! Your 7-day free trial has started."
  [Add Corner to Chrome] button

The button should link to:
  https://chromewebstore.google.com/detail/REPLACE_WITH_REAL_EXTENSION_ID

(That URL only becomes real once Corner is published to the Chrome Web
Store — use a placeholder/coming-soon state until then.)

Below the button, add:
  "After installing, open Corner from your browser toolbar and sign in
   with the same email you just used."
```

### 3. Nothing else needs to change on this side for now

The actual account creation, subscription tracking, and trial countdown
all happen server-side (Stripe webhook → Supabase) once step 1 above fires
a real checkout — the website doesn't need to talk to Supabase directly at
all for this first version.

## What's *not* built yet: skipping the second sign-in

Right now, after installing from the Chrome Web Store, the rep still has
to manually enter their email and a 6-digit code in the side panel — same
as during all the manual testing so far — even though they just gave their
email to Stripe seconds earlier. A smoother version of this (no second
code entry) is possible via Chrome's `externally_connectable` manifest
API, which lets this specific website message the extension directly right
after install. Not built yet because it needs one thing decided first:

**Does the Lovable site itself already use Supabase for anything** (auth,
data, etc.)? If yes, the handoff can piggyback on a session Lovable's own
Supabase client already has. If no, a small dedicated
"mint a one-time sign-in code" edge function is the cleaner path. Either
way this is a follow-up, not a blocker for the trial → install flow above
working end to end.

## What Corner needs from you to actually go live end to end

- **Stripe secrets**, added as Cloud Agent secrets so they can be set on
  the Supabase project:
  - `STRIPE_SECRET_KEY` — your Stripe secret API key (starts `sk_live_...`
    or `sk_test_...` for testing first, which is recommended).
  - `STRIPE_PRICE_ID` — the Price ID (not Product ID — starts `price_...`)
    for the plan the 7-day trial should attach to.
  - `STRIPE_WEBHOOK_SECRET` — created after adding the webhook endpoint
    below in the Stripe Dashboard (Developers → Webhooks → Add endpoint →
    `https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/stripe-webhook`,
    subscribed to `checkout.session.completed`,
    `customer.subscription.created`, `customer.subscription.updated`,
    `customer.subscription.deleted`) — Stripe shows the signing secret
    (`whsec_...`) once that endpoint is created.
- **The real marketing site domain**, to fill in `VITE_MARKETING_SITE_URL`
  (used by the extension's "Start free trial"/"Reactivate your plan" links
  when a rep's trial has ended) and the `successUrl`/`cancelUrl` above.
