import type { Attribute } from '@/game/constants';

export interface ActiveMissionSummary {
  /** Full instance ID, e.g. 'daily_cardio_20_2026-05-07'. */
  id: string;
  /** Human-readable, used by the AI for matching against the log text. */
  description: string;
  attribute: Attribute;
}

export interface ClassifyLogInput {
  /** Raw user log, e.g. "ran 5km this morning". */
  text: string;
  activeMissions: ActiveMissionSummary[];
  currentStreak: number;
  /** Optional ISO time. */
  timeOfDay?: string;
}

export interface LogResult {
  /** Short label, max 60 chars. */
  summary: string;
  primaryAttribute: Attribute;
  /** Per-attribute XP. Always six keys, value 0 means unaffected. */
  attributeXP: Record<Attribute, number>;
  /** 0 to 100 (inclusive). */
  totalXP: number;
  /** Mission instance IDs the log applies to. */
  matchedMissions: string[];
  /** 0.0 to 1.0. */
  confidence: number;
  improvementDetected: boolean;
}

export interface AIService {
  /** Returns true if this implementation can run on the current device. */
  isAvailable(): Promise<boolean>;

  /**
   * Classifies a log into structured XP/attribute data.
   *
   * Implementations must respect `signal`: if aborted, throw a
   * `DOMException` with `name === 'AbortError'` rather than resolving.
   * Implementations should also apply an internal timeout (default 10s)
   * and abort themselves if exceeded.
   */
  classifyLog(input: ClassifyLogInput, signal?: AbortSignal): Promise<LogResult>;

  /** Human-readable name for the Settings screen. */
  readonly displayName: string;
}
