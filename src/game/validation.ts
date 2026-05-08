import { ATTRIBUTES, MAX_LOG_TOTAL_XP, MAX_LOG_ATTRIBUTE_XP } from '@/game/constants';
import type { Attribute } from '@/game/constants';
import type { LogResult } from '@/ai/AIService';

const LOW_CONFIDENCE_THRESHOLD = 0.3;

export type ValidationResult =
  | { ok: true; value: LogResult }
  | { ok: false; reason: 'low-confidence' | 'invalid-primary' };

const isAttribute = (a: string): a is Attribute => (ATTRIBUTES as readonly string[]).includes(a);

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(n)));

export function validateLogResult(input: LogResult): ValidationResult {
  if (input.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { ok: false, reason: 'low-confidence' };
  }

  const clampedAttributeXP = ATTRIBUTES.reduce(
    (acc, a) => {
      acc[a] = clamp(input.attributeXP[a] ?? 0, 0, MAX_LOG_ATTRIBUTE_XP);
      return acc;
    },
    {} as Record<Attribute, number>,
  );

  let primary = input.primaryAttribute;
  if (!isAttribute(primary)) {
    let bestAttribute: Attribute | null = null;
    let bestXP = 0;
    for (const a of ATTRIBUTES) {
      const v = clampedAttributeXP[a];
      if (v > bestXP) {
        bestXP = v;
        bestAttribute = a;
      }
    }
    if (bestAttribute === null) {
      return { ok: false, reason: 'invalid-primary' };
    }
    primary = bestAttribute;
  }

  return {
    ok: true,
    value: {
      summary: input.summary,
      primaryAttribute: primary,
      attributeXP: clampedAttributeXP,
      totalXP: clamp(input.totalXP, 0, MAX_LOG_TOTAL_XP),
      matchedMissions: input.matchedMissions,
      confidence: input.confidence,
      improvementDetected: input.improvementDetected,
    },
  };
}
