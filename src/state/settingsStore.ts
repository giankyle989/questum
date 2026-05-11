import { create } from 'zustand';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import { getDb } from '@/storage/db';
import { requestPermission } from '@/notifications/notifications';

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
  devForceAIUnavailable: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  setDecayPaused: (value: boolean) => Promise<void>;
  setFirstDecayShown: (value: boolean) => Promise<void>;
  setLastDecayRunDay: (day: string) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<{ permissionDenied: boolean }>;
  setNotificationMorningTime: (value: string) => Promise<void>;
  setDevForceAIUnavailable: (value: boolean) => Promise<void>;
  inactivityNudgeEnabled: boolean;
  setInactivityNudgeEnabled: (value: boolean) => Promise<void>;
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
  devForceAIUnavailable: false,
  loading: false,
  inactivityNudgeEnabled: false,

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
      devForceAIUnavailable: all['dev_force_ai_unavailable'] === 'true',
      inactivityNudgeEnabled: all['inactivity_nudge_enabled'] === 'true',
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
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        // Stay OFF — don't persist a "true" state we can't honor.
        return { permissionDenied: true };
      }
    }
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notifications_enabled', value ? 'true' : 'false');
    set({ notificationsEnabled: value });
    return { permissionDenied: false };
  },

  setNotificationMorningTime: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notification_morning_time', value);
    set({ notificationMorningTime: value });
  },

  setDevForceAIUnavailable: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'dev_force_ai_unavailable', value ? 'true' : 'false');
    set({ devForceAIUnavailable: value });
  },

  setInactivityNudgeEnabled: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'inactivity_nudge_enabled', value ? 'true' : 'false');
    set({ inactivityNudgeEnabled: value });
  },
}));
