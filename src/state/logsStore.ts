import { create } from 'zustand';
import type { LogEntry } from '@/storage/repositories/logRepo';

export interface LogsStoreState {
  logs: LogEntry[];
  submitting: boolean;
  lastResultSummary: string | null;
  error: string | null;

  hydrate: () => Promise<void>;
  submitLog: (text: string) => Promise<void>;
  cancelSubmit: () => void;
}

export const useLogsStore = create<LogsStoreState>((set) => ({
  logs: [],
  submitting: false,
  lastResultSummary: null,
  error: null,

  hydrate: async () => {
    set({ logs: [] });
  },

  submitLog: async () => {
    // Phase 3 will implement the AI → game → storage flow.
  },

  cancelSubmit: () => {
    // Phase 3 will hook this to AbortController.abort().
  },
}));
