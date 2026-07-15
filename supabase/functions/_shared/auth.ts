// Shared auth helper for edge functions. Mirrors the pattern in
// salesplaybookbuilder-ai's supabase/functions/_shared/auth.ts, trimmed down
// since this product has no company/team hierarchy — every row is scoped to
// a single rep's user_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface CallerUser {
  id: string;
  email?: string;
}

/** Resolve the calling user from the Authorization header. Returns null when missing/invalid. */
export async function getCallerUser(req: Request): Promise<CallerUser | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch {
    return null;
  }
}

export function serviceRoleClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}
