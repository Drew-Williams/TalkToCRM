import { supabase } from "@/lib/supabase/client";
import type { DetectedDeal } from "@/lib/deal-detection/types";
import type { CoachingMemory } from "./types";

interface CoachingMemoryRow {
  conversation_id: string;
  summary: string | null;
  risk: string | null;
  next_action: string | null;
  created_at: string;
}

function toCoachingMemory(row: CoachingMemoryRow): CoachingMemory {
  return {
    conversationId: row.conversation_id,
    summary: row.summary,
    risk: row.risk,
    nextAction: row.next_action,
    createdAt: row.created_at,
  };
}

/**
 * Most recent coaching memory for a deal — used to fold "last time we
 * talked about X" into the next conversation's opening line (see
 * session-start-prompt.ts). RLS on coaching_memory already scopes every
 * query to the signed-in rep's own rows, same as useCrmConnections.
 */
export async function fetchLatestMemory(deal: DetectedDeal): Promise<CoachingMemory | null> {
  const { data, error } = await supabase
    .from("coaching_memory")
    .select("conversation_id, summary, risk, next_action, created_at")
    .eq("provider", deal.provider)
    .eq("deal_id", deal.dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return toCoachingMemory(data as CoachingMemoryRow);
}

/**
 * Recent coaching memory (a short history, not just the latest) — backs the
 * recall_notebook client tool for when the rep explicitly asks what was
 * covered previously, beyond what's already folded into the greeting.
 */
export async function fetchRecentMemories(deal: DetectedDeal, limit = 5): Promise<CoachingMemory[]> {
  const { data, error } = await supabase
    .from("coaching_memory")
    .select("conversation_id, summary, risk, next_action, created_at")
    .eq("provider", deal.provider)
    .eq("deal_id", deal.dealId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as CoachingMemoryRow[]).map(toCoachingMemory);
}

/**
 * Looks up the memory row for one specific conversation by ElevenLabs'
 * own conversation id — used to poll for "has the post-call analysis for
 * *this* call landed yet" right after a call ends (see
 * usePostCallSummary.ts). Analysis is asynchronous on ElevenLabs' side, so
 * this can (and usually will) return null for the first several seconds.
 */
export async function fetchMemoryByConversationId(conversationId: string): Promise<CoachingMemory | null> {
  const { data, error } = await supabase
    .from("coaching_memory")
    .select("conversation_id, summary, risk, next_action, created_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error || !data) return null;
  return toCoachingMemory(data as CoachingMemoryRow);
}
