import { Stack } from 'expo-router';

/**
 * Onboarding stack. Each screen pushes onto the stack so the back gesture
 * returns to the previous step. Headers are hidden — every onboarding screen
 * provides its own chrome.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
