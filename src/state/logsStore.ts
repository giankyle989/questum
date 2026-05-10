import { create } from 'zustand';
import { getAIService } from '@/ai/aiServiceFactory';
import type { Attribute } from '@/game/constants';
import type { LevelUp } from '@/game/xp';
import { todayLocalISODate } from '@/lib/clock';
import { haptics } from '@/lib/haptics';
import * as logRepo from '@/storage/repositories/logRepo';
import type { LogEntry } from '@/storage/repositories/logRepo';
import { getDb } from '@/storage/db';
import { useCharacterStore } from '@/state/characterStore';
import { useMissionsStore } from '@/state/missionsStore';
import { submitLog as submitLogFn } from '@/state/submitLog';

export interface LastSubmitResult {
  gains: Partial<Record<Attribute, number>>;
  levelUps: LevelUp[];
  missionCompletions: string[];
  prevStreak: number;
  newStreak: number;
}

export interface LogsStoreState {
  logs: LogEntry[];
  submitting: boolean;
  lastResultSummary: string | null;
  lowConfidence: boolean;
  error: 'storage-error' | 'unknown' | null;
  errorDetail: string | null;
  lastSubmitResult: LastSubmitResult | null;

  hydrate: () => Promise<void>;
  submitLog: (text: string) => Promise<void>;
  cancelSubmit: () => void;
  clearLastSubmitResult: () => void;
}

interface InternalLogsStoreState extends LogsStoreState {
  _abortController: AbortController | null;
}

export const useLogsStore = create<LogsStoreState>((set, get) => {
  const internalSet = set as (
    partial:
      | Partial<InternalLogsStoreState>
      | ((state: InternalLogsStoreState) => Partial<InternalLogsStoreState>),
  ) => void;
  const internalGet = get as () => InternalLogsStoreState;

  const initial: InternalLogsStoreState = {
    logs: [],
    submitting: false,
    lastResultSummary: null,
    lowConfidence: false,
    error: null,
    errorDetail: null,
    lastSubmitResult: null,
    _abortController: null,

    hydrate: async () => {
      const db = await getDb();
      const logs = await logRepo.getRecentLogs(db, 50, 0);
      internalSet({ logs });
    },

    submitLog: async (text) => {
      const controller = new AbortController();
      internalSet({
        _abortController: controller,
        submitting: true,
        error: null,
        errorDetail: null,
        lowConfidence: false,
      });

      const db = await getDb();
      const today = todayLocalISODate();
      const aiService = getAIService();

      const result = await submitLogFn(text, {
        aiService,
        db,
        today,
        signal: controller.signal,
      });

      if (result.ok) {
        await useCharacterStore.getState().hydrate();
        await useMissionsStore.getState().generateForToday();
        await internalGet().hydrate();
        internalSet({
          submitting: false,
          lastResultSummary: null,
          lastSubmitResult: {
            gains: result.gains,
            levelUps: result.levelUps,
            missionCompletions: result.missionCompletions,
            prevStreak: result.prevStreak,
            newStreak: result.newStreak,
          },
          _abortController: null,
        });
        haptics.submit();
        return;
      }

      const detail = 'detail' in result ? (result.detail ?? null) : null;
      switch (result.reason) {
        case 'low-confidence':
          internalSet({ submitting: false, lowConfidence: true, _abortController: null });
          break;
        case 'aborted':
          internalSet({ submitting: false, _abortController: null });
          break;
        case 'storage-error':
          internalSet({
            submitting: false,
            error: 'storage-error',
            errorDetail: detail,
            _abortController: null,
          });
          break;
        case 'invalid-primary':
        case 'unknown':
        default:
          internalSet({
            submitting: false,
            error: 'unknown',
            errorDetail: detail,
            _abortController: null,
          });
          break;
      }
    },

    cancelSubmit: () => {
      internalGet()._abortController?.abort();
    },

    clearLastSubmitResult: () => {
      internalSet({ lastSubmitResult: null });
    },
  };

  return initial;
});
