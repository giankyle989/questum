import type { ActiveMissionSummary, AIService, ClassifyLogInput, LogResult } from './AIService';
import { ATTRIBUTES, type Attribute } from '@/game/constants';

/**
 * MockAIService — keyword-based classifier used in Phases 1-4.
 *
 * This is scaffolding, not a fallback. The real Apple/Gemini implementations
 * arrive in Phase 5. See `docs/MOCK_AI.md` for the full spec; everything in
 * this file mirrors that doc.
 */
const ATTRIBUTE_KEYWORDS: Record<Attribute, readonly string[]> = {
  STR: [
    'gym',
    'lift',
    'lifted',
    'lifting',
    'workout',
    'pushup',
    'pushups',
    'pullup',
    'pullups',
    'squat',
    'squats',
    'deadlift',
    'bench',
    'sport',
    'sports',
    'soccer',
    'basketball',
    'climbed',
    'climbing',
    'hike',
    'hiked',
    'hiking',
    'carried',
    'moved',
  ],
  DEX: [
    'cooked',
    'cooking',
    'baked',
    'baking',
    'guitar',
    'piano',
    'drums',
    'music',
    'painted',
    'painting',
    'drew',
    'drawing',
    'craft',
    'crafts',
    'sewing',
    'knitting',
    'practiced',
    'practice',
  ],
  CON: [
    'ran',
    'run',
    'running',
    'jog',
    'jogged',
    'jogging',
    'cardio',
    'cycling',
    'biked',
    'swim',
    'swam',
    'swimming',
    'walked',
    'walking',
    'slept',
    'sleep',
    'water',
    'hydrated',
    'meal',
    'breakfast',
    'lunch',
    'dinner',
    'rested',
  ],
  INT: [
    'read',
    'reading',
    'studied',
    'studying',
    'study',
    'learned',
    'learning',
    'course',
    'tutorial',
    'book',
    'article',
    'paper',
    'lecture',
    'coding',
    'coded',
    'programmed',
    'puzzle',
    'solved',
  ],
  WIS: [
    'meditated',
    'meditation',
    'meditate',
    'journal',
    'journaled',
    'journaling',
    'reflected',
    'reflection',
    'planned',
    'planning',
    'plan',
    'breath',
    'breathing',
    'mindful',
    'mindfulness',
  ],
  CHA: [
    'called',
    'call',
    'phone',
    'talked',
    'met',
    'meeting',
    'hangout',
    'hung',
    'lunch',
    'dinner',
    'friend',
    'friends',
    'family',
    'mom',
    'dad',
    'presentation',
    'spoke',
    'speech',
    'wrote',
    'writing',
    'posted',
    'shared',
    'sang',
    'singing',
  ],
};

/**
 * Order matters — first regex match wins. The `minutesPerUnit = -1` sentinel
 * indicates that the captured number is an hour count and should be multiplied
 * by 60 below.
 */
const DURATION_PATTERNS: ReadonlyArray<{ pattern: RegExp; minutesPerUnit: number }> = [
  { pattern: /(\d+)\s*(hour|hr|hrs)/i, minutesPerUnit: -1 },
  { pattern: /(\d+)\s*(min|mins|minute|minutes)/i, minutesPerUnit: 1 },
  { pattern: /(\d+)\s*km/i, minutesPerUnit: 6 },
  { pattern: /(\d+)\s*pages?/i, minutesPerUnit: 2 },
  { pattern: /(\d+)\s*chapters?/i, minutesPerUnit: 20 },
];

const IMPROVEMENT_REGEX =
  /(longest|farthest|heaviest|pr|personal best|record|more than|harder than|pushed)/i;

const MIN_XP_WHEN_MATCHED_WITH_DURATION = 10;
const MAX_XP_PER_ATTRIBUTE = 50;
const NO_MATCH_TOTAL_XP = 5;
const NO_MATCH_CONFIDENCE = 0.2;
const MAX_TOTAL_XP = 100;
const SUMMARY_MAX_LEN = 60;
const MISSION_OVERLAP_THRESHOLD = 2;
const MISSION_CONTENT_WORD_MIN_LEN = 4;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.!?;:'"()]+/)
    .filter(Boolean);
}

function extractDurationMinutes(text: string): number | null {
  for (const { pattern, minutesPerUnit } of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return minutesPerUnit === -1 ? num * 60 : num * minutesPerUnit;
    }
  }
  return null;
}

function emptyAttributeXP(): Record<Attribute, number> {
  return ATTRIBUTES.reduce(
    (acc, attr) => {
      acc[attr] = 0;
      return acc;
    },
    {} as Record<Attribute, number>,
  );
}

