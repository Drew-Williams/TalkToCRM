import { createClient } from "@supabase/supabase-js";

// Default localStorage-backed session persistence is fine here: this client
// only runs inside the side panel document (a real extension page with its
// own chrome-extension://<id> origin), which is the only context that
// currently needs a signed-in Supabase session. Revisit with a
// chrome.storage.local-backed storage adapter if the background worker or
// content scripts ever need to read the session directly.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
