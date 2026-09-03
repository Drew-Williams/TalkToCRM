import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A build produced without a valid .env.local (missing/undefined VITE_*
// values — has happened more than once from a dev sandbox losing that
// gitignored file between sessions, and could equally happen from a bad
// release build) makes createClient() below throw synchronously. Because
// this module is imported at the very top of the import graph (App.tsx and
// nearly every hook import `supabase` directly), that throw happens before
// React ever calls createRoot().render() — main.tsx's own code, and any
// error boundary wrapping <App />, never get a chance to run. The result
// was a completely blank side panel with no visible explanation at all,
// only a console error nobody testing the packaged .zip would ever see.
// Writing a plain, visible message into the page *before* re-throwing
// turns that silent failure into something a rep (or anyone testing a
// build) can actually read and report.
if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML =
    '<div style="font-family: system-ui, sans-serif; padding: 16px; color: #f8fafc; background: #0b1220; height: 100vh; box-sizing: border-box;">' +
    "<strong>Corner failed to load: missing configuration.</strong>" +
    '<p style="color: #94a3b8; font-size: 13px;">This build is missing required Supabase environment variables. ' +
    "It was likely packaged without a valid .env.local file — rebuild with the correct VITE_SUPABASE_URL and " +
    "VITE_SUPABASE_ANON_KEY set, then reload the extension.</p>" +
    "</div>";
  throw new Error("Missing required env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

// Default localStorage-backed session persistence is fine here: this client
// only runs inside the side panel document (a real extension page with its
// own chrome-extension://<id> origin), which is the only context that
// currently needs a signed-in Supabase session. Revisit with a
// chrome.storage.local-backed storage adapter if the background worker or
// content scripts ever need to read the session directly.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
