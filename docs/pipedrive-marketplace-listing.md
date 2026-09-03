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
each required moment in order and say each line below (or close to it)
out loud while you do. Roughly 3.5–4.5 minutes total. Read each "SAY" line
naturally, in your own voice — it doesn't need to be word-for-word.

Before you hit record: have a Pipedrive test account signed in, a real
deal open in a background tab, and Corner already showing "not connected"
(disconnect it first if it's currently connected) so scene 2 is genuine,
not staged.

---

### Scene 1 — Scopes and permissions (~30s)

**ON SCREEN:** Developer Hub → your app → "OAuth & access scopes" tab,
with all five requested scopes visible on screen at once.

**SAY:**
> "Before we get into installing the app, here's what Corner actually asks for. It's five scopes, and every one of them is read-only — Corner cannot create, edit, or delete anything in a user's Pipedrive account.
>
> `deals:read` lets it see a deal's stage, value, and notes. `contacts:read` lets it see who's attached to the deal. `activities:read` lets it see logged calls and meetings. `mail:read` lets it see relevant email threads tied to the deal. And `base` is the default scope every Pipedrive app gets automatically, for basic account info like the user's name.
>
> That's the entire footprint — no write access of any kind."

---

### Scene 2 — Installation flow (~75–90s)

**ON SCREEN:** The Pipedrive Marketplace listing page for Corner (or the
"Proceed to install" test link) → click it.

**SAY:**
> "Now let's install it the way a real user would. I'll click Install from the Marketplace listing."

**ON SCREEN:** The OAuth confirmation dialog opens in a new tab, showing
the same five scopes from Scene 1. Click "Allow and Install."

**SAY:**
> "This opens Pipedrive's own consent screen, showing the exact same scopes I just walked through. I'll click Allow and Install."

**ON SCREEN:** Switch to Chrome, click the Corner toolbar icon to open
the side panel. It shows a "Connect Pipedrive" button (not yet connected).
Click it.

**SAY:**
> "Now, over in the Chrome extension itself — Corner's interface lives in the browser's side panel, not inside Pipedrive. The first thing it asks for is connecting your Pipedrive account, so I'll click Connect."

**ON SCREEN:** The same Pipedrive OAuth consent screen opens again, this
time as a popup window (via `chrome.identity`) rather than a browser tab.
Click Allow. The side panel updates to show "Pipedrive — Connected."

**SAY:**
> "Same consent screen, same scopes, just opened from inside the extension this time. Once I approve it, Corner shows the connected state immediately — that's it, no further setup, no separate account to create."

---

### Scene 3 — Key functionality (~75–90s)

**ON SCREEN:** Switch to the tab with a real Pipedrive deal open. The
Corner side panel automatically detects it and shows the deal's name,
stage, and amount within a couple seconds.

**SAY:**
> "Here's a real deal open in Pipedrive. Corner detects it automatically the moment the page loads — you can see it already showing the deal name, stage, and value here in the side panel, read straight off the page. No dashboard to switch to, nothing to type in."

**ON SCREEN:** Click "Talk about this deal." Wait for the connecting
state, then speak a short, real question out loud (e.g. "Catch me up on
this deal" or "What's the risk here?").

**SAY (before clicking):**
> "Now I'll click Talk about this deal and actually talk to it."

**(then speak your real question to the agent, and let it respond — capture its actual spoken answer referencing the deal's real stage/value/activity)**

**SAY (after the response):**
> "That's the core of Corner — a live voice conversation where it already knows this specific deal's context, and coaches the rep out loud instead of just displaying data."

---

### Scene 4 — Uninstallation (~30–45s)

**ON SCREEN:** In Pipedrive, go to Settings → Marketplace apps (or
wherever installed apps are managed for this account) → find Corner →
Uninstall.

**SAY:**
> "Last, uninstalling. I'll go to the installed apps list in Pipedrive settings and remove Corner."

**ON SCREEN:** Back in Chrome, reopen the Corner side panel (or click
"Talk about this deal" again on the still-open deal page). It now shows
a "Pipedrive connection needs reconnecting" message instead of the
previous connected state.

**SAY:**
> "And back in the extension — the next time Corner tries to use that connection, it detects that access was revoked, clears the stale connection on its own, and asks the rep to reconnect. It never keeps working silently with a broken connection."

---

**Why Scene 4 looks the way it does, not like a server push:** Pipedrive's
uninstall notification is a webhook sent to the same single Callback URL
registered for OAuth — and for a Chrome extension using
`chrome.identity.launchWebAuthFlow`, that URL has to be the extension's
own `chromiumapp.org` address, which isn't a server Corner controls.
There's no way to receive that webhook directly given that constraint
(see `mem/design/pipedrive-uninstall-v1.md` for the full reasoning), so
Corner instead detects the revoked access reactively, the next time the
connection is actually used — which is exactly what Scene 4 shows.

## Still to fill in (not yet drafted here)

- **General info** tab
- **Marketplace listing** → general info / setup and installation info /
  support and legal info / review info
- App icon, category, keywords

Revisit and fill these in as the submission flow reaches them.
