// Verifies an ElevenLabs post-call webhook signature by hand — same
// HMAC-SHA256 "t=<timestamp>,v0=<hex-digest>" scheme as
// stripe-webhook-verify.ts (Stripe uses "v1" instead of "v0" and that's
// the only difference), signing `${timestamp}.${rawBody}` with the
// workspace webhook's own secret. See
// https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks.
export async function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null, webhookSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v0;
  if (!timestamp || !signature) return false;

  // 30 minute tolerance, matching ElevenLabs' own documented replay-attack
  // window for this scheme.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 30 * 60) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
