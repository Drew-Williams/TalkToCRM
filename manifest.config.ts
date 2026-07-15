import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Step 1 scope: detect the deal a rep is looking at and show it in the side
// panel. No AI, no CRM writes yet — so permissions stay minimal on purpose.
//
//   - "sidePanel"      → render our UI as a Chrome side panel instead of a popup
//   - host_permissions → ONLY the two CRM origins we read deal pages from.
//     Deliberately no "tabs" permission: content scripts already know their
//     own tab via chrome.runtime.MessageSender, and that sender info is
//     populated for any page matched by host_permissions, so the background
//     worker never needs broader tab visibility.
export default defineManifest({
  manifest_version: 3,
  name: "Talk to CRM",
  description:
    "Voice-first sales coaching that reads live HubSpot/Pipedrive deal data and coaches the rep out loud — no chat UI, no silent CRM writes.",
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
    default_title: "Talk to CRM",
  },

  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },

  side_panel: {
    default_path: "src/sidepanel/index.html",
  },

  // "identity" is for chrome.identity.launchWebAuthFlow (HubSpot/Pipedrive
  // OAuth connect) — it does NOT grant access to Google account info the
  // way chrome.identity.getAuthToken would; we never call that API.
  permissions: ["sidePanel", "identity"],

  host_permissions: ["https://app.hubspot.com/*", "https://*.pipedrive.com/*"],

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
