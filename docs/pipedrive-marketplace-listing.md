# Pipedrive Marketplace submission materials

Everything needed for the Pipedrive Developer Hub submission (Developer
Hub → Marketplace listing / Onboarding for users), drafted ahead of
actually publishing — same purpose as `docs/chrome-web-store-listing.md`,
for the other store. None of this is used by the extension at runtime.

## Onboarding for users — content blocks

Pipedrive shows these to a user right after they install the app from the
Marketplace, before they've done anything with it — 1–4 blocks, each with
a Title (70 char limit), Description (200 char limit), an optional "Learn
more" link, and an image (PNG/JPG, max 300KB, min 720×400px, 9:5 aspect
ratio — Pipedrive adds a `#CFD0F9` border automatically, don't add one).

**Block 1**
- Title: `Talk through your deal, out loud`
- Description: `Open a deal, click "Talk about this deal" in Corner's side panel, and coach yourself through it by voice — no forms, no chat window to type into.`

**Block 2**
- Title: `Corner already knows the deal`
- Description: `No manual entry. Corner reads the deal's stage, value, and recent activity straight off the Pipedrive page the moment you open it.`

**Block 3**
- Title: `Read-only, until you say otherwise`
- Description: `Corner never writes back to Pipedrive without your explicit, spoken confirmation first. Nothing changes in your CRM behind your back.`

**Block 4 (optional)**
- Title: `Get started in under a minute`
- Description: `Connect Pipedrive from Corner's side panel, open a deal, and start talking. Your first 7 days of Corner Pro are free — no card required.`

**Learn more link (all blocks):** `https://mycornercoach.com` — no
dedicated feature/help pages exist yet to link individual blocks to
something more specific; revisit once the marketing site has them.

**Images:** need real screenshots or a designed graphic per block —
same constraint as the Chrome Web Store listing's screenshots (this
agent can't capture a live Pipedrive + Corner session). Either take
real screenshots of the side panel in use against a real deal, or ask
for a designed graphic (brand-aligned, not a literal screenshot) to be
generated instead.

## General info

**Main contact email:** `drew@salesplaybookbuilder.com`

**Use case** (350 char limit — reviewer-only, never shown publicly):
> Sales reps usually get coaching in quarterly reviews, not right before the calls that matter. Corner is a voice-first coach in Pipedrive's side panel: a rep opens a deal, talks it through out loud, and Corner reads that deal's live stage, value, and recent activity to ask sharper questions and flag risk before the next call.

## Demo video script (installation flow recording)

Pipedrive requires one recording covering three docs at once:
[scopes and permissions](https://pipedrive.readme.io/docs/marketplace-scopes-and-permissions-explanations),
[installation flows](https://pipedrive.readme.io/docs/app-installation-flows),
[uninstallation](https://pipedrive.readme.io/docs/app-uninstallation) — plus
"demonstrate the key functionality." It's only ever seen internally by the
review team, so it doesn't need production polish, just to clearly show
each required moment in order. Roughly 3–4 minutes total.

**1. Scopes and permissions (~30s)**
- Show: Developer Hub → the app's "OAuth & access scopes" tab, with the
  five requested scopes visible (`base`, `deals:read`, `contacts:read`,
  `activities:read`, `mail:read`).
- Say, pointing at each: "Corner only requests read scopes — it can't create,
  edit, or delete anything in Pipedrive. `deals:read` lets it see a deal's
  stage, value, and notes; `contacts:read` lets it see who's on the deal;
  `activities:read` lets it see logged calls and meetings; `mail:read` lets
  it see relevant email threads. `base` is the default scope every app gets,
  for basic account info."

**2. Installation flow (~60–90s)**
- Show: the Pipedrive Marketplace listing page → click "Install now" (or
  "Proceed to install") → the OAuth confirmation dialog opens in a new tab,
  showing those same scopes → click "Allow and Install."
- Show: back in Chrome, open the Corner side panel (click the toolbar icon)
  → it shows "Connect Pipedrive" → click it → the same Pipedrive OAuth
  screen opens (via `chrome.identity`, as a popup this time, not a new
  tab) → Allow → side panel now shows "Pipedrive: Connected."
- Say: "Installing from the Marketplace and connecting from inside the
  extension both go through this same Pipedrive consent screen. Once
  approved, Corner shows the connected state immediately — no extra setup
  step."

**3. Key functionality (~60–90s)**
- Show: navigate to a real deal page in Pipedrive → the side panel
  automatically detects it and shows the deal's name, stage, and amount →
  click "Talk about this deal" → say something short out loud (e.g. "catch
  me up on this deal") → Corner responds out loud, referencing the deal's
  actual stage/value/recent activity.
- Say: "Corner reads deal data straight off the page you're already
  looking at — no separate dashboard, no manual entry. 'Talk about this
  deal' starts a live voice conversation; Corner already knows this
  deal's context and coaches the rep out loud."

**4. Uninstallation (~30–45s)**
- Show: in Pipedrive, go to Settings → Marketplace apps (or wherever
  installed apps are managed for this account) → find Corner → Uninstall.
- Show: back in the Corner side panel, either reopen it or try to open a
  deal/click "Talk" again — it should now show a "Pipedrive connection
  needs reconnecting" prompt instead of pretending the old connection
  still works (see `mem/design/pipedrive-uninstall-v1.md` for why this is
  reactive rather than an instant server-pushed notification — Pipedrive's
  uninstall webhook reuses the same single Callback URL as OAuth, which
  for this Chrome-extension app has to be the extension's own
  `chromiumapp.org` address, not a server Corner controls).
- Say: "When a user uninstalls Corner, Pipedrive revokes its access.
  The next time Corner tries to use that connection, it detects the
  revoked access, clears it, and asks the rep to reconnect — it never
  keeps working with a broken connection silently."

## Still to fill in (not yet drafted here)

- **General info** tab
- **Marketplace listing** → general info / setup and installation info /
  support and legal info / review info
- App icon, category, keywords

Revisit and fill these in as the submission flow reaches them.
