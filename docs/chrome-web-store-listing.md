# Chrome Web Store submission materials

Everything needed for the Chrome Web Store Developer Dashboard submission,
drafted ahead of actually publishing. None of this is used by the extension
at runtime — it's reference content to paste into Chrome's dashboard and
the marketing site.

## Before you can submit

1. Register a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) — one-time $5 fee.
2. Have the privacy policy below live at a real, public URL (the marketing
   site's existing footer "Privacy policy" link is the natural place —
   Chrome requires linking to it, not just pasting text into their form).
3. Capture at least one real screenshot of the side panel in use (1280×800
   or 640×400 px) and ideally a promo tile (440×280 px) — these need actual
   product screenshots, which this agent can't generate; take them from a
   real loaded session (e.g. the "Talk it through" card mid-conversation,
   or a deal detected view).
4. Have `dist/` built and zipped as the upload package.

## Store listing copy

**Name:** Corner

**Category:** Productivity (or "Sales" if Chrome offers a more specific
sub-category at submission time)

**Short description** (132 character limit):
> The private deal coach you talk to. Corner reads your CRM and coaches you out loud — no chat UI, no silent CRM writes.

**Detailed description:**
> Corner is a voice-first sales coach that lives in your browser's side panel. Open any HubSpot or Pipedrive deal, click "Talk about this deal," and talk it through out loud — Corner already knows the deal, its stage, its value, and its recent activity.
>
> **What Corner does:**
> - Reads deal data directly off the HubSpot/Pipedrive page you're viewing — no manual data entry, no separate dashboard to check.
> - Answers questions about the deal's status, recent calls, notes, and emails by pulling live data from your connected CRM.
> - Talks with you in a real voice conversation, not a chat window — ask a question out loud, get an answer out loud.
> - Never changes anything in your CRM without your explicit, spoken confirmation. (CRM writes are a planned feature, not yet available.)
>
> **Your data:**
> - Corner only reads the CRM(s) you explicitly connect via OAuth — nothing is read without your permission.
> - Deal data is fetched live for each conversation; Corner does not maintain its own copy of your CRM database.
> - See our Privacy Policy for full details.
>
> Corner requires a HubSpot or Pipedrive account to connect, and a Corner account (sign in with your email) to use.

## Permission justifications

Chrome's review process requires a plain-language justification for each
requested permission. Exact text to paste into the dashboard's
"Permission justification" fields:

**`sidePanel`**
> Corner's entire interface lives in Chrome's side panel rather than a popup, so the rep can keep it open alongside the CRM page they're viewing.

**`identity`**
> Used exclusively for `chrome.identity.launchWebAuthFlow`, so a user can connect their HubSpot or Pipedrive account via that CRM's own OAuth consent screen. This does not use `chrome.identity.getAuthToken` and never accesses the user's Google account information.

**`scripting`**
> Used to inject Corner's deal-detection script into HubSpot/Pipedrive tabs that were already open before the extension was installed or updated. Without this, a rep who already had a deal page open would need to manually refresh that tab before Corner could detect it.

**Host permissions (`https://app.hubspot.com/*`, `https://*.pipedrive.com/*`)**
> Corner reads deal information directly from the HubSpot/Pipedrive page the user is currently viewing. These are the only two sites Corner runs on or reads from — no other website's content is accessed.

## Data usage disclosure (Privacy practices tab)

Chrome's dashboard requires declaring what user data the extension
collects/uses. Accurate answers for Corner:

| Category | Collected? | Notes |
| --- | --- | --- |
| Personally identifiable information | Yes | Email address, for Corner account sign-in (Supabase email-OTP). |
| Authentication information | Yes | OAuth tokens for the connected CRM(s), stored server-side (Supabase), never in the extension itself. |
| Website content | Yes | Deal data read from the HubSpot/Pipedrive page/API the user is viewing. |
| Location | No | |
| Health info | No | |
| Financial info | No | Stripe handles payment directly; Corner never sees card details. |
| Personal communications | Yes | Recent CRM activity the user asks about — calls, notes, emails logged in their own CRM (not the user's personal email/messages outside the CRM). |
| Web browsing history | No | Corner only reads the current HubSpot/Pipedrive tab's content, not browsing history. |

Also required: a checkbox confirming the extension does not sell user data
to third parties, and does not use data for purposes unrelated to the
extension's core function — both true for Corner.

**Remote code:** Corner ships no remote-code execution of any kind — the
entire extension (all JS) is bundled at build time and reviewed as part of
the submission, matching Chrome's Manifest V3 requirements. Confirm "No" on
the remote code declaration.

## Why this matters early, not right before "launch day"

Chrome's review process typically takes a few days but can run longer,
especially for a new developer account's first submission or if the
`identity`/`scripting`/host-permission combination draws extra scrutiny —
worth submitting as soon as the listing materials and a stable build are
ready, well before any planned public launch date.
