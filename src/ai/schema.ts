import { z } from 'zod';
import type { Attribute } from '@/game/constants';

export const AttributeSchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);

// Compile-time assertion: AttributeSchema's output type matches the Attribute type
// from game/constants.ts. If the lists drift, this line stops compiling.
const _attributeTypeCheck: Attribute = 'STR' as z.infer<typeof AttributeSchema>;
void _attributeTypeCheck;

const AttributeXPSchema = z.object({
  STR: z.number().int().min(0).max(50),
  DEX: z.number().int().min(0).max(50),
  CON: z.number().int().min(0).max(50),
  INT: z.number().int().min(0).max(50),
  WIS: z.number().int().min(0).max(50),
  CHA: z.number().int().min(0).max(50),
});

export const LogResultSchema = z.object({
  summary: z.string().min(1).max(60),
  primaryAttribute: AttributeSchema,
  attributeXP: AttributeXPSchema,
  totalXP: z.number().int().min(0).max(100),
  matchedMissions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  improvementDetected: z.boolean(),
});

export const ActiveMissionSummarySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  attribute: AttributeSchema,
});

export const ClassifyLogInputSchema = z.object({
  text: z.string().min(1),
  activeMissions: z.array(ActiveMissionSummarySchema),
  currentStreak: z.number().int().min(0),
  timeOfDay: z.string().optional(),
});

// Inferred types — these are the source of truth for the runtime shape; the
// hand-written interfaces in AIService.ts must stay in sync.
export type LogResultParsed = z.infer<typeof LogResultSchema>;
export type ClassifyLogInputParsed = z.infer<typeof ClassifyLogInputSchema>;
export type ActiveMissionSummaryParsed = z.infer<typeof ActiveMissionSummarySchema>;
