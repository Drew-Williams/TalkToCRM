import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchUserProfile } from "@/lib/user-profile/get-profile";
import { analyzeCompanyUrl, saveUserProfile } from "@/lib/user-profile/save-profile";
import { ROLE_LABELS, type RepRole, type UserProfile } from "@/lib/user-profile/types";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as Array<[RepRole, string]>;

const EMPTY_PROFILE: UserProfile = {
  displayName: null,
  role: null,
  companyUrl: null,
  companyName: null,
  valueProp: null,
  icp: null,
  industry: null,
  competitors: null,
};

/**
 * Personalization (name/role) + "playbook light" (an AI-inferred company
 * profile from a URL, reviewed/edited before saving) — see
 * mem/design/company-profile-v1.md. Lives in the same progressive-
 * disclosure settings area as ConnectCrmCard, behind the header's cog.
 */
export function ProfileCard() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchUserProfile().then((result) => {
      if (result) setProfile(result);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setSaved(false);
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAnalyze() {
    if (!profile.companyUrl) return;
    setAnalyzing(true);
    setError(null);
    try {
      const inferred = await analyzeCompanyUrl(profile.companyUrl);
      setProfile((prev) => ({
        ...prev,
        companyName: inferred.companyName ?? prev.companyName,
        valueProp: inferred.valueProp ?? prev.valueProp,
        icp: inferred.icp ?? prev.icp,
        industry: inferred.industry ?? prev.industry,
        competitors: inferred.competitors ?? prev.competitors,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze that website.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveUserProfile(profile);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="mb-3">
        <CardContent className="p-3 text-sm text-muted-foreground">Loading your profile…</CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-3">
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="text-sm">Your profile</CardTitle>
        <CardDescription className="text-xs">
          Corner uses this to sound like it knows you — your name, and a quick read on your company.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-1.5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-name">
            Your name
          </label>
          <Input
            id="profile-name"
            placeholder="What should Corner call you?"
            value={profile.displayName ?? ""}
            onChange={(e) => update("displayName", e.target.value || null)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-role">
            Your role
          </label>
          <select
            id="profile-role"
            value={profile.role ?? ""}
            onChange={(e) => update("role", (e.target.value || null) as RepRole | null)}
            className="flex h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="" className="bg-slate-900">
              Select a role…
            </option>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value} className="bg-slate-900">
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 border-t border-white/10 pt-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-company-url">
            Company website
          </label>
          <div className="flex gap-2">
            <Input
              id="profile-company-url"
              placeholder="yourcompany.com"
              value={profile.companyUrl ?? ""}
              onChange={(e) => update("companyUrl", e.target.value || null)}
            />
            <Button size="sm" variant="outline" disabled={!profile.companyUrl || analyzing} onClick={handleAnalyze}>
              <Sparkles className="h-3.5 w-3.5" />
              {analyzing ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            We'll take a quick read of your homepage to guess the fields below — check them over and fix anything that's off.
          </p>
        </div>

        {(profile.companyName || profile.valueProp || profile.icp || profile.industry || profile.competitors) && (
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-company-name">
                Company name
              </label>
              <Input
                id="profile-company-name"
                placeholder="Company name"
                value={profile.companyName ?? ""}
                onChange={(e) => update("companyName", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-value-prop">
                Value prop
              </label>
              <Textarea
                id="profile-value-prop"
                placeholder="What you sell and the outcome it delivers"
                value={profile.valueProp ?? ""}
                onChange={(e) => update("valueProp", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-icp">
                Ideal customer
              </label>
              <Textarea
                id="profile-icp"
                placeholder="Your ideal customer (industry, size, role)"
                value={profile.icp ?? ""}
                onChange={(e) => update("icp", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-industry">
                Industry
              </label>
              <Input
                id="profile-industry"
                placeholder="Industry"
                value={profile.industry ?? ""}
                onChange={(e) => update("industry", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-competitors">
                Competitors
              </label>
              <Input
                id="profile-competitors"
                placeholder="Known competitors (comma-separated)"
                value={profile.competitors ?? ""}
                onChange={(e) => update("competitors", e.target.value || null)}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
