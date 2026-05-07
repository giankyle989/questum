import { create } from 'zustand';

export interface SettingsStoreState {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  notificationMorningTime: string;
  decayPaused: boolean;
  firstDecayShown: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  loading: boolean;

  hydrate: () => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  onboardingComplete: false,
  notificationsEnabled: false,
  notificationMorningTime: '08:00',
  decayPaused: false,
  firstDecayShown: false,
  aiSourceLastUsed: 'none',
  loading: false,

  hydrate: async () => {
    set({ loading: false });
  },

  setOnboardingComplete: async (value) => {
    set({ onboardingComplete: value });
  },
}));
