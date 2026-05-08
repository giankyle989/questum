import { addDays, type ISODate } from '@/game/calendar';
import { ATTRIBUTES, type Attribute } from '@/game/constants';

export type MissionType = 'daily' | 'weekly';

export interface MissionTemplate {
  templateId: string;
  description: string;
  attribute: Attribute;
  type: MissionType;
  bonusXP: number;
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // Daily templates
  {
    templateId: 'daily_str_strength_session',
    description: 'Do a focused strength session',
    attribute: 'STR',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_str_carry_chore',
    description: 'Move something heavy or do a manual chore',
    attribute: 'STR',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_dex_skill_practice',
    description: 'Practice a coordination/skill activity',
    attribute: 'DEX',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_dex_play_game',
    description: 'Play a sport or active game',
    attribute: 'DEX',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_con_cardio',
    description: 'Move your body for 20 minutes',
    attribute: 'CON',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_con_sleep',
    description: 'Get 7+ hours of sleep tonight',
    attribute: 'CON',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_int_study',
    description: 'Spend 30 minutes learning something new',
    attribute: 'INT',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_int_read_nonfiction',
    description: 'Read non-fiction for 20+ minutes',
    attribute: 'INT',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_wis_meditate',
    description: 'Meditate or journal for 10+ minutes',
    attribute: 'WIS',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_wis_reflect',
    description: 'Reflect on a recent experience or decision',
    attribute: 'WIS',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_cha_meaningful_conversation',
    description: 'Have a meaningful conversation with someone',
    attribute: 'CHA',
    type: 'daily',
    bonusXP: 50,
  },
  {
    templateId: 'daily_cha_help_someone',
    description: 'Help someone or do something kind',
    attribute: 'CHA',
    type: 'daily',
    bonusXP: 50,
  },

  // Weekly templates
  {
    templateId: 'weekly_str_three_strength',
    description: 'Three strength sessions this week',
    attribute: 'STR',
    type: 'weekly',
    bonusXP: 150,
  },
  {
    templateId: 'weekly_dex_skill_progress',
    description: 'Make tangible progress on a skill this week',
    attribute: 'DEX',
    type: 'weekly',
    bonusXP: 150,
  },
  {
    templateId: 'weekly_con_three_cardio',
    description: 'Three cardio sessions this week',
    attribute: 'CON',
    type: 'weekly',
    bonusXP: 150,
  },
  {
    templateId: 'weekly_int_long_study',
    description: 'Have a long focused study session this week',
    attribute: 'INT',
    type: 'weekly',
    bonusXP: 150,
  },
  {
    templateId: 'weekly_wis_long_reflection',
    description: 'Spend a long reflective session this week',
    attribute: 'WIS',
    type: 'weekly',
    bonusXP: 150,
  },
  {
    templateId: 'weekly_cha_social_event',
    description: 'Show up to a social event this week',
    attribute: 'CHA',
    type: 'weekly',
    bonusXP: 150,
  },
];

export interface MissionInstance {
  /** `<templateId>_<dateOrWeekStart>`. Stable across reads. */
  id: string;
  templateId: string;
  description: string;
  attribute: Attribute;
  type: MissionType;
  bonusXP: number;
  /** ISO date for daily; ISO date of the Monday for weekly. */
  generatedFor: ISODate;
}

/** Build the unique instance id used in storage and AI input. */
export function instanceIdFor(templateId: string, dateKey: ISODate): string {
  return `${templateId}_${dateKey}`;
}

const DEFAULT_SEED_ATTRIBUTES: readonly Attribute[] = ['CON', 'INT', 'CHA'];

export interface GenerateDailyMissionsInput {
  attributeLevels: Record<Attribute, number>;
  today: ISODate;
  /** False on a fresh install with no logs yet → use default seed. */
  hasEverLogged: boolean;
}

export function generateDailyMissions(input: GenerateDailyMissionsInput): MissionInstance[] {
  const targets = input.hasEverLogged
    ? threeLowestAttributes(input.attributeLevels)
    : DEFAULT_SEED_ATTRIBUTES;

  return targets.map((attribute, idx) => pickInstance(attribute, 'daily', input.today, idx));
}

function threeLowestAttributes(levels: Record<Attribute, number>): Attribute[] {
  return [...ATTRIBUTES]
    .map((attribute, originalIndex) => ({
      attribute,
      originalIndex,
      level: levels[attribute],
    }))
    .sort((a, b) => a.level - b.level || a.originalIndex - b.originalIndex)
    .slice(0, 3)
    .map((x) => x.attribute);
}

/**
 * Deterministic template pick: hash the date string and slot index, modulo the
 * number of available templates for the (attribute, type) combination.
 */
function pickInstance(
  attribute: Attribute,
  type: MissionType,
  dateKey: ISODate,
  slot: number,
): MissionInstance {
  const candidates = MISSION_TEMPLATES.filter((t) => t.attribute === attribute && t.type === type);
  if (candidates.length === 0) {
    throw new Error(`No ${type} templates for ${attribute}`);
  }
  // hashString returns an unsigned 32-bit int (>>> 0), so a single modulo gives a
  // non-negative index in [0, candidates.length). Non-null assertion is safe.
  const idx = hashString(`${dateKey}:${slot}`) % candidates.length;
  const template = candidates[idx]!;
  return {
    id: instanceIdFor(template.templateId, dateKey),
    templateId: template.templateId,
    description: template.description,
    attribute: template.attribute,
    type: template.type,
    bonusXP: template.bonusXP,
    generatedFor: dateKey,
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Returns the ISO date of the Monday on or before the given date. */
export function mondayOf(date: ISODate): ISODate {
  // Reconstruct as a UTC date to avoid local TZ drift; weekday math then matches.
  const [yStr, mStr, dStr] = date.split('-');
  const utc = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
  // getUTCDay: 0=Sunday, 1=Monday, ..., 6=Saturday. Step back to Monday (0 → -6, 1 → 0, ..., 6 → -5).
  const day = utc.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export interface GenerateWeeklyQuestInput {
  attributeLevels: Record<Attribute, number>;
  today: ISODate;
}

export function generateWeeklyQuest(input: GenerateWeeklyQuestInput): MissionInstance[] {
  const monday = mondayOf(input.today);
  const target = lowestAttribute(input.attributeLevels);
  return [pickInstance(target, 'weekly', monday, 0)];
}

/**
 * Returns the lowest-level attribute. Ties are broken by `ATTRIBUTES` order:
 * the strict `<` comparison preserves the first occurrence the loop sees,
 * which is the earliest in `ATTRIBUTES` order.
 */
function lowestAttribute(levels: Record<Attribute, number>): Attribute {
  let best: Attribute = ATTRIBUTES[0]!;
  let bestLevel = levels[best];
  for (let i = 1; i < ATTRIBUTES.length; i++) {
    const a = ATTRIBUTES[i]!;
    const lvl = levels[a];
    if (lvl < bestLevel) {
      best = a;
      bestLevel = lvl;
    }
  }
  return best;
}
