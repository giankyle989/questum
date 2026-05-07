# AI Spike Protocol

This is the validation gate before shipping. Run this in Phase 5 once Apple Foundation Models / Gemini Nano integrations are wired up.

## Why this matters

The product premise is "AI removes logging friction." If the AI quality isn't there, no amount of UI polish saves the product. This spike tells you whether you have a product or not.

**Do not skip. Do not ship without passing acceptance criteria.**

## What you need

- Custom dev build of the app on iPhone 15 Pro+ (iOS) and a Pixel 8+ or Galaxy S24+ (Android)
- A test screen accessible in dev builds that runs the spike automatically (build this as part of Phase 5)
- A spreadsheet or markdown table for recording results

## Test screen requirements

Build a hidden developer screen accessible from Settings (debug builds only):

- A button "Run AI Spike"
- Loops through the 30 test logs below
- For each log, calls the active AIService and records: log text, parsed result, latency, schema valid (yes/no)
- Saves results to a JSON file you can email or AirDrop to yourself
- Also runs the consistency subset 5 times each

## The 30-log test set

### Tier 1: Easy (single attribute, clear duration) — 5 logs

| #   | Log                          | Expected primary | Expected XP range |
| --- | ---------------------------- | ---------------- | ----------------- |
| 1   | "Ran 5km this morning"       | CON              | 30-50             |
| 2   | "Read 30 pages of a novel"   | INT              | 20-40             |
| 3   | "Did a 20 minute meditation" | WIS              | 20-40             |
| 4   | "Cooked dinner from scratch" | DEX              | 20-40             |
| 5   | "Called my mom for an hour"  | CHA              | 30-50             |

### Tier 2: Medium (multi-attribute, ambiguous effort) — 5 logs

| #   | Log                                                                 | Expected primary     | Other attributes affected                                       |
| --- | ------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| 6   | "Did legs at the gym and listened to a stoicism podcast on the way" | STR                  | INT (small), WIS (small)                                        |
| 7   | "Studied calculus for 2 hours then went for a walk"                 | INT                  | CON                                                             |
| 8   | "Made breakfast, did some stretching, journaled for 15 min"         | (any of DEX/CON/WIS) | the other two                                                   |
| 9   | "Finished a coding project I was stuck on for weeks"                | INT                  | (improvement: TRUE — "stuck on for weeks" implies breakthrough) |
| 10  | "Hung out with friends and tried rock climbing for the first time"  | CHA or STR           | the other                                                       |

### Tier 3: Hard (vague, idiomatic, sparse) — 5 logs

| #   | Log                              | Expected behavior                                  |
| --- | -------------------------------- | -------------------------------------------------- |
| 11  | "Crushed it today"               | Low confidence (<0.4), low XP (5-15)               |
| 12  | "Lazy day but I did the dishes"  | DEX or low CON, small XP                           |
| 13  | "Gym"                            | STR primary, low confidence                        |
| 14  | "Read"                           | INT primary, low confidence, low XP                |
| 15  | "Worked from 9 to 6, exhausting" | Low confidence, low XP — "work" alone is too vague |

### Tier 4: Anti-gaming and edge cases — 5 logs

| #   | Log                                       | Expected behavior                                                                      |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| 16  | "Climbed Mount Everest"                   | Treat as a hike (~30 STR/CON), confidence ~0.5                                         |
| 17  | "Ran a marathon"                          | High CON (60-80), capped at 100 total                                                  |
| 18  | "Watched a documentary about World War 2" | INT, modest XP (20-30)                                                                 |
| 19  | "Slept 9 hours"                           | CON, modest XP (20-30)                                                                 |
| 20  | "Played video games for 4 hours"          | Should NOT give significant XP — maybe small CHA if multiplayer or DEX, low confidence |

### Tier 5: Multi-language and informal — 3 logs

| #   | Log                                                                    | Expected behavior                                             |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| 21  | "naglinis ng bahay tapos nag-jog" (Tagalog: cleaned house then jogged) | Should still parse — STR/CON; if model fails, document as gap |
| 22  | "leg day was brutal lmao"                                              | STR primary, decent XP                                        |
| 23  | "lecture then library then bed"                                        | INT primary                                                   |

### Tier 6: Consistency check — 5 logs run 2x each

Re-run logs 1, 3, 6, 9, 14 a second time. Compare results. Variance >20% on totalXP for the same input is a red flag.

### Tier 7: Mission matching — 2 logs

Stub two active mission instances in the test (use the spike date for the suffix):

- `daily_cardio_20_<DATE>`: "Move your body for 20 minutes"
- `weekly_read_3h_<MONDAY>`: "Read for a total of 3 hours this week"

| #   | Log                           | Expected matched_missions     |
| --- | ----------------------------- | ----------------------------- |
| 24  | "Went for a 30 minute jog"    | `['daily_cardio_20_<DATE>']`  |
| 25  | "Watched Netflix for 3 hours" | `[]` (Netflix is not reading) |

(Note: numbering goes to 25 with the 5 consistency reruns counted, totaling 30 test runs.)

## Scoring

For each log, record:

| Field                      | Value              |
| -------------------------- | ------------------ |
| Schema valid?              | yes / no           |
| Primary attribute correct? | yes / no / partial |
| XP in expected range?      | yes / no           |
| Latency (ms)               | number             |
| Confidence                 | number             |
| Notes                      | free text          |

## Acceptance criteria

| Metric                            | Target | Hard fail |
| --------------------------------- | ------ | --------- |
| Schema validity rate              | ≥ 95%  | < 90%     |
| Primary attribute correctness     | ≥ 85%  | < 75%     |
| XP in expected range              | ≥ 80%  | < 70%     |
| p50 latency                       | < 2s   | > 4s      |
| p95 latency                       | < 5s   | > 10s     |
| Consistency variance (same input) | ≤ 15%  | > 25%     |

**Pass:** Hit all targets. Ship it.
**Soft fail:** Miss 1-2 targets but not in hard-fail territory. Tune the prompt and re-run.
**Hard fail:** Any metric in hard-fail territory. The on-device model isn't ready. Options:

- Try a different prompt structure (more few-shot examples, clearer instructions)
- Wait for the next iOS/Android version with a better model
- Reconsider the on-device-only constraint
- Pivot the wedge — maybe the AI handles primary classification but a deterministic table sets XP

Do not ship a hard fail. The product premise depends on this.

## After the spike

Whatever the outcome:

1. Save the results JSON for posterity
2. Update `AI_CONTRACT.md` with any prompt changes that emerged
3. Update `MOCK_AI.md` if the mock should now mimic real AI behavior more closely (for testing parity)
4. Document any device-specific quirks (e.g., "iPhone 15 Pro is 30% slower than iPhone 17 on this prompt")

## Cost estimate

If using MacinCloud pay-as-you-go for the iOS portion:

- Setup time (Xcode install, Apple Developer config): ~3 hours
- Building the dev build and the spike test screen: ~4 hours
- Running the spike, iterating on the prompt: ~2 hours
- Total: ~9 hours × $1/hour = ~$9-12 USD plus a buffer

Budget $25-30 USD for the AI spike phase. If it takes longer, that's a signal that the integration is harder than expected — escalate.
