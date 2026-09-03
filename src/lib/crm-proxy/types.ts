// Mirrors supabase/functions/_shared/deal-snapshot.ts — kept as a separate,
// duplicated type here rather than shared/imported, since the extension
// bundle (Vite/browser) and the edge functions (Deno) are two different
// runtimes with no shared build step between them. Keep these two in sync
// by hand if the shape changes.
export interface DealContact {
  name: string | null;
  title: string | null;
  email: string | null;
}

export interface DealActivity {
  type: string | null;
  subject: string | null;
  note: string | null;
  occurredAt: string | null;
  done: boolean | null;
}

export interface DealSnapshot {
  provider: "hubspot" | "pipedrive";
  dealId: string;
  name: string | null;
  stage: string | null;
  pipeline: string | null;
  amountCents: number | null;
  currency: string | null;
  closeDate: string | null;
  ownerName: string | null;
  lastActivityAt: string | null;
  contacts: DealContact[];
  description: string | null;
  fetchedAt: string;
}
