// ElevenLabs calls this after each voice conversation completes and its
// post-call analysis has finished — see
// supabase/migrations/20260728180000_coaching_memory.sql for the table this
// writes to, and mem/design/coaching-memory-v1.md for the overall design.
// No getCallerUser check, deliberately, same reasoning as stripe-webhook:
// ElevenLabs calls this directly with no Supabase session, and it
// authenticates itself via the webhook signature instead.
import { verifyElevenLabsSignature } from "../_shared/elevenlabs-webhook-verify.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { serviceRoleClient } from "../_shared/auth.ts";

const ELEVENLABS_WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") ?? "";
const VALID_PROVIDERS = new Set(["hubspot", "pipedrive"]);

interface DataCollectionResult {
  value?: unknown;
}

interface PostCallWebhookData {
  conversation_id?: string;
  user_id?: string;
  metadata?: { user_id?: string };
  analysis?: {
    data_collection_results?: Record<string, DataCollectionResult>;
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, unknown>;
  };
}

function stringValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("elevenlabs-signature");
  const isValid = await verifyElevenLabsSignature(rawBody, signatureHeader, ELEVENLABS_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("[elevenlabs-post-call-webhook] signature verification failed");
    return jsonResponse({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: PostCallWebhookData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only the transcription/analysis event carries what this needs — audio
  // and call_initiation_failure events are legitimate event types, this
  // endpoint just has nothing to do with them (200, not an error).
  if (event.type !== "post_call_transcription") {
    return jsonResponse({ received: true });
  }

  try {
    const data = event.data;
    const conversationId = data.conversation_id ?? null;
    // Set via Conversation.startSession({ userId }) client-side — ElevenLabs'
    // docs show this both as a top-level field and (in one example) nested
    // under metadata, so checking both is cheap insurance against which
    // shape actually ships.
    const userId = data.user_id ?? data.metadata?.user_id ?? null;
    const dynamicVars = data.conversation_initiation_client_data?.dynamic_variables ?? {};
    const provider = stringValue(dynamicVars.corner_provider);
    const dealId = stringValue(dynamicVars.corner_deal_id);

    if (!conversationId || !userId || !provider || !dealId || !VALID_PROVIDERS.has(provider)) {
      // A call with no deal open (or a test run from the ElevenLabs
      // dashboard) never gets these dynamic variables set — nothing to
      // attach a memory row to, and that's fine, not every conversation
      // needs one.
      console.warn("[elevenlabs-post-call-webhook] missing/invalid identifying fields, skipping", {
        hasConversationId: !!conversationId,
        hasUserId: !!userId,
        provider,
        hasDealId: !!dealId,
      });
      return jsonResponse({ received: true });
    }

    const results = data.analysis?.data_collection_results ?? {};
    const summary = stringValue(results.deal_summary?.value);
    const risk = stringValue(results.deal_risk?.value);
    const nextAction = stringValue(results.next_recommended_action?.value);

    const admin = serviceRoleClient();
    const { error } = await admin.from("coaching_memory").upsert(
      {
        user_id: userId,
        provider,
        deal_id: dealId,
        conversation_id: conversationId,
        summary,
        risk,
        next_action: nextAction,
      },
      { onConflict: "conversation_id" },
    );
    if (error) throw new Error(`Failed to upsert coaching memory: ${error.message}`);

    return jsonResponse({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[elevenlabs-post-call-webhook]", message);
    // Non-2xx tells ElevenLabs to retry — appropriate here, since this is
    // our own transient failure (a DB write failing), not "this event will
    // never be processable."
    return jsonResponse({ error: message }, { status: 500 });
  }
});
