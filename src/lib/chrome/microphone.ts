/**
 * Checks the current microphone permission state without triggering a
 * prompt — lets callers skip straight to a known-good/known-bad path
 * (e.g. useTalkSession can skip the warmup entirely once this reports
 * "granted", rather than re-running getUserMedia on every single call).
 * Returns null if the Permissions API can't answer this (older browsers,
 * or a permission name Chrome doesn't recognize) — treat that the same as
 * "prompt": unknown, worth trying.
 */
export async function queryMicrophonePermission(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

/**
 * Takes the rep straight to Chrome's permission toggle for this exact
 * extension, rather than a generic "check your settings" instruction —
 * chrome://settings/content/siteDetails?site=<origin> opens Chrome's
 * per-origin permission page pre-scoped to this extension's own
 * chrome-extension:// origin, where microphone access shows up as
 * "Blocked" with a one-click dropdown to change it to "Allow." Documented
 * fix for this exact "permission silently denied, never visibly prompted"
 * failure mode in Chrome's own extension-samples issue tracker.
 */
export function openMicrophoneSettings() {
  const origin = `chrome-extension://${chrome.runtime.id}/`;
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}` }).catch(() => {
    // Opening chrome://settings can fail if disallowed by an enterprise
    // policy — the caller's own UI already explains the general fix.
  });
}

/**
 * Opens src/onboarding (registered as this extension's options page) in a
 * real browser tab, where it immediately asks for microphone access.
 * Chrome's getUserMedia permission prompt has documented reliability
 * issues specifically inside side panels (it can silently auto-deny
 * without ever showing a dialog — the exact failure this whole module
 * exists to work around); requesting it from a normal full-tab extension
 * page is more reliable, and since Chrome scopes media permissions per
 * *origin* (chrome-extension://<id>) rather than per-page, a grant there
 * applies to the side panel too without asking again.
 */
export function openMicrophoneOnboarding() {
  chrome.runtime.openOptionsPage();
}
