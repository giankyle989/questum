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

### Per-log ceiling (worked example)

Mission bonus XP is intentionally *outside* the daily cap — completing a mission you set out to complete is the point, and shouldn't be diluted by the cap budget you've already used. Combined with multipliers, a single log can deposit a large amount onto one attribute. Worked maximum:

- Per-attribute AI XP cap: **50** (per `LogResult` schema)
- Improvement bonus: ×1.25 → **62.5**
- Streak multiplier (7+ days): ×1.20 → **75** (rounded)
- Daily cap clamp: at most **200 - already_earned_today** of the AI XP applies
- Daily mission completion bonus on this attribute: **+50**
- Weekly quest completion bonus on this attribute: **+150**

Worst-case stack on a single log into one attribute (first log of day, completing both missions): `75 + 50 + 150 = 275 XP`. At level 1 (threshold 100), that's two full level-ups in one log. This is acceptable — completing the daily and weekly mission on the same log is rare and feels earned. Do not add a hard ceiling without a concrete reason to.

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

Both the persisted and displayed streak rules below operate on **non-paused calendar days**: any day fully within a `decayPaused` window is skipped when computing gaps. Pause is the user's "time off" — it freezes the streak at its current value rather than ticking it forward or breaking it.

**Persisted streak** (written on log submit). After processing a log on day D:
- Compute `nonPausedDaysSinceLastLog`: count of non-paused calendar days between `lastLogDay` and D, exclusive of both.
- If `nonPausedDaysSinceLastLog === 0` (last log was on D or on the previous non-paused day): streak increments
- If the user's last log was on day D itself (already logged today): streak unchanged
- Otherwise (gap of 1+ non-paused days): streak resets to 1

**Displayed streak** (computed at render time). Pure function `displayedStreak(stored, lastLogDay, today, pauseWindow)`:
- Compute `nonPausedDaysSinceLastLog` between `lastLogDay` and `today`.
- If `today === lastLogDay` or `nonPausedDaysSinceLastLog === 0`: return `stored` (still in window)
- Otherwise: return 0 (broken)

The UI shows 0 the moment a gap of non-paused days actually breaks the streak, without writing to the DB. The DB updates on the next log via the persisted rule.

Decay grace period (the 2 free days) does NOT extend the streak — a 2-day non-paused gap still breaks the streak even though decay hasn't kicked in yet. Pause is different: it freezes the streak entirely.

## Decay

Always on (not opt-in). Calculated on app open.

### Definitions

- `daysSinceLastLog` = `today - lastLogDay` in calendar days. If the user logged today, `daysSinceLastLog = 0`. If the user logged yesterday, `daysSinceLastLog = 1`.
- "Day N since the last log" means `daysSinceLastLog === N` for the day in question.
- "Inactive days" are days `1..daysSinceLastLog`. The first 2 of these are grace; decay applies starting at `daysSinceLastLog === 3` (the third day after the user's last log).

### Inputs

- `daysSinceLastLog`: integer days elapsed since user's last log (see Definitions)
- `decayPausedDays`: array of day-strings within the calculation window where pause was active

### Grace period

```
effectiveInactiveDays = max(0, daysSinceLastLog - 2 - pausedDaysInWindow)
```

The first 2 inactive days incur no decay. Pause days don't count toward inactive days.

### Per-day decay

Each effective inactive day applies a 1% compound reduction to in-progress XP:

```
inProgressXP_new = floor(inProgressXP_old * 0.99)
```

Equivalently, across N days: `inProgressXP * 0.99^N`. The compound form means decay slows as XP shrinks — a user with 100 in-progress XP loses 1 XP on the first decaying day; a user with 10 XP loses well under 1 (and `floor` rounds it to 0 most days).

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

Always 3 missions per active day.

**Generation trigger.** On every app foreground (including cold start), check the most recent daily mission set:
- If no daily set exists for today (device local date), expire any still-`active` daily missions from prior days and generate today's set.
- If today's set already exists, no-op.

Days the user did not open the app produce **no missions** — there is no retroactive backfill, and prior days' missions are simply expired on the next foreground.

**Generation rules:**
- Identify the user's 3 lowest-level attributes (ties broken by `ATTRIBUTES` array order)
- Pick one mission template targeting each
- Templates are simple, e.g., "Move your body for 20 minutes (+50 STR XP)"
- Each mission has: id, description, target attribute, bonus XP, expires at end of day (device local 23:59:59)

If the user has never logged anything, seed with a varied default set (one cardio, one read, one social).

### Weekly quests

Always 1 quest per active week. The "week" is Monday–Sunday in device local time.

**Generation trigger.** On every app foreground, check the most recent weekly quest:
- If no weekly quest exists for the current week, expire any still-`active` weekly from prior weeks and generate this week's quest.
- If this week's quest already exists, no-op.
- A user who skips multiple weeks gets only the current week's quest — no backfill.

**Generation rules:**
- Targets the user's lowest-level attribute over the trailing week
- Binary in MVP — completed by a single qualifying log, e.g., "Have a long reading session this week"
- Bonus XP is larger than daily (e.g., 150 XP)
- Expires Sunday 23:59:59 local time

### Mission matching

All MVP missions are **binary**: a single matching log completes them. (Multi-session accumulation like "Read 3 hours this week" is deferred post-MVP.)

The AI returns `matched_missions: string[]` — a list of mission IDs the log applies to. The game engine:
1. Validates each ID exists in the active missions list and is not already completed
2. Marks the matched missions as completed
3. Queues the bonus XP for each completed mission

Mission bonus XP **does not count against the daily cap.** It's applied as a separate bonus.

### Mission templates and instances

Templates are stored as a static list in `src/game/missions.ts`. Each template has a stable `templateId`. When a mission is generated for a day or week, an **instance** is created with a unique `id` of the form `<templateId>_<YYYY-MM-DD>` (the date is the day generated for daily, or the Monday of the week for weekly).

Template shape:
```typescript
{
  templateId: 'daily_cardio_20',
  description: 'Move your body for 20 minutes',
  attribute: 'CON',
  type: 'daily',
  bonusXP: 50,
  // matching is AI-driven, no keyword rules
}
```

Instance shape (what the AI sees in `activeMissions`):
```typescript
{
  id: 'daily_cardio_20_2026-05-07',  // unique per day
  templateId: 'daily_cardio_20',
  description: 'Move your body for 20 minutes',
  attribute: 'CON',
  // ...
}
```

The AI receives instance IDs and returns instance IDs in `matchedMissions`. The engine validates that returned IDs exist in the current active mission instance list.

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
