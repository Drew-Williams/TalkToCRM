// Verifies a Stripe webhook signature by hand (the documented algorithm —
// https://docs.stripe.com/webhooks#verify-manually) rather than pulling in
// Stripe's Node SDK, which has enough Node-specific plumbing that running it
// under Deno's npm compat is more risk than a ~20-line HMAC check using Web
// Crypto (already used nowhere else in this project only because nothing
// else needed it — every other third-party API here is called with plain
// fetch()).
export async function verifyStripeSignature(rawBody: string, signatureHeader: string | null, webhookSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish comparison — lengths are always equal (both fixed-
  // length hex digests of a fixed-size HMAC), so this doesn't leak length
  // information the way a naive === on attacker-controlled-length strings
  // could; it still walks the whole string rather than short-circuiting.
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
