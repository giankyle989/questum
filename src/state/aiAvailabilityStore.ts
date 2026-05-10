import { create } from 'zustand';

import { probeAIAvailability } from '@/ai/aiServiceFactory';

export interface AIAvailabilityState {
  /**
   * Whether the on-device AI is currently usable. Initialized to `true`
   * (optimistic) so the banner doesn't flash on cold start before the first
   * probe completes; flipped to false within a few hundred ms if the probe
   * fails.
   */
  available: boolean;
  /** AI service human-readable name. Overwritten on every probe. */
  displayName: string;
  /** Epoch ms of the most recent probe; null until first probe completes. */
  lastProbedAt: number | null;
  /** True while a probe is in flight. */
  probing: boolean;

  /** Runs the factory probe and writes the result to the store. */
  runProbe: () => Promise<void>;
  /** Test/manual seam — set state directly without running the factory. */
  setAvailability: (next: { available: boolean; displayName: string }) => void;
}

export const useAIAvailabilityStore = create<AIAvailabilityState>((set) => ({
  available: true,
  displayName: 'On-device AI',
  lastProbedAt: null,
  probing: false,

  runProbe: async () => {
    set({ probing: true });
    const result = await probeAIAvailability();
    set({
      available: result.available,
      displayName: result.displayName,
      lastProbedAt: Date.now(),
      probing: false,
    });
  },

  setAvailability: (next) =>
    set({
      available: next.available,
      displayName: next.displayName,
      lastProbedAt: Date.now(),
    }),
}));
