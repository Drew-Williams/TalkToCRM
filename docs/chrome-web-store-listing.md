# Chrome Web Store submission materials

Everything needed for the Chrome Web Store Developer Dashboard submission,
drafted ahead of actually publishing. None of this is used by the extension
at runtime — it's reference content to paste into Chrome's dashboard and
the marketing site.

## Before you can submit

1. ✅ Register a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) — one-time $5 fee.
2. Get the privacy policy below live at a real, public URL — `mycornercoach.com/privacy` is the natural place (the marketing site's footer already links there). Chrome requires linking to a live page, not just pasting text into their form.
3. Capture at least one real screenshot of the side panel in use (1280×800 or 640×400 px) and ideally a promo tile (440×280 px) — these need actual product screenshots, which this agent can't generate; take them from a real loaded session (e.g. the "Talk it through" card mid-conversation, or a deal detected view).
4. Have `dist/` built and zipped as the upload package — see "Submitting" below for exact steps.

## Store listing copy

**Name:** Corner

**Category:** Productivity (or "Sales" if Chrome offers a more specific
sub-category at submission time)

**Short description** (132 character limit):
> The private deal coach you talk to. Corner reads your CRM and coaches you out loud — no chat UI, no silent CRM writes.

**Detailed description:**
> Corner is a voice-first sales coach that lives in your browser's side panel. Open any Pipedrive deal, click "Talk about this deal," and talk it through out loud — Corner already knows the deal, its stage, its value, and its recent activity.
>
> **What Corner does:**
> - Reads deal data directly off the Pipedrive page you're viewing — no manual data entry, no separate dashboard to check.
> - Answers questions about the deal's status, recent calls, notes, and emails by pulling live data from your connected CRM.
> - Talks with you in a real voice conversation, not a chat window — ask a question out loud, get an answer out loud.
> - Never changes anything in your CRM without your explicit, spoken confirmation. (CRM writes are a planned feature, not yet available.)
>
> **Your data:**
> - Corner only reads the CRM you explicitly connect via OAuth — nothing is read without your permission.
> - Deal data is fetched live for each conversation; Corner does not maintain its own copy of your CRM database.
> - See our Privacy Policy for full details.
>
> Install and start talking immediately — no sign-up, no card. Your first 7 days of Corner Pro are free, starting the moment you open the side panel. Add your email anytime to keep your sessions if you switch computers, and connect Pipedrive whenever you're ready to talk through a real deal.

## Permission justifications

Chrome's review process requires a plain-language justification for each
requested permission. Exact text to paste into the dashboard's
"Permission justification" fields.

Pipedrive-only for this submission (see `manifest.config.ts`) — HubSpot
support still exists in code but isn't a requested permission or an
offered connect option right now, so these justifications only mention
what's actually requested. Update both the manifest and this doc together
if/when HubSpot comes back into scope, not one without the other —
Chrome's own review guidance treats a requested-but-unused permission as
grounds for rejection, not just extra scrutiny.

**`sidePanel`**
> Corner's entire interface lives in Chrome's side panel rather than a popup, so the rep can keep it open alongside the CRM page they're viewing.

**`identity`**
> Used exclusively for `chrome.identity.launchWebAuthFlow`, so a user can connect their Pipedrive account via Pipedrive's own OAuth consent screen. This does not use `chrome.identity.getAuthToken` and never accesses the user's Google account information.

**`scripting`**
> Used to inject Corner's deal-detection script into Pipedrive tabs that were already open before the extension was installed or updated. Without this, a rep who already had a deal page open would need to manually refresh that tab before Corner could detect it.

**`storage`**
> Used to remember small preferences locally on the user's device — for example, whether a one-time onboarding tip has already been shown, or a reminder banner already dismissed. This never stores CRM data, deal data, or personal information, and nothing here is synced or sent anywhere.

**Host permission (`https://*.pipedrive.com/*`)**
> Corner reads deal information directly from the Pipedrive page the user is currently viewing. This is the only site Corner runs on or reads from — no other website's content is accessed.

## Data usage disclosure (Privacy practices tab)

Chrome's dashboard requires declaring what user data the extension
collects/uses. Accurate answers for Corner:

| Category | Collected? | Notes |
| --- | --- | --- |
| Personally identifiable information | Yes | An anonymous account is created automatically on first use — no email required. An email address is only collected if the user chooses to link one (to keep their account recoverable) or when starting a paid plan. |
| Authentication information | Yes | OAuth tokens for the connected CRM(s), stored server-side (Supabase), never in the extension itself. |
| Website content | Yes | Deal data read from the Pipedrive page/API the user is viewing. |
| Location | No | |
| Health info | No | |
| Financial info | Yes | Only if/when the user starts a paid plan — payment is handled entirely by Stripe's own hosted checkout; Corner never receives or stores card details. |
| Personal communications | Yes | Recent CRM activity the user asks about — calls, notes, emails logged in their own CRM (not the user's personal email/messages outside the CRM). |
| Web browsing history | No | Corner only reads the current Pipedrive tab's content, not browsing history. |

Also required: a checkbox confirming the extension does not sell user data
to third parties, and does not use data for purposes unrelated to the
extension's core function — both true for Corner.

**Remote code:** Corner ships no remote-code execution of any kind — the
entire extension (all JS) is bundled at build time and reviewed as part of
the submission, matching Chrome's Manifest V3 requirements. Confirm "No" on
the remote code declaration.

## Privacy policy

Full text to put on `mycornercoach.com/privacy` (paste into Lovable, or hand
this to whoever's editing that project):

> ## Corner Privacy Policy
>
> *Last updated: [fill in the date you publish this]*
>
> Corner ("we," "our," "the extension") is a Chrome extension that reads live CRM deal data and coaches sales reps out loud. This policy explains what data Corner collects, why, and how it's handled.
>
> ### What we collect
>
> - **Account data.** When you install Corner, an anonymous account is created automatically — no email or personal information is required to start using it. If you choose to add an email (to keep your account if you switch computers or clear browser data), or when you start a paid plan, we store that email address.
> - **CRM connection data.** If you connect a Pipedrive account, we store the OAuth access/refresh tokens for that connection on our servers (Supabase), encrypted at rest. These tokens are never sent to or stored in the extension itself, and never leave our servers except to call Pipedrive's own API on your behalf.
> - **Deal data.** When you ask Corner about a deal, it fetches that deal's data (name, stage, value, contacts, recent calls/notes/emails) live from your connected CRM for that conversation. Corner does not maintain its own permanent copy of your CRM database.
> - **Payment data.** If you upgrade to a paid plan, payment is processed entirely by Stripe. Corner never receives or stores your card details — only Stripe's confirmation that a subscription is active.
> - **Voice data.** Conversations with Corner's voice agent are processed by ElevenLabs (our voice AI provider) to enable the real-time conversation. We do not separately record or store your voice audio.
>
> ### What we don't do
>
> - We do not sell your data to any third party.
> - We do not use your CRM data, deal information, or conversations for advertising.
> - We do not read or access any website other than the Pipedrive page you're actively viewing.
> - Corner does not write to, modify, or delete anything in your CRM without your explicit, spoken confirmation during a conversation.
>
> ### Data retention and deletion
>
> You can disconnect a CRM connection at any time from Corner's side panel, which deletes the stored OAuth tokens for that connection. To request full deletion of your account and all associated data, contact us at success@salesplaybookbuilder.com.
>
> ### Changes to this policy
>
> We'll update the "last updated" date above if this policy changes, and post the updated version here.
>
> ### Contact
>
> Questions about this policy or your data: success@salesplaybookbuilder.com or 416-550-0497.

## Submitting (now that the developer account is registered)

1. **Build and zip the upload package.**
   - Pull the latest `dist/` from the `cursor/crm-proxy-oauth-52ee` branch (or wherever this has since merged to).
   - Zip the *contents* of `dist/` (not the `dist` folder itself — `manifest.json` needs to be at the root of the zip, not one level down).
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New item** → upload that zip.
3. **Store listing tab**: paste in the name/short description/detailed description from above, pick a category, upload the screenshot(s) (see "Before you can submit" #3 — these still need to be captured from a real running session), and use `icons/icon-128.png` from `dist/` as the store icon if it asks for one separately.
4. **Privacy practices tab**: paste in the permission justifications above, fill in the data-usage disclosure table above, link to `https://mycornercoach.com/privacy` (make sure that page is actually live first — it returned a connection error as of this writing, see the domain/SSL note elsewhere in this PR), and confirm "No remote code."
5. **Distribution tab**: Visibility → Public (or "Unlisted" first if you want to test the real install flow privately before announcing). Pricing → Free (Corner's own subscription is billed through Stripe inside the extension, not through Chrome's listing price).
6. **Submit for review.**
7. Once approved, copy the real listing URL (`https://chromewebstore.google.com/detail/<id>`) and swap it into `chromeStoreUrl` in the Lovable site's `src/content/site.ts`, replacing the placeholder.

## Live status

Published: <https://chromewebstore.google.com/detail/corner/dpadpffnlgkbpakbfnnjnegdolfgfeio>
(the real, Chrome-assigned extension ID — different from the pinned local/
unpacked dev ID, `noljedpanlelibpakngfgmiopmcdhgdo`; see README.md's
"pinned extension ID" section and `mem/design/pipedrive-uninstall-v1.md`
for why that split matters for Pipedrive OAuth specifically).

**"This extension is not trusted by Enhanced Safe Browsing" install
warning** — seen on the listing page by anyone who has Chrome's Enhanced
Safe Browsing setting turned on (`chrome://settings/security`; most users
are on the default Standard protection and never see this). This is not a
Chrome Web Store review flag or a problem with Corner — Google's own docs
state new developer accounts simply take "a few months" of a clean policy
record to be marked trusted, automatically, with no application process.
Users can still click "Continue to install." One thing worth doing:
verify `mycornercoach.com` in [Google Search Console](https://search.google.com/search-console)
and make sure that same domain is set as Corner's website in the
Developer Dashboard's store listing — several developers in Google's own
support threads reported this helped their verified/trusted status
appear sooner, though it's not officially documented as a guarantee.

## Why this matters early, not right before "launch day"

Chrome's review process typically takes a few days but can run longer,
especially for a new developer account's first submission or if the
`identity`/`scripting`/host-permission combination draws extra scrutiny —
worth submitting as soon as the listing materials and a stable build are
ready, well before any planned public launch date.
