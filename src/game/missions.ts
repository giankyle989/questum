import type { Attribute } from '@/game/constants';

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
