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
