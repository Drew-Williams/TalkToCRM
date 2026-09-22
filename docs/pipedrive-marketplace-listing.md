# Pipedrive Marketplace submission materials

Everything needed for the Pipedrive Developer Hub submission (Developer
Hub → Marketplace listing / Onboarding for users), drafted ahead of
actually publishing — same purpose as `docs/chrome-web-store-listing.md`,
for the other store. None of this is used by the extension at runtime.

## Basic info — Callback URL (the actual "Send to review" blocker)

This kept failing with "Enter a valid URL" through several rounds of
troubleshooting (bare root, then a `/pipedrive-oauth-callback` path) —
the real cause, confirmed by a Pipedrive team member on their own
developer forum and independently by testing (`chromiumapp.org` returns
NXDOMAIN, it doesn't resolve on the public internet), is that Pipedrive
requires this field to be a genuinely live, reachable HTTPS endpoint, not
just a valid-looking URL string. Full explanation:
`mem/design/pipedrive-uninstall-v1.md`'s third addendum.

**Once v0.1.3 is live on the Chrome Web Store and has had time to
propagate** (same rollout-sequencing caution as every earlier Callback
URL change — real users are connected via the old URL on the
currently-published version), set the Callback URL to:
```
https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/pipedrive-oauth-redirect
```
This is a real Corner-controlled server (a Supabase edge function), not
a `chromiumapp.org` address — it should finally pass Pipedrive's
reachability check.

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

## Setup and installation info

**Setup/installation instructions** (shown to users deciding whether to
install, plain step-by-step):
> 1. Click "Install now" and approve the requested permissions — Corner only ever reads deal, contact, activity, and mail data; it never writes to Pipedrive without your explicit confirmation.
> 2. Open the Corner extension from your Chrome toolbar (pin it for one-click access) and click "Connect Pipedrive" — this reuses the same account you just installed the app with.
> 3. Open any deal in Pipedrive. Corner detects it automatically and shows its stage, value, and recent activity in the side panel.
> 4. Click "Talk about this deal" and start talking — Corner already knows the deal's context.
>
> No separate account to create, no configuration screen, no admin setup required. Your first 7 days of Corner Pro are free from the moment you install.

**Does this app require any special account/admin setup?** No — any
Pipedrive user can install and connect on their own; no admin
pre-configuration is required (matches the "handle non-admin users
installing the app" requirement in Pipedrive's own review checklist,
since Corner requests no `admin` scope at all).

## Support and legal info

**Support email:** `success@salesplaybookbuilder.com`

**Support phone (optional):** `416-550-0497`

**Privacy Policy URL:** `https://mycornercoach.com/privacy` (full text
drafted in `docs/chrome-web-store-listing.md` — same policy for both
stores, keep them in sync if it's ever updated)

**Terms of Service URL:** needs a live page — no ToS has been drafted
yet in this repo. A short, standard SaaS ToS (subscription billing terms,
acceptable use, disclaimer of warranty, limitation of liability) would
need to be drafted and published at e.g. `https://mycornercoach.com/terms`
before this field can be filled in for real. Flag if you want this
drafted now — it's a gap, not yet something to paste in.

## Still to fill in (not yet drafted here)

- **App icon, category, keywords** — icon already exists (`dist/icons/icon-128.png`,
  reused from the Chrome Web Store submission); category is naturally
  "Sales" or "Productivity" if Pipedrive offers those; keywords:
  `voice`, `coaching`, `sales coaching`, `deal review`, `AI assistant`.
- **Terms of Service** — see above, the one real gap left before "Send
  to review" can go through cleanly if that field is required.

## Publishing — what actually happens after "Send to review"

1. Once every tab shows no red-flagged fields, go to **App review info**
   and click **Send to review**. Provide the demo video URL, the use
   case text, and a real Pipedrive test account + login for the
   reviewer to actually use (per Pipedrive's own checklist — they log in
   and test the app themselves, not just watch the video).
2. The app's status changes to "In review" in Developer Hub, and
   Pipedrive emails a confirmation. Their own current banner warns
   review can take **up to 21 business days**.
3. If approved: you'll get an email, and the status changes to
   "Approved" in Developer Hub. **The app is unlisted from the
   Marketplace by default even once approved** — it is not
   automatically public.
4. **To actually go live**, go to the app's row in Developer Hub, click
   the **"..."** menu next to its name, and click **Publish**. Only
   after this does it show up in the public Marketplace listing search.
5. If rejected: you'll get an email with the specific reason(s); fix
   those and resubmit — there's no separate appeals process, just a
   corrected resubmission.

There is no other "publish" action beyond that — Pipedrive's own review
is the gate, and the Publish button afterward is a deliberate second
step so an approved app doesn't go live before you're ready to announce
it.
