import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Subscribes to the system reduce-motion accessibility setting. Initial value
 * is resolved asynchronously, so first render returns `false` then updates
 * once the OS responds. Subsequent OS-level changes (e.g., user toggles the
 * setting in Settings while the app is foregrounded) propagate via the
 * `reduceMotionChanged` event.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
