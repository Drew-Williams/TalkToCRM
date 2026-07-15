---
name: Deal detection v1
description: How the content scripts identify a HubSpot/Pipedrive deal page and report it to the side panel, including the SPA-navigation problem and the messaging protocol
type: design
---

**URL patterns matched** (`src/lib/deal-detection/`):
- HubSpot: `https://app.hubspot.com/contacts/{portalId}/record/0-3/{dealId}` (current record UI; `0-3` is HubSpot's static object-type id for Deals) and the legacy `https://app.hubspot.com/contacts/{portalId}/deal/{dealId}` path. Both still resolve in the product today.
- Pipedrive: `https://{companyDomain}.pipedrive.com/deal/{dealId}`. `companyDomain` is the org's subdomain and can contain digits/hyphens.

**SPA navigation problem.** Both CRMs are client-side-routed SPAs — a `content_scripts` match only fires once, on hard load. Switching from deal to deal without a full page reload wouldn't otherwise be observed. `src/lib/spa-url-watcher.ts` patches `history.pushState`/`replaceState` (a shared BOM object between the content script's isolated world and the host page's main world, so patching it there also intercepts the host router's calls) plus listens for `popstate`/`hashchange`, with a 1.5s poll as a safety net for any navigation path our patch doesn't see. Content scripts are injected at `document_start` (not `document_idle`) specifically so the patch is in place before the host page's own bundle can grab a reference to the un-patched original.

**Messaging protocol** (`src/lib/chrome/messaging.ts`): content scripts push `DEAL_DETECTED`/`DEAL_CLEARED` to the background worker as they happen; the background worker caches the latest deal per tab and broadcasts `ACTIVE_DEAL_UPDATED` to any open side panel. Because MV3 service workers can be evicted at any time, that cache is treated as warm-only — `GET_ACTIVE_DEAL` (side panel → background) falls back to asking the content script directly via `GET_CURRENT_DEAL` whenever the cache misses, so a fresh side panel open never shows stale/empty state just because the worker had gone to sleep.

**Permissions.** No `"tabs"` permission. `host_permissions` is scoped to `app.hubspot.com` and `*.pipedrive.com` only, which is enough for `chrome.tabs.query()` to return `url` for tabs on those origins and for `chrome.runtime.MessageSender.tab` to be populated on incoming content-script messages — see the [Chrome tabs API permission notes](https://developer.chrome.com/docs/extensions/reference/api/tabs#perms).
