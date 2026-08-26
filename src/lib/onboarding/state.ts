// Local-only (chrome.storage.local, not the user_profile table) on
// purpose — these two flags gate a UI nudge, not anything that needs to
// sync across devices or survive a reinstall, and they need to work
// instantly on every side panel mount without a Supabase round trip. See
// mem/design/onboarding-v1.md.
const FIRST_CALL_COMPLETED_KEY = "corner:onboarding:firstCallCompletedAt";
const PROFILE_NUDGE_DISMISSED_KEY = "corner:onboarding:profileNudgeDismissed";

export interface OnboardingFlags {
  hasCompletedFirstCall: boolean;
  profileNudgeDismissed: boolean;
}

export async function getOnboardingFlags(): Promise<OnboardingFlags> {
  const result = await chrome.storage.local.get([FIRST_CALL_COMPLETED_KEY, PROFILE_NUDGE_DISMISSED_KEY]);
  return {
    hasCompletedFirstCall: !!result[FIRST_CALL_COMPLETED_KEY],
    profileNudgeDismissed: !!result[PROFILE_NUDGE_DISMISSED_KEY],
  };
}

// Idempotent by design — safe to call every time a call ends, not just
// the first, so callers never need to check the current flag value first.
export function markFirstCallCompleted(): Promise<void> {
  return chrome.storage.local.set({ [FIRST_CALL_COMPLETED_KEY]: Date.now() });
}

export function dismissProfileNudge(): Promise<void> {
  return chrome.storage.local.set({ [PROFILE_NUDGE_DISMISSED_KEY]: true });
}

export const ONBOARDING_STORAGE_KEYS = [FIRST_CALL_COMPLETED_KEY, PROFILE_NUDGE_DISMISSED_KEY];
