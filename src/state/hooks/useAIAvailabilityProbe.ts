import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Runs the AI-availability probe on mount and on every transition to
 * `'active'`. Mirrors `useAppForegroundDecay` so the two probes share the
 * same lifecycle pattern. The hook does not subscribe reactively to the
 * store — it only calls `runProbe()` via `getState()`, so re-rendering the
 * mounting component does not create extra subscriptions.
 */
export function useAIAvailabilityProbe(): void {
  useEffect(() => {
    void useAIAvailabilityStore.getState().runProbe();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void useAIAvailabilityStore.getState().runProbe();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
