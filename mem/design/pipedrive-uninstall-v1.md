---
name: Pipedrive uninstall handling v1
description: Why Corner can't receive Pipedrive's server-to-server uninstall webhook given chrome.identity.launchWebAuthFlow's single-callback-URL constraint, and the reactive fallback (detect a 401, clear the stored connection) shipped instead
type: design
---

**The trigger.** Mapping out the Pipedrive Marketplace submission's required
demo video (which has to show the app-uninstallation flow per
[Pipedrive's docs](https://pipedrive.readme.io/docs/app-uninstallation))
surfaced that Corner had no uninstall handling at all — `crm_connections`
had no way to identify which row a given uninstall notification would even
belong to, and there was no endpoint to receive one.

**Why a real webhook isn't reachable here, specifically.** Pipedrive's
uninstall flow sends a `DELETE` request, authenticated with the app's
`client_id`/`client_secret` via HTTP Basic Auth, to "the Callback URL — a
value you specified in Developer Hub > Basic info." Per
[the registration docs](https://pipedrive.readme.io/docs/marketplace-registering-the-app),
that Callback URL is *the same field* as the OAuth `redirect_uri`, and
Pipedrive allows exactly one per app ("Technically, a callback URL is the
same thing as an OAuth `redirect_uri` ... we allow only one callback URL
per app"). Corner's OAuth connect flow uses
`chrome.identity.launchWebAuthFlow`, which requires `redirect_uri` to be
`chrome.identity.getRedirectURL()` — a `https://<extension-id>.chromiumapp.org/`
URL that Chrome intercepts internally before it's ever actually requested
over the network. That's the one and only Callback URL registered for
this app, and it has to stay that way for OAuth connect to keep working
at all. There is currently no server Corner controls sitting behind it,
so a DELETE sent there goes nowhere Corner could ever receive it.

**The architecturally-correct fix, deferred.** The standard workaround
other browser-extension OAuth integrations use for exactly this
constraint: register a real, Corner-controlled server URL as the single
Callback URL instead, and have that endpoint immediately 302-redirect
`GET` requests (the OAuth code delivery) on to the actual
`chromiumapp.org` URL with the same query string — `chrome.identity`
still intercepts that redirect chain's *final* hop, so the live OAuth
flow keeps working unchanged, while the same URL can now also accept the
uninstall `DELETE`. Not done here: it means re-registering the Callback
URL on an app that's mid-submission and already has a working, tested
OAuth flow, which isn't a change worth making under this kind of time
pressure without dedicated testing. Worth doing before or shortly after
launch, not bundled into this pass.

**What shipped instead: reactive detection.** A dead/revoked Pipedrive
connection always eventually surfaces as a `401` the next time Corner
actually calls the Pipedrive API with it — that's true regardless of
*why* it died (uninstalled, access individually revoked, whatever).
`crm-pipedrive.ts`/`crm-hubspot.ts`'s `getDeal`/`getRecentActivities` now
throw a shared `CrmAuthRevokedError` (`_shared/crm-errors.ts`) on a 401
specifically, and `crm-proxy/index.ts` catches that one error type to
delete the stale `crm_connections` row and return a clear 409 rather than
a generic 500. The side panel already knows how to render "not
connected" once there's no connection row — this just makes sure a dead
one doesn't sit there forever pretending to still work. The gap: this
only fires the next time the connection is actually *used* (opening a
deal, asking the coach about one), not the instant the uninstall happens
— acceptable for now, not acceptable forever.

**Addendum: this predicted conflict actually happened.** After the Chrome
Web Store listing went live, testing the *published* copy (a different,
Chrome-assigned ID — `dpadpffnlgkbpakbfnnjnegdolfgfeio`, since the store
dashboard rejects the pinned manifest `key` on new items; see
`npm run build:store`) hit exactly this: "Redirect URI match failed,"
because Pipedrive's one Callback URL was still registered to the local
pinned dev ID (`noljedpanlelibpakngfgmiopmcdhgdo`). Resolved by switching
the registered Callback URL to the published ID, since that's what real
users and Marketplace reviewers actually install — which means local
unpacked testing against Pipedrive is broken until either the Callback
URL is switched back temporarily or a second, dev-only Pipedrive app is
registered. See README.md's "pinned extension ID" section for current
status of which ID is registered.

**Second addendum: the Callback URL itself turned out to be invalid, for
a different reason.** Attempting to actually submit the Marketplace app
for review surfaced a second, unrelated problem with the same field:
Pipedrive's Developer Hub rejects a bare-root
`https://<id>.chromiumapp.org/` Callback URL with "Enter a valid URL" —
but only at "Send to review" submission time, not during normal field
editing, which made this genuinely confusing to pin down (retyping the
exact same value during editing showed no error at all). Fixed in
v0.1.1 by giving `chrome.identity.getRedirectURL()` a path segment
(`<provider>-oauth-callback` — see `connect.ts`); Chrome's
`launchWebAuthFlow` interception works on the whole
`chromiumapp.org/<id>` origin regardless of path, so this has no effect
on the client-side flow itself, only on satisfying Pipedrive's stricter
form validation. Since real users were already connected via the old
bare-root URL on the live published version, the registered Callback
URL must not be switched to the new path until v0.1.1 is actually live
and has had time to propagate — see README.md's "pinned extension ID"
section for current status.

**What this means for the submission video.** The uninstallation segment
can't show a server genuinely receiving Pipedrive's webhook (there isn't
one reachable yet) — it should instead show the *user-visible* behavior:
uninstall from Pipedrive, then show Corner's side panel correctly
reflecting "not connected" rather than silently pretending a dead
connection is still fine.
