# Corner

*The private deal coach you talk to.*

A voice-first sales coaching Chrome extension. We're the selling layer above
the CRM, not another CRM: the extension reads live deal data from HubSpot or
Pipedrive, coaches the rep out loud via ElevenLabs (no chat UI), and only
writes back to the CRM after the rep explicitly confirms.

Formerly named "Talk to CRM" — renamed to match the marketing site's branding.

## Status

- ✅ **Step 1** — deal detection: the extension detects when a rep is on a
  HubSpot or Pipedrive deal page and shows it in the side panel.
- ✅ **Step 2** — CRM connections: HubSpot/Pipedrive OAuth connect via
  `chrome.identity`, and a `crm-proxy` edge function that reads real deal
  data (summary, contacts, recent calls/notes/emails).
- ✅ **Step 4** — a live ElevenLabs voice session in the side panel, with
  mid-call tool calling wired to real CRM data via `crm-proxy`.
- ✅ **Reverse-trial billing** — install-first, no sign-up gate (an
  anonymous Supabase account starts a 7-day trial automatically), a
  day-5 nudge to link an email, and a day-7 Stripe paywall. See
  `mem/design/reverse-trial-v1.md`. Built and deployed, but needs real
  Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET`) to actually charge a card — see
  `docs/lovable-integration.md`.
- ⏳ Not yet built: CRM writes (`push_to_crm`), coaching memory
  (`recall_notebook`, `save_note`), and the playbook (`lookup_playbook`) —
  all four already exist as client tools on the ElevenLabs agent, but have
  no backend behind them yet. Also not yet built: publishing to the Chrome
  Web Store (materials drafted in `docs/chrome-web-store-listing.md`, but
  not yet submitted).

## Prerequisites

- Node.js 22+
- npm (ships with Node)
- A Supabase project (migrations in `supabase/migrations/`, edge functions in
  `supabase/functions/`)
- An ElevenLabs Conversational AI agent with `get_deal_snapshot` and
  `get_recent_activities` client tools configured (`expects_response: true`
  on both)

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL/anon key, HubSpot/Pipedrive client IDs, ElevenLabs agent ID
```

`.env.local` only ever holds values safe to ship inside the built extension
bundle — client secrets (`HUBSPOT_CLIENT_SECRET`, `PIPEDRIVE_CLIENT_SECRET`,
`ELEVENLABS_API_KEY`) are Supabase edge function secrets only, set via
`supabase secrets set`, never in this file.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts Vite in watch mode with HMR (`@crxjs/vite-plugin`), writing a live-reloading build to `dist/`. |
| `npm run build` | Produces a production build in `dist/`. |
| `npm test` | Runs the Vitest unit tests for the URL detectors. |
| `npm run lint` | Runs ESLint. |

## Load the extension in Chrome

1. Run `npm run build` (or `npm run dev` for a build that hot-reloads as you edit).
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right corner).
4. Click **Load unpacked**.
5. Select the `dist/` folder in this repo.
6. Pin the "Corner" icon to your toolbar (puzzle-piece icon → pin) for easy access.
7. Click the toolbar icon — it opens the side panel directly (no popup).

