// Runs automatically before `npm run build` (see package.json's
// `prebuild` script — npm's own lifecycle convention, no extra tooling
// needed). Exists because a build produced without a valid .env.local
// doesn't fail loudly: Vite happily inlines `undefined` for every unset
// `VITE_*` value, and src/lib/supabase/client.ts's createClient() then
// throws at *module import time*, before React ever mounts — the packaged
// extension just opens to a completely blank side panel with nothing in
// the DOM, and no indication anywhere of why. This has already happened
// twice from a dev sandbox losing its gitignored .env.local between
// sessions; checking here catches it before a broken .zip ever gets
// built and handed to someone to test.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_ELEVENLABS_AGENT_ID",
  "VITE_PIPEDRIVE_CLIENT_ID",
  "VITE_MARKETING_SITE_URL",
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const cwd = process.cwd();
// Same precedence Vite itself uses: .env, then .env.local, then real
// process.env (e.g. CI secrets injected as actual environment variables
// rather than a checked-out file) wins last.
const vars = { ...loadEnvFile(resolve(cwd, ".env")), ...loadEnvFile(resolve(cwd, ".env.local")), ...process.env };

const missing = REQUIRED_KEYS.filter((key) => !vars[key] || vars[key].trim() === "");

if (missing.length > 0) {
  console.error(`\n✖ Cannot build: missing required client env var(s): ${missing.join(", ")}`);
  console.error("  Checked .env, .env.local, and process.env — see .env.local.example for what's required.");
  console.error(
    "  Building without these produces a side panel that fails to load at all (blank on open, no visible\n" +
      "  error) — see src/lib/supabase/client.ts for why. Fix .env.local, then run the build again.\n",
  );
  process.exit(1);
}
