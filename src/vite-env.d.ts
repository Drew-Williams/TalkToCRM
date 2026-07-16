/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ELEVENLABS_AGENT_ID: string;
  readonly VITE_HUBSPOT_CLIENT_ID: string;
  readonly VITE_PIPEDRIVE_CLIENT_ID: string;
  /** Marketing site base URL — where the "Start free trial" / "Manage billing" links point. */
  readonly VITE_MARKETING_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
