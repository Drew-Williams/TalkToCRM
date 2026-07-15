// Mints a short-lived WebRTC conversation token for the ElevenLabs agent.
// The extension never sees ELEVENLABS_API_KEY directly — it calls this
// authenticated endpoint, which calls ElevenLabs on the extension's behalf
// and hands back only the token. WebRTC (not WebSocket) is used deliberately:
// the WebSocket path in @elevenlabs/client loads AudioWorklets via blob: URLs
// (and, for sample-rate mismatches, a remote CDN script), both of which MV3's
// non-negotiable extension_pages CSP (script-src/worker-src limited to 'self'
// and 'wasm-unsafe-eval') refuses to load. WebRTC uses the browser's native
// media pipeline instead, so it has no such conflict.
import { getCallerUser } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getCallerUser(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId || typeof agentId !== "string") {
      // agentId isn't a secret (it's the same value the client bundles as
      // VITE_ELEVENLABS_AGENT_ID), so accepting it from the request body
      // rather than duplicating it as its own server-side secret is fine.
      return jsonResponse({ error: "agentId is required" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error("[elevenlabs-conversation-token] ElevenLabs API error:", res.status, detail);
      return jsonResponse({ error: "Failed to mint a conversation token" }, { status: 502 });
    }
    const data = await res.json();
    return jsonResponse({ token: data.token });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[elevenlabs-conversation-token]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
