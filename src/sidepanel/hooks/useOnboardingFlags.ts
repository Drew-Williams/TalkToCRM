import { useEffect, useState } from "react";
import { getOnboardingFlags, ONBOARDING_STORAGE_KEYS, type OnboardingFlags } from "@/lib/onboarding/state";

const INITIAL: OnboardingFlags = { hasCompletedFirstCall: false, profileNudgeDismissed: false };

/**
 * Reactive read of the two onboarding flags — TalkToCrmCard writes
 * `firstCallCompletedAt` the moment a call ends, and App.tsx (a sibling,
 * not a parent/child of TalkToCrmCard's session state) needs to notice
 * that immediately to render the profile nudge, without prop drilling a
 * callback through or standing up a context just for two booleans.
 * chrome.storage.onChanged already does exactly this job.
 */
export function useOnboardingFlags(): OnboardingFlags {
  const [flags, setFlags] = useState<OnboardingFlags>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    getOnboardingFlags().then((result) => {
      if (!cancelled) setFlags(result);
    });

    function handleChange(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
      if (areaName !== "local") return;
      if (!ONBOARDING_STORAGE_KEYS.some((key) => key in changes)) return;
      getOnboardingFlags().then((result) => {
        if (!cancelled) setFlags(result);
      });
    }

    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  return flags;
}
