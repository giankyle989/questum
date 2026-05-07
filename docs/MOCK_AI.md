# Mock AI Service

This is the keyword-based classifier used during Phases 1-4. It implements the `AIService` interface so the rest of the app can be built and tested without any real AI.

**This is scaffolding, not a fallback.** It will produce wrong results on real-world logs. The real AI must work for the product to ship. Do not be tempted to ship the mock.

## Goals

- Satisfy the `AIService` interface contract from `AI_CONTRACT.md`
- Return believable XP and attribute assignments for testing the UI
- Be deterministic — same input always returns same output (helps testing)
- Run synchronously fast (<50ms) so the loading state isn't artificially long

## Behavior

### Step 1: Tokenize the log

Lowercase, split on whitespace and punctuation:

```typescript
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.!?;:'"()]+/).filter(Boolean);
}
```

### Step 2: Match attribute keywords

Keyword → attribute mapping. First match wins for primary; all matches contribute to attributeXP.

```typescript
const ATTRIBUTE_KEYWORDS: Record<Attribute, string[]> = {
  STR: ['gym', 'lift', 'lifted', 'lifting', 'workout', 'pushup', 'pushups', 'pullup', 'pullups',
        'squat', 'squats', 'deadlift', 'bench', 'sport', 'sports', 'soccer', 'basketball',
        'climbed', 'climbing', 'hike', 'hiked', 'hiking', 'carried', 'moved'],

  DEX: ['cooked', 'cooking', 'baked', 'baking', 'guitar', 'piano', 'drums', 'music',
        'painted', 'painting', 'drew', 'drawing', 'craft', 'crafts', 'sewing', 'knitting',
        'practiced', 'practice'],

  CON: ['ran', 'run', 'running', 'jog', 'jogged', 'jogging', 'cardio', 'cycling', 'biked',
        'swim', 'swam', 'swimming', 'walked', 'walking', 'slept', 'sleep', 'water',
        'hydrated', 'meal', 'breakfast', 'lunch', 'dinner', 'rested'],

  INT: ['read', 'reading', 'studied', 'studying', 'study', 'learned', 'learning',
        'course', 'tutorial', 'book', 'article', 'paper', 'lecture', 'coding', 'coded',
        'programmed', 'puzzle', 'solved'],

  WIS: ['meditated', 'meditation', 'meditate', 'journal', 'journaled', 'journaling',
        'reflected', 'reflection', 'planned', 'planning', 'plan', 'breath', 'breathing',
        'mindful', 'mindfulness'],

  CHA: ['called', 'call', 'phone', 'talked', 'talked', 'met', 'meeting', 'hangout',
        'hung', 'lunch', 'dinner', 'friend', 'friends', 'family', 'mom', 'dad',
        'presentation', 'spoke', 'speech', 'wrote', 'writing', 'posted', 'shared',
        'sang', 'singing'],
};
```

Note: some words appear in multiple attributes (e.g., 'lunch' in CON and CHA, 'wrote' in CHA). That's fine — both attributes get XP.

### Step 3: Estimate effort/duration

Look for duration cues:

```typescript
const DURATION_PATTERNS: Array<{ pattern: RegExp; minutes: number }> = [
  { pattern: /(\d+)\s*(hour|hr|hrs)/i, minutes: -1 },  // multiplied by 60 below
  { pattern: /(\d+)\s*(min|mins|minute|minutes)/i, minutes: 1 },
  { pattern: /(\d+)\s*km/i, minutes: 6 },              // ~6 min per km, rough
  { pattern: /(\d+)\s*pages?/i, minutes: 2 },
  { pattern: /(\d+)\s*chapters?/i, minutes: 20 },
];

function extractDurationMinutes(text: string): number | null {
  for (const { pattern, minutes } of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return minutes === -1 ? num * 60 : num * minutes;
    }
  }
  return null;
}
```

### Step 4: Compute XP

Base XP per matched attribute:
- No keyword match for an attribute → 0 XP
- Match found, no duration → 15 XP
- Match found, with duration → `min(50, max(10, durationMinutes / 2))`

`totalXP` is the sum, capped at 100. `primaryAttribute` is the attribute with the highest XP (ties broken by order in ATTRIBUTES array).

### Step 5: Improvement detection

Look for explicit improvement keywords: `longest`, `farthest`, `heaviest`, `pr`, `personal best`, `record`, `more than`, `harder than`, `pushed`. If any present → `improvementDetected: true`.

### Step 6: Mission matching

For each active mission, do a keyword overlap check between the mission description and the log text. If ≥2 content words overlap → match. Return matched mission IDs.

This is crude. The real AI will do better. The mock just needs to occasionally match so the UI flows can be tested.

### Step 7: Confidence

```typescript
function computeConfidence(matchedAttributes: number, hasDuration: boolean): number {
  let confidence = 0.5;
  if (matchedAttributes > 0) confidence += 0.2;
  if (matchedAttributes > 1) confidence += 0.1;
  if (hasDuration) confidence += 0.15;
  return Math.min(confidence, 0.95);
}
```

If no attribute keywords match: return `confidence: 0.2`, primary STR (arbitrary), totalXP 5.

## Reference implementation skeleton

```typescript
// src/ai/MockAIService.ts
import { AIService, ClassifyLogInput, LogResult } from './AIService';

export class MockAIService implements AIService {
  readonly displayName = 'Mock (development)';

  async isAvailable(): Promise<boolean> {
    return true;  // always available
  }

  async classifyLog(input: ClassifyLogInput): Promise<LogResult> {
    const tokens = tokenize(input.text);
    const attributeXP = computeAttributeXP(tokens, input.text);
    const totalXP = Math.min(100, sumValues(attributeXP));
    const primaryAttribute = highestKey(attributeXP);
    const improvementDetected = detectsImprovement(input.text);
    const matchedMissions = matchMissions(tokens, input.activeMissions);
    const confidence = computeConfidence(
      countNonZero(attributeXP),
      extractDurationMinutes(input.text) !== null
    );

    return {
      summary: input.text.slice(0, 60),
      primaryAttribute,
      attributeXP,
      totalXP,
      matchedMissions,
      confidence,
      improvementDetected,
    };
  }
}
```

## Testing the mock

Unit tests for the mock should cover:
- Returns valid schema for any input string (including empty, weird unicode, very long)
- Deterministic: same input twice returns identical output
- Specific examples that exercise each branch

This isn't user-facing quality — it's just enough not to break the rest of the app.

## When to delete this

Phase 5 introduces real AI implementations. The mock STAYS in the codebase as:
- A fallback when both real AI implementations fail validation
- A development/test tool

Move it to `src/ai/MockAIService.ts` permanently. Don't delete.

## What the mock will NOT handle

These cases will look bad with the mock and good with real AI:
- "naglinis ng bahay" (Tagalog: cleaned house) — no English keywords
- "leg day was brutal lmao" — slang, no clear duration
- "crushed it today" — no specifics
- "did the thing" — meaningless to keywords

This is fine for development. When testing in Phase 3, use logs with clear English keywords. The hard cases come back during the AI spike.
