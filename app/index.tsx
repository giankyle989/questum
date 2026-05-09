import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/state/settingsStore';

export default function Index() {
  const loading = useSettingsStore((s) => s.loading);
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  // Defensive guard: _layout.tsx already gates rendering on settings hydration,
  // so `loading` should be false by the time we render here. Returning null on
  // a transient `loading` true prevents a flash-of-wrong-route in any race.
  if (loading) return null;
  return onboardingComplete ? (
    <Redirect href="/(main)/character" />
  ) : (
    <Redirect href="/onboarding" />
  );
}
