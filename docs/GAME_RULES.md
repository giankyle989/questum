# Game Rules

This document is the **single source of truth** for all game mechanics. The game engine implements exactly this. If a value seems wrong in the code, fix the code — not this document. If this document is wrong, propose a change explicitly.

All constants live in `src/game/constants.ts` and must match this document.

## Attributes

Six attributes, fixed:

```typescript
export type Attribute = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export const ATTRIBUTES: Attribute[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
```

## XP and leveling

### Level threshold formula

```
xpToReachLevel(N) = 100 * N
```

That is:
- Level 1 → 2 needs 100 XP
- Level 2 → 3 needs 200 XP
- Level 10 → 11 needs 1000 XP

Total cumulative XP to reach level N from level 1:
```
totalXPForLevel(N) = sum from i=1 to N-1 of (100 * i)
                  = 100 * (N-1) * N / 2
                  = 50 * N * (N-1)
```

### Attribute level

Each attribute starts at level 1 with 0 in-progress XP.

When in-progress XP reaches the threshold for the next level, the attribute levels up: increment level, subtract threshold from XP (carry overflow).

### Character level

Character level is the **average of all six attribute levels, rounded down**:

```
characterLevel = floor((str + dex + con + int + wis + cha) / 6)
```

### Per-log XP cap

The AI returns 0–100 XP per log (`total_xp` field). Code must validate:
- Reject if `total_xp < 0` or `total_xp > 100`
- Reject if any single `attribute_xp` value > 50
- Sum of `attribute_xp` values may exceed `total_xp` (multi-attribute logs are bonus, not redistributive)

### Daily attribute cap

Maximum 200 XP per attribute per calendar day.

When applying XP from a log:
1. For each attribute in `attribute_xp`, check today's accumulated XP for that attribute
2. Allow only up to `200 - already_earned_today`
3. Excess is silently dropped (no error to user)

This prevents grinding and AI gaming.

## Consistency floor and improvement bonus

Two distinct mechanics. Do not conflate them.

### Consistency floor

The AI assigns base XP based on activity type, duration, and effort. This XP is **stable across repeated activities** — running 5km on day 1 and day 100 gets approximately the same XP.

### Improvement bonus

The AI returns `improvementDetected: true` when the log indicates exceeding a prior record (longer run, heavier lift, harder content, longer meditation, etc.). When true:

```
finalXP = baseXP * 1.25
```

This is a 25% bonus, applied after the AI's base assignment but before the streak multiplier.

The AI is responsible for detecting this, not the game engine. The prompt includes examples. The game engine just multiplies when the flag is set.

## Streak multiplier

Calculated from the user's current streak length (consecutive days with at least one log).

| Streak days | Multiplier |
|---|---|
| 1–2  | 1.00x |
| 3–4  | 1.05x |
| 5–6  | 1.10x |
| 7+   | 1.20x |

Applied after improvement bonus, before daily cap clamping:

```
xpAfterMultiplier = round(xpAfterImprovement * streakMultiplier)
```

### Streak update rules

After processing a log on day D:
- If the user's last log was on day D-1, streak increments
- If the user's last log was on day D (already logged today), streak unchanged
- If the user's last log was before D-1 (gap), streak resets to 1

Grace period from decay does NOT extend the streak — a 2-day gap still breaks the streak even though decay hasn't kicked in yet.

## Decay

Always on (not opt-in). Calculated on app open.

### Inputs

- `daysSinceLastLog`: integer days elapsed since user's last log
- `decayPausedDays`: array of day-strings within the calculation window where pause was active

### Grace period

```
effectiveInactiveDays = max(0, daysSinceLastLog - 2 - pausedDaysInWindow)
```

The first 2 inactive days incur no decay. Pause days don't count toward inactive days.

### Per-day decay

For each effective inactive day:
```
decayPercent = min(1.0 + (dayIndex - 1) * 0.5, 5.0) / 100
```

Wait — clarification: the rule is "1% per day, caps at 5%/day." The cleanest reading is:
- Day 3 of inactivity: 1% decay
- Day 4: 1% decay
- ... it stays at 1% per day, NOT escalating

