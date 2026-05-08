export const ATTRIBUTES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

export const COLORS = {
  bg: '#0E1116',
  surface: '#161B22',
  surface2: '#1A1F26',
  border: '#2A2F36',
  text: '#E6EDF3',
  textMute: '#9AA4AE',
  textDim: '#7D8590',
  accent: '#E8C547',
} as const;

export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  STR: '#C97A6E',
  DEX: '#8FB29D',
  CON: '#D49E63',
  INT: '#7D9BC4',
  WIS: '#A892C7',
  CHA: '#C786A4',
} as const;

/** Maximum XP per attribute per calendar day (see GAME_RULES.md §Daily attribute cap). */
export const DAILY_ATTRIBUTE_XP_CAP = 200;

/** Maximum XP a single AI-classified log can deposit total (see GAME_RULES.md §Per-log XP cap). */
export const MAX_LOG_TOTAL_XP = 100;

/** Maximum XP a single AI-classified log can deposit into one attribute. */
export const MAX_LOG_ATTRIBUTE_XP = 50;

/** Multiplier applied to XP when the AI flags an improvement on a log (see GAME_RULES.md §Improvement bonus). */
export const IMPROVEMENT_BONUS_MULTIPLIER = 1.25;

/** Per-day XP retention factor applied during decay (see GAME_RULES.md §Per-day decay). */
export const DECAY_PER_DAY_RETENTION = 0.99;

/** Always-on grace period (in days) before decay starts (see GAME_RULES.md §Grace period). */
export const DECAY_GRACE_DAYS = 2;

/** AI confidence below this threshold rejects the log as low-confidence (see AI_CONTRACT.md). */
export const LOW_CONFIDENCE_THRESHOLD = 0.3;

/** Default streak multiplier when no streak tier matches. */
export const BASE_STREAK_MULTIPLIER = 1.0;

/**
 * Streak multiplier tiers (see GAME_RULES.md §Streak multiplier).
 * Ordered descending by `minDays` so the first matching tier wins.
 */
export const STREAK_MULTIPLIER_TIERS = [
  { minDays: 7, multiplier: 1.2 },
  { minDays: 5, multiplier: 1.1 },
  { minDays: 3, multiplier: 1.05 },
] as const;
