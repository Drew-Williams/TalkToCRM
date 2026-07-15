type UrlChangeListener = (url: string) => void;

const listeners = new Set<UrlChangeListener>();
let installed = false;
let lastKnownHref = "";

function notify() {
  const href = window.location.href;
  if (href === lastKnownHref) return;
  lastKnownHref = href;
  for (const listener of listeners) listener(href);
}

function installOnce() {
  if (installed) return;
  installed = true;
  lastKnownHref = window.location.href;

  // Patch history.pushState/replaceState so client-side route changes (both
  // HubSpot and Pipedrive are SPAs) notify us, not just hard navigations.
  // history is a shared BOM object — even though content scripts run in an
  // isolated JS world, patching a method on it also intercepts calls made by
  // the host page's own router, since both worlds call the same object.
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function patchedPushState(...args: Parameters<History["pushState"]>) {
    originalPushState(...args);
    notify();
  };
  history.replaceState = function patchedReplaceState(...args: Parameters<History["replaceState"]>) {
    originalReplaceState(...args);
    notify();
  };

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);

  // Safety net: some SPA routers navigate through paths our patch can't see
  // (e.g. a reference to the original pushState captured before this script
  // ran). A cheap poll catches those without needing a MutationObserver on
  // the whole DOM.
  window.setInterval(notify, 1500);
}

/**
 * Watches for hard navigations and in-app (SPA) URL changes on the current
 * tab. Registers exactly one set of underlying listeners no matter how many
 * times it's called. Returns an unsubscribe function.
 */
export function watchUrlChanges(onChange: UrlChangeListener): () => void {
  installOnce();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
