import { useEffect, useRef, useState } from "react";
import { fetchMemoryByConversationId } from "@/lib/coaching-memory/get-memory";
import type { CoachingMemory } from "@/lib/coaching-memory/types";

const POLL_INTERVAL_MS = 2000;
// ElevenLabs' post-call analysis (and the webhook that follows it) is
// asynchronous and usually lands within a few seconds, but isn't
// guaranteed to — 25s of polling comfortably covers the normal case
// without polling indefinitely for a call that, for whatever reason, never
// gets analyzed (e.g. it was too short to produce anything meaningful).
const TIMEOUT_MS = 25000;

/**
 * Polls for the coaching_memory row a just-ended call produced, so the side
 * panel can offer a one-time "copy call summary" action once it's ready —
 * this is the closest we get to a "the call just ended" push notification,
 * since the actual write happens server-side via a webhook this extension
 * has no direct visibility into. Resets whenever `active` goes false (a new
 * call starting, or the deal changing), so a stale summary from a previous
 * call never lingers into the next one.
 */
export function usePostCallSummary(conversationId: string | null, active: boolean): { memory: CoachingMemory | null; pending: boolean } {
  const [memory, setMemory] = useState<CoachingMemory | null>(null);
  const [pending, setPending] = useState(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (!active || !conversationId) {
      setMemory(null);
      setPending(false);
      return;
    }

    let cancelled = false;
    setMemory(null);
    setPending(true);

    const startedAt = Date.now();
    async function poll() {
      const result = await fetchMemoryByConversationId(conversationIdRef.current!);
      if (cancelled) return;
      if (result) {
        setMemory(result);
        setPending(false);
        return;
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setPending(false);
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    let timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [conversationId, active]);

  return { memory, pending };
}
