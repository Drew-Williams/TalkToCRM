import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Permissions stay as minimal as each step actually needs, not maximal for
// whatever might come later:
//
//   - "sidePanel"      → render our UI as a Chrome side panel instead of a popup
//   - host_permissions → ONLY the two CRM origins we read deal pages from.
//     Deliberately no "tabs" permission: content scripts already know their
//     own tab via chrome.runtime.MessageSender, and that sender info is
//     populated for any page matched by host_permissions, so the background
//     worker never needs broader tab visibility.
//   - "identity" and "scripting" were added in later steps — see their own
//     comments below for why each is needed.
//
// Still no CRM-write permissions of any kind — push_to_crm isn't built yet.
export default defineManifest({
  manifest_version: 3,
  // Pins the extension's ID to a fixed value (noljedpanlelibpakngfgmiopmcdhgdo)
  // regardless of which machine/folder it's unpacked from or how many times
  // it gets removed and reinstalled. Without this, Chrome derives a random
  // ID from the install path, which breaks every OAuth redirect URL
  // registered with Pipedrive/HubSpot each time the extension is reloaded
  // from a fresh unzip. This is the PUBLIC half of a keypair generated
  // solely to compute that ID — it grants no other capability and is safe
  // to commit (Chrome Web Store re-signs with its own key on publish; this
  // "key" field only matters for local/unpacked installs).
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsoj7bR3NJtsnUOHP4wiAkjgNocxNxNChowoXnR0QorKyAF9skjkC7eLglzYyy4OgcEk1Rxb0Jq/6v6kW5tUvfEB+7obqh+lXkxlCWrCzFtfafg2EiVHZ8OlJmYeff6EsrIY3G5m6frg4k7XuAuyrHAS/YHAbuV0fopyK6dlRIWxwntYQbeWnJxD7Lc1T53GA9ImGN+YWT7djR/x33eWHTLfQ+AcSpzq/7ELKSbyEQUeZ6ckCX79zKvShZRL1VLK7OHvpkSajJYeSlBAGzCNbdjlDEBnAC1acTEhzCXPZMN+i/5xvXy1OaRBz33fxI3eLxAR1vdnG4YTS0mvldcZ1OQIDAQAB",
  name: "Corner",
  // Chrome Web Store hard-caps manifest "description" at 132 characters —
  // separate from (and much shorter than) the store listing's own
  // "detailed description" field, which has no such limit. Keep this one
  // terse; the fuller pitch lives in docs/chrome-web-store-listing.md for
  // the listing itself.
  // Pipedrive-only for the MVP launch (HubSpot support still fully exists
  // in code — adapter, OAuth, deal detection — just not advertised or
  // offered as a connect option right now; see ConnectCrmCard.tsx).
  description:
    "The private deal coach you talk to — reads live Pipedrive deal data and coaches you out loud, no chat UI, no CRM writes.",
  version: pkg.version,

  // Deliberately NOT under public/ — Vite auto-copies that dir's contents to
  // dist root (stripping the "public/" prefix), while CRXJS separately
  // copies manifest-referenced asset paths preserving the given path. Using
  // a plain top-level icons/ dir avoids the two mechanisms producing
  // duplicate copies in dist/.
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },

  action: {
    default_title: "Corner",
  },

  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },

  side_panel: {
    default_path: "src/sidepanel/index.html",
  },

  // A real full-tab options page — not "an options page" in the ordinary
  // settings-tweaking sense, but a full-tab surface to request microphone
  // access from. Chrome's getUserMedia permission prompt has a documented
  // reliability issue specifically inside side panels (it can silently
  // auto-deny without ever showing a dialog); requesting the same
  // permission from a normal tab is more reliable, and since Chrome scopes
  // media permissions per *origin*, not per-page, granting it here covers
  // the side panel too. open_in_tab: true is required — the default
  // (embedded inside chrome://extensions) can't call getUserMedia at all.
  // Opened automatically right after install (see src/background/index.ts)
  // and on demand from the side panel's mic-blocked alert.
  options_ui: {
    page: "src/onboarding/index.html",
    open_in_tab: true,
  },

  // "identity" is for chrome.identity.launchWebAuthFlow (HubSpot/Pipedrive
  // OAuth connect) — it does NOT grant access to Google account info the
  // way chrome.identity.getAuthToken would; we never call that API.
  //
  // "scripting" is so background/index.ts can proactively inject the
  // content scripts below into HubSpot/Pipedrive tabs that were already
  // open *before* the extension was installed/reloaded — Chrome only auto-
  // injects content_scripts into tabs navigated to afterwards, so without
  // this, every reload during development leaves already-open deal tabs
  // stuck on "No deal detected" until manually refreshed.
  permissions: ["sidePanel", "identity", "scripting"],

  host_permissions: ["https://app.hubspot.com/*", "https://*.pipedrive.com/*"],

  // Hands-free start/stop for the voice coach — chrome.commands.onCommand
  // in src/background/index.ts opens the side panel (if needed) and
  // broadcasts TOGGLE_TALK, which useTalkSession picks up to start or end
  // the call depending on its current status. The rep can remap this
  // anytime from chrome://extensions/shortcuts; the side panel's own
  // shortcut badge (useKeyboardShortcutLabel) always reflects whatever key
  // is actually assigned, not just this suggestion.
  commands: {
    "toggle-talk": {
      suggested_key: { default: "Ctrl+Shift+K", mac: "Command+Shift+K" },
      description: "Start or stop talking to Corner about the open deal",
    },
  },

  // document_start (not document_idle): both CRMs are SPAs and we patch
  // history.pushState/replaceState to detect in-app deal navigation (see
  // src/lib/spa-url-watcher.ts). Patching before the host page's own bundle
  // loads means it can't cache a reference to the un-patched original.
  content_scripts: [
    {
      matches: ["https://app.hubspot.com/*"],
      js: ["src/content/hubspot.content.ts"],
      run_at: "document_start",
    },
    {
      matches: ["https://*.pipedrive.com/*"],
      js: ["src/content/pipedrive.content.ts"],
      run_at: "document_start",
    },
  ],
});
