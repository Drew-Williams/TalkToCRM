import { supabase } from "@/lib/supabase/client";
import type { InferredCompanyProfile, RepRole, UserProfile } from "./types";

async function getAccessTokenOrThrow(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("You're signed out of Corner — reopen the side panel and try again.");
  return accessToken;
}

async function callCompanyProfile(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const accessToken = await getAccessTokenOrThrow();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof responseBody?.error === "string" ? responseBody.error : `Request failed (status ${res.status}).`);
  }
  return responseBody;
}

/** Fetches the URL and asks an LLM to infer the profile fields — does not persist anything, so the rep can review/edit before committing (see mem/design). */
export async function analyzeCompanyUrl(url: string): Promise<InferredCompanyProfile> {
  const { profile } = await callCompanyProfile({ action: "analyze", url });
  return profile as InferredCompanyProfile;
}

/** Persists the (possibly rep-edited) final profile fields. */
export async function saveUserProfile(profile: UserProfile & { role: RepRole | null }): Promise<void> {
  await callCompanyProfile({
    action: "save",
    displayName: profile.displayName,
    role: profile.role,
    companyUrl: profile.companyUrl,
    companyName: profile.companyName,
    valueProp: profile.valueProp,
    icp: profile.icp,
    industry: profile.industry,
    competitors: profile.competitors,
  });
}
