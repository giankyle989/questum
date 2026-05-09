import { create } from 'zustand';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import { getDb } from '@/storage/db';

export interface SettingsStoreState {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  notificationMorningTime: string;
  decayPaused: boolean;
  firstDecayShown: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  lastDecayRunDay: string | null;
  decayPausedDaysThisYear: number;
  decayPauseStartedAt: string | null;
  loading: boolean;

  hydrate: () => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  setDecayPaused: (value: boolean) => Promise<void>;
  setFirstDecayShown: (value: boolean) => Promise<void>;
  setLastDecayRunDay: (day: string) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setNotificationMorningTime: (value: string) => Promise<void>;
}

function parseAiSource(raw: string | undefined): 'apple' | 'gemini' | 'mock' | 'none' {
  if (raw === 'apple' || raw === 'gemini' || raw === 'mock') return raw;
  return 'none';
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  onboardingComplete: false,
  notificationsEnabled: false,
  notificationMorningTime: '08:00',
  decayPaused: false,
  firstDecayShown: false,
  aiSourceLastUsed: 'none',
  lastDecayRunDay: null,
  decayPausedDaysThisYear: 0,
  decayPauseStartedAt: null,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const db = await getDb();
    const all = await settingsRepo.getAllSettings(db);
    set({
      onboardingComplete: all['onboarding_complete'] === 'true',
      notificationsEnabled: all['notifications_enabled'] === 'true',
      notificationMorningTime: all['notification_morning_time'] ?? '08:00',
      decayPaused: all['decay_paused'] === 'true',
      firstDecayShown: all['first_decay_shown'] === 'true',
      aiSourceLastUsed: parseAiSource(all['ai_source_last_used']),
      lastDecayRunDay: all['last_decay_run_day'] ?? null,
      decayPausedDaysThisYear: parseInt(all['decay_paused_days_this_year'] ?? '0', 10),
      decayPauseStartedAt: all['decay_pause_started_at'] ?? null,
      loading: false,
    });
  },

  setOnboardingComplete: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'onboarding_complete', value ? 'true' : 'false');
    set({ onboardingComplete: value });
  },

  setDecayPaused: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'decay_paused', value ? 'true' : 'false');
    set({ decayPaused: value });
  },

  setFirstDecayShown: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'first_decay_shown', value ? 'true' : 'false');
    set({ firstDecayShown: value });
  },

  setLastDecayRunDay: async (day) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'last_decay_run_day', day);
    set({ lastDecayRunDay: day });
  },

  setNotificationsEnabled: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notifications_enabled', value ? 'true' : 'false');
    set({ notificationsEnabled: value });
  },

  setNotificationMorningTime: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notification_morning_time', value);
    set({ notificationMorningTime: value });
  },
}));
