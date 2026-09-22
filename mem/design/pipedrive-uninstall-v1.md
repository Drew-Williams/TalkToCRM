---
name: Pipedrive uninstall handling v1
description: Why Corner couldn't receive Pipedrive's server-to-server uninstall webhook given chrome.identity.launchWebAuthFlow's single-callback-URL constraint, the reactive fallback shipped as a stopgap, and the eventual real fix (a redirect-proxy edge function) — see the third addendum for current status, this is now resolved
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
connection is still fine. (Superseded by the third addendum below — once
v0.1.3 is live and the Callback URL is switched over, this segment could
be re-recorded to show the real thing, though the existing recording
showing the user-visible behavior is still accurate and not wrong, just
no longer the only option.)

**Third addendum, and the actual root cause: this was never a form-
validation quirk, and the "deferred" fix above is what shipped.**
Attempting the real "Send to review" submission (not just editing the
field) kept failing with "Enter a valid URL" even after the v0.1.1 path
fix — retyping, re-saving, adding a longer path, nothing satisfied it
consistently. The actual explanation came from a Pipedrive team member's
own answer on their developer forum: "the callback url should be
publicly accessible... so Pipedrive Marketplace team will be able to
install and test the app during the review process." Checked directly:
`dpadpffnlgkbpakbfnnjnegdolfgfeio.chromiumapp.org` returns **NXDOMAIN** —
it does not resolve on the public internet at all, full stop, path or no
path. Every earlier theory (bare root vs. a path segment) was chasing a
symptom of the same underlying, un-fixable-by-URL-format problem: this
was never going to be accepted as a real Callback URL by anything that
actually checks reachability, because it fundamentally isn't reachable
by anyone outside Chrome's own `launchWebAuthFlow` implementation.

**The fix from "architecturally-correct, deferred" above, now shipped in
v0.1.3.** `pipedrive-oauth-redirect` (a real Supabase edge function) is
now the one registered Callback URL:
`https://ziccpxpvrgbsjybjhzhv.supabase.co/functions/v1/pipedrive-oauth-redirect`
— a genuinely reachable HTTPS address. Its `GET` handler 302-redirects
the `code`/`state`/`error` query params on to the extension's real
`chromiumapp.org` URL, which `chrome.identity.launchWebAuthFlow`
correctly intercepts as the final hop of that redirect chain (confirmed
directly against Chromium's own `WebAuthFlow::IsValidRedirectUrl`, a
plain URL-prefix check with no restriction on how many redirects
preceded it) — so `connectCrm()` in `connect.ts` is completely unchanged
downstream of this, it still just gets the same final URL back. Its
`DELETE` handler (HTTP Basic Auth via `PIPEDRIVE_CLIENT_ID`/`_SECRET`)
receives the actual uninstall webhook for the first time — matched back
to a `crm_connections` row via two new columns, `provider_company_id`/
`provider_user_id`, captured from Pipedrive's `/users/me` at connect
time (`20260922140000_pipedrive_provider_ids.sql`). It revokes the
refresh token and deletes the row — genuinely instant cleanup now,
not the "wait for the next 401" reactive fallback described above
(which stays in place as a second layer regardless, since it also
covers e.g. an individual access grant being revoked without a full
app uninstall).

Same rollout-sequencing caution as the v0.1.1 path change: real users
are connected via the old `chromiumapp.org` Callback URL on the
currently-published Chrome Web Store version, so the Developer Hub
setting must not be switched to this new proxy URL until v0.1.3 is
actually live and has had time to propagate. See README.md's "pinned
extension ID" section for current status.
