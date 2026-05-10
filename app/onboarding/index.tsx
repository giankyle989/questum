import { Redirect } from 'expo-router';

/**
 * Bare `/onboarding` redirects to the first step. Keeping `/onboarding` as a
 * stable entry point means the route group can be reorganized without
 * touching the root index redirect.
 */
export default function OnboardingIndex() {
  return <Redirect href="/onboarding/pitch" />;
}
