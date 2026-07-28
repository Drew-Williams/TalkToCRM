# AGENTS.md

## Cursor Cloud specific instructions

Corner is a **Vite + React + TypeScript Chrome extension (Manifest V3)** — there is no
long-running app server; the "app" is the `dist/` bundle loaded into Chrome. The backend
is a **hosted** Supabase project (Postgres + Deno edge functions), not something spun up
locally. Standard commands live in `README.md` / `package.json`; notes below are the
non-obvious bits for working in the cloud VM.

### Env vars / secrets
- The `VITE_*` client values and the server-side Supabase/ElevenLabs/Pipedrive secrets are
  injected into the VM as environment variables (see the Secrets pane). `.env.local` is
  gitignored and is **not** present on a fresh VM — recreate it from the environment before
  building, since the extension reads config from `import.meta.env` at build time:
  ```bash
  cat > .env.local <<EOF
  VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
  VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
  VITE_ELEVENLABS_AGENT_ID=${VITE_ELEVENLABS_AGENT_ID}
  VITE_HUBSPOT_CLIENT_ID=${VITE_HUBSPOT_CLIENT_ID}
  VITE_PIPEDRIVE_CLIENT_ID=${VITE_PIPEDRIVE_CLIENT_ID}
  VITE_MARKETING_SITE_URL=${VITE_MARKETING_SITE_URL:-https://mycornercoach.com}
  EOF
  ```
  (Vite also picks up `VITE_`-prefixed values straight from `process.env`, but writing
  `.env.local` makes the build deterministic.) `VITE_HUBSPOT_CLIENT_ID` may be unset — only
  Pipedrive is currently configured, so demo/connect flows should use Pipedrive.

### Running / testing in the VM
- `npm run dev` starts Vite in watch mode on a **fixed port 5173** (`strictPort: true`) and
  writes a live `dist/`; it does not serve a page you visit — you load `dist/` into Chrome.
- To exercise the extension: `chrome://extensions` → Developer mode → **Load unpacked** →
  select `/workspace/dist`. Open the side panel by clicking the toolbar icon (do **not**
  navigate a tab directly to the `chrome-extension://.../src/sidepanel/index.html` URL — Chrome
  blocks that with `ERR_BLOCKED_BY_CLIENT`).
- `dist/` is intentionally git-tracked, so `git status` stays clean after a rebuild only if the
  output is byte-identical; a rebuild with different env/hashes will show `dist/` changes.

### Verifying backend integration without Chrome
The core reverse-trial flow can be verified headlessly against the live Supabase project — the
side panel calls `supabase.auth.signInAnonymously()` on load and a Postgres trigger
(`handle_new_user_trial`) creates a 7-day `trialing` row in `subscriptions`:
```bash
TOK=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/signup" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s "$VITE_SUPABASE_URL/rest/v1/subscriptions?select=*" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TOK"   # -> [{"status":"trialing","trial_end": <install+7d>, ...}]
```

### What can't be fully exercised in the VM
- **CRM connect (Pipedrive/HubSpot)**, **ElevenLabs voice**, and the **Stripe paywall** all
  require real third-party logins / an agent with the right client tools; they can be launched
  but not completed without those external accounts. Stripe secrets are not configured, so the
  day-7 paywall cannot actually charge.
