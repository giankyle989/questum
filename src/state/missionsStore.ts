import { create } from 'zustand';
import type { Mission } from '@/storage/repositories/missionRepo';

export interface MissionsStoreState {
  active: Mission[];
  recentlyCompleted: Mission[];
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  generateForToday: () => Promise<void>;
}

export const useMissionsStore = create<MissionsStoreState>((set) => ({
  active: [],
  recentlyCompleted: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ active: [], recentlyCompleted: [] });
  },

  generateForToday: async () => {
    // Phase 4 implements actual generation.
  },
}));
