import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/state/settingsStore';

export default function Index() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  return onboardingComplete ? (
    <Redirect href="/(main)/character" />
  ) : (
    <Redirect href="/onboarding" />
  );
}