**After every `npm run build`** (or whenever `npm run dev`'s watcher rebuilds),
if the extension doesn't seem to have picked up the change, go back to
`chrome://extensions` and click the refresh icon on the "Corner" card. If
you're using `npm run dev`, CRXJS's HMR usually reloads the side panel and
content scripts automatically without needing this. Content scripts are also
auto-injected into any already-open HubSpot/Pipedrive tabs on install/reload
(see `src/background/index.ts`), so a stale "No deal detected" on a real deal
page shouldn't require a manual tab refresh either.

The extension's ID is pinned to `noljedpanlelibpakngfgmiopmcdhgdo` via the
`key` field in `manifest.config.ts`, so it stays the same no matter how many
times you remove/reload it or which machine/folder you unpack it in — this
is the ID for **local/unpacked installs only** (`npm run build`, `dist/`).

**The published Chrome Web Store copy has a different, Chrome-assigned ID:
`dpadpffnlgkbpakbfnnjnegdolfgfeio`** (listing:
<https://chromewebstore.google.com/detail/corner/dpadpffnlgkbpakbfnnjnegdolfgfeio>).
The Chrome Web Store dashboard rejects a manifest `key` field on a brand-new
item (see `npm run build:store`, which omits it — outputs to `store-build/`,
not `dist/`), so there was never a way to make the published ID match the
pinned local one.

This matters because Pipedrive's OAuth app allows only **one** registered
Callback URL, and reuses that same URL for its uninstall webhook too —
unlike HubSpot, which accepts multiple redirect URLs. That single URL is
**not** a `chromiumapp.org` address at all anymore (see the next section)
— HubSpot's redirect URL should have both extension IDs registered once
HubSpot comes back into scope (see `ConnectCrmCard.tsx`'s hidden flag), so
the "which ID is registered" question doesn't bite the same way there.

### Pipedrive's Callback URL is a real server now, not `chromiumapp.org`

Two earlier fixes to Pipedrive's Callback URL (adding a path segment in
v0.1.1) turned out to be chasing the wrong theory. The actual blocker,
confirmed both by a Pipedrive team member on their own developer forum
and independently here — `https://<extension-id>.chromiumapp.org/...`
returns **NXDOMAIN**, it doesn't resolve on the public internet at all —
is that Pipedrive requires its one Callback URL to be a genuinely live,
reachable HTTPS endpoint ("so Pipedrive Marketplace team will be able to
install and test the app"). `chromiumapp.org` is a Chrome-internal
pseudo-domain `chrome.identity.launchWebAuthFlow` intercepts before any
real network request happens — nobody, including Pipedrive, could ever
actually reach it.

**Fixed in v0.1.3** with a real Supabase edge function,
`pipedrive-oauth-redirect`, registered as Pipedrive's one Callback URL
instead: `https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/pipedrive-oauth-redirect`.
On `GET` (the live OAuth redirect), it 302s the `code`/`state`/`error`
query params on to the extension's real `chromiumapp.org` URL — Chrome's
`launchWebAuthFlow` watches every navigation in its flow window for a URL
matching that pattern, however many redirect hops it took to get there
(confirmed against Chromium's own `WebAuthFlow` source), so this extra
real hop is invisible to `connectCrm()`, which still gets back exactly
the same final URL as before. `connect.ts` sends this proxy URL — not
`chrome.identity.getRedirectURL()` directly — as the `redirect_uri` for
Pipedrive specifically; HubSpot is unaffected.

Bonus: this also finally gives Corner a real endpoint to receive
Pipedrive's uninstall webhook on (`DELETE`, authenticated via HTTP Basic
Auth) — see `mem/design/pipedrive-uninstall-v1.md` for the full history
of why that wasn't possible before this change.

Connecting Pipedrive from a **local unpacked build** will fail with
"Redirect URI match failed" as long as the registered Callback URL is
this real proxy URL (correct for the published version) rather than the
old bare `chromiumapp.org` address — either switch the Developer Hub
setting back temporarily, or register a second, dev-only Pipedrive app
for local testing.

**This is a developer-only workflow** — there is no way for a website to
silently or automatically install a Chrome extension for a visitor. Getting
this in front of real users requires publishing to the Chrome Web Store
(a one-time $5 developer registration + Google's review process), after
which people can install it with one real click of an "Add to Chrome" button.

## Verifying the extension works end to end

1. Load the unpacked extension per above.
2. Open the side panel (toolbar icon) — no sign-in step: an anonymous
   Supabase account is created silently and a 7-day trial starts
   automatically (see `mem/design/reverse-trial-v1.md`).
3. Click "Connect Pipedrive" (or HubSpot) and approve the OAuth consent screen.
4. Open a real deal — the side panel should show "Deal detected," the
   provider badge, the deal ID, and an "Open in HubSpot/Pipedrive" link.
5. Click "Talk about this deal" in the "Talk it through" card, allow
   microphone access, and ask about the deal — the agent should call
   `get_deal_snapshot`/`get_recent_activities` and answer with real data,
   not a generic response.
6. Switch to a different tab or app mid-conversation and back — both the
   call and deal detection should keep working the whole time.

## Project layout

- `manifest.config.ts` — typed MV3 manifest (via `@crxjs/vite-plugin`)
- `src/content/` — content scripts that detect the deal on HubSpot/Pipedrive pages
- `src/background/` — MV3 service worker relaying deal state to the side panel
- `src/sidepanel/` — the React UI that renders in Chrome's side panel
- `src/lib/deal-detection/` — pure URL-matching logic (unit tested)
- `src/lib/crm-connect/` — OAuth connect flow (`chrome.identity.launchWebAuthFlow`)
- `src/lib/elevenlabs/` — the voice session: conversation token fetch, client tools
- `src/lib/billing/` — fetches a Stripe Checkout URL for the day-7 paywall
- `src/lib/chrome/messaging.ts` — the message contract between content scripts, background, and side panel
- `supabase/migrations/` — `crm_connections`, `crm_writes` (nothing writes to the latter yet), `subscriptions`
- `supabase/functions/` — `crm-proxy`, `*-oauth-exchange`, `elevenlabs-conversation-token`, `stripe-create-checkout-session`, `stripe-webhook`
- `mem/` — design notes, mirroring the convention from the main sales-playbook-builder repo
- `docs/` — Chrome Web Store submission materials and the marketing-site integration spec (not read by the app at runtime)

## What's NOT here yet

CRM writes, coaching memory, and the playbook (see "Status" above) — all
four already have client tools configured on the ElevenLabs agent, but no
backend built for them yet. Also not here: publishing to the Chrome Web
Store (materials drafted, not submitted), and real Stripe secrets (the
billing code is built and deployed but can't charge a real card without
them — see `docs/lovable-integration.md`).
