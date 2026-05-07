# AI Contract

This document defines the exact contract between the app and any AI implementation. Apple Foundation Models, Gemini Nano, and the mock classifier all conform to this contract.

## The job

Given a free-text log of what a user did, return structured XP and attribute data. **The AI never generates user-facing prose in MVP.** It is a parser, not a chatbot.

## Input

```typescript
interface ClassifyLogInput {
  text: string;                          // raw user log, e.g., "ran 5km this morning"
  activeMissions: ActiveMissionSummary[]; // current daily/weekly missions
  currentStreak: number;                  // current streak length in days
  timeOfDay?: string;                     // optional, ISO time
}

interface ActiveMissionSummary {
  id: string;            // full instance ID, e.g., 'daily_cardio_20_2026-05-07'
  description: string;   // human-readable, for AI matching
  attribute: Attribute;
}
```

## Output

```typescript
interface LogResult {
  summary: string;                          // short label, max 60 chars
  primaryAttribute: Attribute;              // STR | DEX | CON | INT | WIS | CHA
  attributeXP: Record<Attribute, number>;   // 0 for unaffected attributes
  totalXP: number;                          // 0-100
  matchedMissions: string[];                // mission IDs from input
  confidence: number;                       // 0.0 - 1.0
  improvementDetected: boolean;             // true if log indicates exceeding prior record
}
```

## Validation (Zod)

Every output is validated against this schema before reaching the game engine:

```typescript
import { z } from 'zod';

export const AttributeSchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);

export const LogResultSchema = z.object({
  summary: z.string().min(1).max(60),
  primaryAttribute: AttributeSchema,
  attributeXP: z.object({
    STR: z.number().int().min(0).max(50),
    DEX: z.number().int().min(0).max(50),
    CON: z.number().int().min(0).max(50),
    INT: z.number().int().min(0).max(50),
    WIS: z.number().int().min(0).max(50),
    CHA: z.number().int().min(0).max(50),
  }),
  totalXP: z.number().int().min(0).max(100),
  matchedMissions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  improvementDetected: z.boolean(),
});

export type LogResult = z.infer<typeof LogResultSchema>;
```

If validation fails: retry once. If it fails again: return a low-confidence fallback (primary attribute = highest keyword match, totalXP = 10, confidence = 0.2). Never throw to the UI.

**Fallback is always on-device** (mock keyword classifier). There is never a cloud-AI fallback in MVP — the "on-device only" rule from PRD §9 is preserved by routing through the local mock when real models fail.

## System prompt design

The prompt is defined in `src/ai/prompts.ts`. Both Apple and Gemini implementations use the same prompt with platform-specific structured-output adapters.

### Structure

```
[Role] You are an activity classifier for a self-improvement RPG app.

[Task] Given a user's log of what they did, return JSON with XP and attribute gains.

[Attributes]
- STR: physical exertion (lifting, sports, manual labor, hiking)
- DEX: skill and coordination (cooking, music, crafts, fine motor)
- CON: health and endurance (cardio, sleep, hydration, healthy meals)
- INT: learning and analysis (studying, reading nonfiction, problem-solving)
- WIS: reflection and discipline (meditation, journaling, planning)
- CHA: social and expression (calls, hangouts, presentations, creative work shared)

[XP Scale]
- 0-20: trivial or very short (5 min walk, quick text to a friend)
- 20-40: standard activity (30 min cardio, an hour of reading)
- 40-70: significant effort (long workout, deep study session, major social event)
- 70-100: exceptional (marathon, full day of focused work, big creative output)
- Cap: total_xp 0-100, per-attribute 0-50

[Multi-attribute logs]
Activities can grant XP to multiple attributes. A run while listening to a podcast: CON (cardio) + small INT or CHA depending on podcast topic.

[Improvement detection]
Set improvementDetected: true ONLY when the log explicitly mentions exceeding a prior record. "Ran 5km" alone is false. "Ran my longest 5km yet" is true. "Lifted heavier than last week" is true.

[Anti-gaming examples]
- "Climbed Mount Everest" → treat as a hike (~30 STR/CON XP, confidence 0.5)
- "Saved the world" → confidence 0.1, totalXP 0
- "Crushed it" with no specifics → confidence 0.4, totalXP 10

[Mission matching]
Active missions are provided. Return mission IDs in matchedMissions ONLY if the log clearly satisfies the mission. "Watched Netflix for 3 hours" does NOT match "Read for 3 hours."

[Few-shot examples]
... (see prompts.ts for the actual examples)

[Output format]
Return JSON matching the provided schema. No prose, no explanation.
```

### Few-shot examples (must include in prompt)

At least 5 examples covering:
1. Simple single-attribute log
2. Multi-attribute log
3. Vague log (low confidence)
4. Anti-gaming case
5. Improvement-detection case
6. Mission-matching case

See `src/ai/prompts.ts` for the canonical list.

## Platform implementation notes

### Apple Foundation Models (iOS)

- Use `LanguageModelSession` with `@Generable` Swift structs
- Structured output is enforced by the framework — no JSON parsing fragility
- Library: `react-native-apple-llm` or `@react-native-ai/apple` (verify which is production-ready when Phase 5 starts)
- Requires custom dev build (cannot use Expo Go)

### Gemini Nano (Android)

- Use ML Kit GenAI Prompt API or AICore directly
- Structured output via JSON schema parameter
- Library: `rn-on-device-ai` (unified API) or direct ML Kit bindings
- Requires custom dev build (cannot use Expo Go)

### Mock (Phases 1-4)

See `MOCK_AI.md` for the keyword-based classifier spec.

## Failure modes and handling

| Failure | Handling |
|---|---|
| AI returns invalid JSON | Retry once, then fall back to mock classifier output |
| AI returns valid JSON but fails Zod schema | Retry once, then fall back to mock |
| AI takes >10s | Show a "still thinking..." indicator; if >20s, cancel via `AbortSignal` and fall back to mock |
| User dismisses log modal mid-call | Caller aborts via `AbortSignal`; no fallback used, result discarded |
| On-device AI not available at runtime | Should never happen post-soft-gate; if it does, route to waitlist |
| User submits empty log | Reject in UI, never call AI |

### Cancellation contract

`classifyLog` accepts an optional `AbortSignal`. Caller obligations:
- Pass a fresh `AbortController` per call.
- Abort the signal when the user dismisses the log modal, navigates away, or a wrapping timeout fires.

Implementation obligations:
- Check `signal.aborted` before starting work and at any await boundary.
- If the underlying model API supports cancellation, propagate it. If not (e.g. Apple Foundation Models in some versions), let the model finish but throw `AbortError` instead of returning the result.
- Always throw a `DOMException` with `name === "AbortError"` on cancel — never resolve with a result post-abort.

## Latency targets

- p50: <2 seconds on-device
- p95: <5 seconds on-device
- If we miss these, we have a problem — measure during the AI spike

## Privacy

- Only the log text + active mission descriptions + streak number are sent to the AI
- No PII, no log history, no character details
- For on-device AI, "sent to" means in-memory function call — nothing leaves the device
- Privacy nutrition label: "Data Not Collected" (because nothing leaves the device)
