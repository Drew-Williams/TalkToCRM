// A 401 from a connected CRM almost always means the stored token is dead,
// not a transient failure — most commonly because the rep (or an admin)
// uninstalled/disconnected the app on the CRM's side, which invalidates the
// access and refresh tokens there without Corner ever being told directly.
//
// Pipedrive *does* have a server-to-server uninstall webhook in principle
// (see mem/design/pipedrive-uninstall-v1.md), but this app's OAuth
// `redirect_uri` has to be the extension's own
// `https://<id>.chromiumapp.org/` URL for chrome.identity.launchWebAuthFlow
// to work at all — chrome.identity intercepts navigation to that exact
// origin, which Corner (or anyone) doesn't control a server behind. Pipedrive
// only allows *one* registered callback URL per app, and reuses that same
// URL for the uninstall DELETE webhook, so there is currently no real server
// endpoint of Corner's that Pipedrive could ever successfully deliver that
// webhook to. Detecting revocation reactively, the next time the dead
// connection is actually used, is the only reliable signal available given
// that constraint — see crm-proxy/index.ts's catch handling for this class.
export class CrmAuthRevokedError extends Error {
  constructor(provider: string) {
    super(`${provider} authorization was revoked or the connection was disconnected on the CRM's side.`);
    this.name = "CrmAuthRevokedError";
  }
}
