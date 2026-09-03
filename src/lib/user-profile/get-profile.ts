import { supabase } from "@/lib/supabase/client";
import type { RepRole, UserProfile } from "./types";

interface UserProfileRow {
  display_name: string | null;
  role: RepRole | null;
  company_url: string | null;
  company_name: string | null;
  value_prop: string | null;
  icp: string | null;
  industry: string | null;
  competitors: string | null;
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    displayName: row.display_name,
    role: row.role,
    companyUrl: row.company_url,
    companyName: row.company_name,
    valueProp: row.value_prop,
    icp: row.icp,
    industry: row.industry,
    competitors: row.competitors,
  };
}

/** RLS already scopes this to the signed-in rep's own row — same pattern as useCrmConnections/coaching-memory. Returns null for a rep who's never set anything up (not an error case, just an empty profile). */
export async function fetchUserProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("display_name, role, company_url, company_name, value_prop, icp, industry, competitors")
    .maybeSingle();
  if (error || !data) return null;
  return toUserProfile(data as UserProfileRow);
}
