export interface CoachingMemory {
  conversationId: string;
  summary: string | null;
  risk: string | null;
  nextAction: string | null;
  createdAt: string;
}