So the simple version:
```
decayPercent = 0.01 // flat 1% per inactive day
```

The 5% cap is a safety ceiling in case the formula changes later. Implement the flat 1% for MVP.

### Applied to in-progress XP only

Decay reduces only the **in-progress XP toward the next level**, never the level itself:

```typescript
function applyDecay(attribute: AttributeState, days: number): AttributeState {
  if (days <= 0) return attribute;
  const decayMultiplier = Math.pow(1 - 0.01, days);
  return {
    ...attribute,
    inProgressXP: Math.floor(attribute.inProgressXP * decayMultiplier),
    // level unchanged, ever
  };
}
```

### Pause mode

User can pause decay from settings. Constraints:
- Max 14 days of pause per calendar year
- Pause is set as a date range (start, end) or "until I unpause"
- Days within a paused range do not count toward `daysSinceLastLog` for decay purposes

Track total paused days per year in settings:
```typescript
{
  decayPaused: boolean;
  decayPauseStartedAt: ISODate | null;
  decayPausedDaysThisYear: number;  // resets Jan 1
}
```

### First decay event

Track in settings: `firstDecayShown: boolean`. When decay is first applied (any non-zero reduction), set a flag for the UI to show the one-time explainer modal. Then set `firstDecayShown: true`.

## Missions

### Daily missions

Generated each morning when the app is opened on a new day. Always 3 missions.

Generation rules:
- Identify the user's 3 lowest-level attributes
- Pick one mission template targeting each
- Templates are simple, e.g., "Move your body for 20 minutes (+50 STR XP)"
- Each mission has: id, description, target attribute, bonus XP, expires at end of day

If the user has never logged anything, seed with a varied default set (one cardio, one read, one social).

### Weekly quests

Generated each Monday morning. Always 1 quest.

Generation rules:
- Targets the user's lowest-level attribute over the trailing week
- Longer-form, e.g., "Read for a total of 3 hours this week"
- Bonus XP is larger (e.g., 150 XP)
- Expires Sunday night

### Mission matching

The AI returns `matched_missions: string[]` — a list of mission IDs the log applies to. The game engine:
1. Validates the IDs exist in the active missions list
2. For each matched mission, increment progress
3. If progress crosses the completion threshold, mark complete and queue bonus XP

Mission bonus XP **does not count against the daily cap.** It's applied as a separate bonus.

### Mission templates

Stored as a static list in `src/game/missions.ts`. Example shape:

```typescript
{
  id: 'daily_cardio_20',
  description: 'Move your body for 20 minutes',
  attribute: 'CON',
  type: 'daily',
  bonusXP: 50,
  // matching is AI-driven, no keyword rules
}
```

## Anti-cheat

### Code-side validation (always applied after AI returns)

- `total_xp` clamped to [0, 100]
- Each `attribute_xp[A]` clamped to [0, 50]
- If `confidence < 0.3`, prompt the user with "we couldn't categorize this — try a more specific log" and don't apply XP
- If primary attribute not in the six valid attributes, fall back to the highest-XP attribute or reject

### Daily cap (above) prevents farming

### AI prompt anti-gaming

The system prompt includes examples like:
- "Climbed Mount Everest" → treat as a hike (~30 STR/CON XP)
- "Ran a marathon" → high CON XP (60-80) but cap at 100 total
- Confidence drops for vague logs ("crushed it today")

## Edge cases

### Empty log
Reject before sending to AI. UI shows "type something first."

### Log on app reinstall (no character)
Route to onboarding. Don't process the log.

### Multiple logs same day
All apply normally, subject to the daily cap.

### Very old `daysSinceLastLog` (e.g., 90 days)
Decay still applies but capped — in-progress XP can decay to zero, but the level stays. After 90 days of decay at 1%, multiplier is `0.99^88 ≈ 0.41`, so 59% of in-progress XP is lost. Levels untouched.

### Clock manipulation
For MVP, don't defend against this. If a user changes their phone clock to fake streaks, they're cheating themselves. Revisit if/when social features ship.
