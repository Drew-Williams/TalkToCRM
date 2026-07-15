# Talk to CRM

A voice-first sales coaching Chrome extension. We're the selling layer above
the CRM, not another CRM: the extension reads live deal data from HubSpot or
Pipedrive, coaches the rep out loud via ElevenLabs (no chat UI), and only
writes back to the CRM after the rep explicitly confirms.

## Status: Step 1 — deal detection only

This is the first slice of the build: the extension detects when a rep is on
a HubSpot or Pipedrive deal page and shows the deal ID in the side panel.
**No AI, no CRM writes, no Supabase calls yet.** That comes in later steps.

## Prerequisites

- Node.js 22+
- npm (ships with Node)

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key + ElevenLabs agent ID once you have them
```

Step 1 doesn't actually call Supabase or ElevenLabs yet, so `.env.local` can
stay as placeholders for now — it only needs to exist so Vite doesn't warn on
missing env vars in later steps.

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
6. Pin the "Talk to CRM" icon to your toolbar (puzzle-piece icon → pin) for easy access.
7. Click the toolbar icon — it opens the side panel directly (no popup).

**After every `npm run build`** (or whenever `npm run dev`'s watcher rebuilds),
if the extension doesn't seem to have picked up the change, go back to
`chrome://extensions` and click the refresh icon on the "Talk to CRM" card. If
you're using `npm run dev`, CRXJS's HMR usually reloads the side panel and
content scripts automatically without needing this.

## Verifying step 1 works

1. Load the unpacked extension per above.
2. Open the side panel (toolbar icon) — with no CRM tab active it should show
   "No deal detected."
3. Navigate to a real deal in HubSpot (`https://app.hubspot.com/contacts/.../record/0-3/...`)
   or Pipedrive (`https://yourcompany.pipedrive.com/deal/...`).
4. The side panel should update to show "Deal detected," the provider badge,
   the deal ID, and an "Open in HubSpot/Pipedrive" link.
5. Click between two different deals in the same tab (SPA navigation, no page
   reload) and confirm the panel updates to the new deal ID.
6. Switch to a different browser tab and back — the panel should reflect
   whichever tab is active.

## Project layout

- `manifest.config.ts` — typed MV3 manifest (via `@crxjs/vite-plugin`)
- `src/content/` — content scripts that detect the deal on HubSpot/Pipedrive pages
- `src/background/` — MV3 service worker relaying deal state to the side panel
- `src/sidepanel/` — the React UI that renders in Chrome's side panel
- `src/lib/deal-detection/` — pure URL-matching logic (unit tested)
- `src/lib/chrome/messaging.ts` — the message contract between the three contexts above
- `mem/` — design notes, mirroring the convention from the main sales-playbook-builder repo

## What's NOT here yet

No chat UI, no CRM writes, no Supabase edge functions, no ElevenLabs wiring,
no persistent memory. See the build order in the project brief — this repo
only covers step 1.