function computeAttributeXP(
  tokens: readonly string[],
  durationMinutes: number | null,
): { attributeXP: Record<Attribute, number>; matchedCount: number } {
  const attributeXP = emptyAttributeXP();
  const tokenSet = new Set(tokens);
  let matchedCount = 0;

  for (const attr of ATTRIBUTES) {
    const keywords = ATTRIBUTE_KEYWORDS[attr];
    const matched = keywords.some((kw) => tokenSet.has(kw));
    if (!matched) continue;

    matchedCount += 1;
    if (durationMinutes === null) {
      attributeXP[attr] = 15;
    } else {
      attributeXP[attr] = Math.min(
        MAX_XP_PER_ATTRIBUTE,
        Math.max(MIN_XP_WHEN_MATCHED_WITH_DURATION, Math.floor(durationMinutes / 2)),
      );
    }
  }

  return { attributeXP, matchedCount };
}

function pickPrimaryAttribute(attributeXP: Record<Attribute, number>): Attribute {
  // Tie-broken by ATTRIBUTES order (STR<DEX<CON<INT<WIS<CHA).
  let best: Attribute = 'STR';
  let bestXP = -1;
  for (const attr of ATTRIBUTES) {
    if (attributeXP[attr] > bestXP) {
      bestXP = attributeXP[attr];
      best = attr;
    }
  }
  return best;
}

function computeConfidence(matchedAttributes: number, hasDuration: boolean): number {
  // Only called when matchedAttributes >= 1 — the no-match branch in
  // `classifyLog` short-circuits with NO_MATCH_CONFIDENCE before reaching here.
  // Per docs/MOCK_AI.md §Step 7: base 0.5 + 0.2 (≥1 match) + 0.1 (≥2 matches) +
  // 0.15 (has duration), capped at 0.95.
  let confidence = 0.5 + 0.2;
  if (matchedAttributes > 1) confidence += 0.1;
  if (hasDuration) confidence += 0.15;
  return Math.min(confidence, 0.95);
}

function matchMissions(
  tokens: readonly string[],
  activeMissions: readonly ActiveMissionSummary[],
): string[] {
  const inputContent = new Set(tokens.filter((t) => t.length >= MISSION_CONTENT_WORD_MIN_LEN));
  const matched: string[] = [];
  for (const mission of activeMissions) {
    const missionTokens = tokenize(mission.description).filter(
      (t) => t.length >= MISSION_CONTENT_WORD_MIN_LEN,
    );
    let overlap = 0;
    const seen = new Set<string>();
    for (const t of missionTokens) {
      if (!seen.has(t) && inputContent.has(t)) {
        overlap += 1;
        seen.add(t);
        if (overlap >= MISSION_OVERLAP_THRESHOLD) break;
      }
    }
    if (overlap >= MISSION_OVERLAP_THRESHOLD) {
      matched.push(mission.id);
    }
  }
  return matched;
}

function makeAbortError(): Error {
  // The AIService contract requires `name === 'AbortError'` — it does NOT
  // require a real DOMException. Constructing a tagged Error keeps behavior
  // identical across Node, ts-jest, and React Native runtimes (where
  // DOMException availability has historically varied).
  return Object.assign(new Error('Aborted'), { name: 'AbortError' });
}

export class MockAIService implements AIService {
  readonly sourceId = 'mock' as const;
  readonly displayName = 'Mock (development)';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async classifyLog(input: ClassifyLogInput, signal?: AbortSignal): Promise<LogResult> {
    if (signal?.aborted) {
      throw makeAbortError();
    }

    const text = input.text;
    const tokens = tokenize(text);
    const durationMinutes = extractDurationMinutes(text);
    const { attributeXP, matchedCount } = computeAttributeXP(tokens, durationMinutes);

    const summary = text.slice(0, SUMMARY_MAX_LEN) || 'Log';

    if (matchedCount === 0) {
      return {
        summary,
        primaryAttribute: 'STR',
        attributeXP: emptyAttributeXP(),
        totalXP: NO_MATCH_TOTAL_XP,
        matchedMissions: matchMissions(tokens, input.activeMissions),
        confidence: NO_MATCH_CONFIDENCE,
        improvementDetected: IMPROVEMENT_REGEX.test(text),
      };
    }

    const sumXP = ATTRIBUTES.reduce((sum, attr) => sum + attributeXP[attr], 0);
    const totalXP = Math.min(MAX_TOTAL_XP, sumXP);

    return {
      summary,
      primaryAttribute: pickPrimaryAttribute(attributeXP),
      attributeXP,
      totalXP,
      matchedMissions: matchMissions(tokens, input.activeMissions),
      confidence: computeConfidence(matchedCount, durationMinutes !== null),
      improvementDetected: IMPROVEMENT_REGEX.test(text),
    };
  }
}
