# Phase 2 — Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Questum game engine as a layer of pure, deterministic functions covering XP, leveling, streaks, decay, missions, and post-AI validation — fully unit-tested with 100% coverage on `src/game/`. No React, no storage, no I/O. Every rule in `GAME_RULES.md` is encoded in code that the rest of the app can import and call.

**Architecture:** Six small modules under `src/game/`, each with a single clear responsibility and explicit dependencies. `calendar.ts` owns ISO-date math (used by streak and decay). `xp.ts` owns level/threshold math and the XP-gain pipeline. `streak.ts` owns streak length and the multiplier table. `decay.ts` owns the grace-period + compound-decay calculation. `missions.ts` owns templates, instance generation, and matching. `validation.ts` is a small post-AI clamp/reject guard. Functions consume and return plain values — `Attribute`, `AttributeState`, `LogResult`, ISO date strings — so the storage and UI layers can compose them without depending on either.

**Tech Stack:** TypeScript 5.6+ strict, Jest + ts-jest (already configured per `jest.config.js`). Test files co-locate under `src/game/__tests__/<module>.test.ts` matching the existing `constants.test.ts` pattern. No new runtime libraries are added in this phase.

**Spec source:** `docs/GAME_RULES.md` — re-read it before each section. If a value disagrees, the doc wins; fix the code.

**Out of scope (do not implement):**

- Any storage I/O — `applyXPGain` and friends take state and return new state; caller persists.
- Any UI binding — no React imports under `src/game/`.
- Any AI implementation — only `validation.ts` is allowed to inspect `LogResult`-shaped objects.
- Animations, notifications, mission generators that learn from logs (Phase 4 has the adaptive generator).

**Branching:** All work lands on `develop`. Each section below is one PR-sized commit set. Commit at the end of each task; open PRs at section boundaries (A–G).

---

## File structure for Phase 2

End-state under `src/game/`:

```
src/game/
  constants.ts                # already in place
  calendar.ts                 # NEW: ISODate alias + day math + pause-aware day math
  xp.ts                       # NEW: level math + XP pipeline (multipliers + cap + level-up)
  streak.ts                   # NEW: multiplier table + persisted update + displayed compute
  decay.ts                    # NEW: effective inactive days + applyDecay
  missions.ts                 # NEW: templates + daily/weekly generation + matching
  validation.ts               # NEW: post-AI clamp/reject
  __tests__/
    constants.test.ts         # already in place
    calendar.test.ts          # NEW
    xp.test.ts                # NEW
    streak.test.ts            # NEW
    decay.test.ts             # NEW
    missions.test.ts          # NEW
    validation.test.ts        # NEW
```

Existing types referenced from elsewhere (do not redefine):

- `Attribute`, `ATTRIBUTES`, `DAILY_ATTRIBUTE_XP_CAP`, `MAX_LOG_TOTAL_XP`, `MAX_LOG_ATTRIBUTE_XP` — `src/game/constants.ts`
- `AttributeState` — `src/storage/repositories/characterRepo.ts` (`{ attribute, level, inProgressXp }`)
- `LogResult` — `src/ai/AIService.ts` (`{ summary, primaryAttribute, attributeXP, totalXP, matchedMissions, confidence, improvementDetected }`)

Game-engine modules import these types but do **not** import from `src/storage/repositories/*` for I/O — only for the `AttributeState` interface re-export. To keep the dependency direction clean, `xp.ts` re-imports `AttributeState` via `import type` only.

**Intra-module dependencies inside `src/game/`:**

- `streak.ts` and `decay.ts` depend on `calendar.ts` (date math).
- `validation.ts` depends on `constants.ts` and the `LogResult` type from `@/ai/AIService`.
- `missions.ts` depends on `xp.ts` for `applyXPGain` (used by `applyMissionBonus` to apply cap-exempt bonus XP) and `calendar.ts` for `mondayOf`'s date arithmetic.
- No module under `src/game/` imports from `react`, `react-native`, `expo-*`, `@/state/*`, or `@/storage/*`.

---

## Section A — Calendar (date math foundation)

PR title: `feat(game): add calendar utilities for ISO-date day math`

`calendar.ts` is the only place ISO date strings get parsed or compared. `streak.ts` and `decay.ts` import from here; nothing else does.

### Task A1: ISODate type alias and basic day diff

**Files:**

- Create: `src/game/calendar.ts`
- Create: `src/game/__tests__/calendar.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/game/__tests__/calendar.test.ts
import { addDays, daysBetween, type ISODate } from '@/game/calendar';

describe('daysBetween', () => {
  it('returns 0 when the two dates are identical', () => {
    expect(daysBetween('2026-05-08', '2026-05-08')).toBe(0);
  });

  it('returns the positive difference for later second arg', () => {
    expect(daysBetween('2026-05-08', '2026-05-10')).toBe(2);
  });

  it('returns a negative difference for earlier second arg', () => {
    expect(daysBetween('2026-05-10', '2026-05-08')).toBe(-2);
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2026-05-31', '2026-06-01')).toBe(1);
  });

  it('handles year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('handles leap-year February', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });
});

describe('addDays', () => {
  it('returns the same date when adding zero', () => {
    expect(addDays('2026-05-08', 0)).toBe('2026-05-08');
  });

  it('adds positive days within the same month', () => {
    expect(addDays('2026-05-08', 3)).toBe('2026-05-11');
  });

  it('subtracts when given a negative offset', () => {
    expect(addDays('2026-05-08', -3)).toBe('2026-05-05');
  });

  it('rolls forward across a month boundary', () => {
    expect(addDays('2026-05-30', 3)).toBe('2026-06-02');
  });

  it('rolls forward across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap-year February correctly', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('zero-pads months and days', () => {
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
    expect(addDays('2026-09-09', 1)).toBe('2026-09-10');
  });
});
```

- [ ] **Step 2: Run tests, see they fail**

Run: `npm test -- calendar`
Expected: FAIL with "Cannot find module '@/game/calendar'".

- [ ] **Step 3: Implement minimum to pass**

```typescript
// src/game/calendar.ts

/**
 * ISO date string in 'YYYY-MM-DD' form (device-local calendar day).
 * All game-engine functions that take a "day" expect this format.
 */
export type ISODate = string;

const MS_PER_DAY = 86_400_000;

/**
 * Calendar-day difference: `b - a`. Positive when b is later. Treats the date
 * as a UTC midnight to avoid DST drift; do not use this with timestamps.
 */
export function daysBetween(a: ISODate, b: ISODate): number {
  const aMs = Date.UTC(...parseParts(a));
  const bMs = Date.UTC(...parseParts(b));
  return Math.round((bMs - aMs) / MS_PER_DAY);
}

/**
 * Returns `date` shifted by `delta` calendar days (negative shifts backward).
 * UTC-based to avoid DST drift, mirroring `daysBetween`.
 */
export function addDays(date: ISODate, delta: number): ISODate {
  const ms = Date.UTC(...parseParts(date)) + delta * MS_PER_DAY;
  const d = new Date(ms);
  const yyyy = String(d.getUTCFullYear()).padStart(4, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseParts(d: ISODate): [number, number, number] {
  const [yStr, mStr, dStr] = d.split('-');
  return [Number(yStr), Number(mStr) - 1, Number(dStr)];
}
```

- [ ] **Step 4: Run tests, all pass**

Run: `npm test -- calendar`
Expected: 13 passing (6 daysBetween + 7 addDays).

- [ ] **Step 5: Commit**

```bash
git add src/game/calendar.ts src/game/__tests__/calendar.test.ts
git commit -m "feat(game): add daysBetween and addDays calendar utilities"
```

### Task A2: Pause-aware non-paused day count

**Files:**

- Modify: `src/game/calendar.ts`
- Modify: `src/game/__tests__/calendar.test.ts`

A pause window is `{ start: ISODate, end: ISODate | null }`. `end === null` means "still paused" (open-ended window ending at `today`). When counting days between two dates, days that fall inside any pause window do not count.

**Semantics:** the function returns the count of non-paused calendar days from `start` (exclusive) to `end` (inclusive). Pause windows are clipped to `(start, end]` — a pause window covering `start` itself does NOT count, because `start` is the day of the last log and is excluded from the "between" range by definition (per `GAME_RULES.md` §Streak update rules, "exclusive of both" endpoints in the spec's terminology).

This avoids an off-by-one when a pause window begins on the last log day (e.g., user logs Mon, pauses Mon→Fri, logs Fri).

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to src/game/__tests__/calendar.test.ts
import {
  daysBetween,
  nonPausedDaysBetween,
  type ISODate,
  type PauseWindow,
} from '@/game/calendar';

describe('nonPausedDaysBetween', () => {
  const NO_PAUSE: PauseWindow[] = [];

  it('matches daysBetween when no pause windows exist', () => {
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-08', NO_PAUSE)).toBe(7);
  });

  it('returns 0 when start equals end', () => {
    expect(nonPausedDaysBetween('2026-05-08', '2026-05-08', NO_PAUSE)).toBe(0);
  });

  it('subtracts a fully-contained closed pause window', () => {
    // 2026-05-01 → 2026-05-10: 9 days. Pause 03→05 inclusive: 3 days. Result 6.
    const windows: PauseWindow[] = [{ start: '2026-05-03', end: '2026-05-05' }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(6);
  });

  it('subtracts an open-ended pause window up to the end date', () => {
    // 2026-05-01 → 2026-05-10: 9 days. Open pause from 05-07: covers 07,08,09,10 = 4 days. Result 5.
    const windows: PauseWindow[] = [{ start: '2026-05-07', end: null }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(5);
  });

  it('clips a pause window that starts before the range', () => {
    // Range 05-05 (excl) → 05-10 (incl) = 5 days in (start, end].
    // Pause 05-01 → 05-07 clipped to (05-05, 05-10] is 06 and 07 = 2 days. Result 3.
    const windows: PauseWindow[] = [{ start: '2026-05-01', end: '2026-05-07' }];
    expect(nonPausedDaysBetween('2026-05-05', '2026-05-10', windows)).toBe(3);
  });

  it('does NOT count a pause day overlapping `start` (the last log day)', () => {
    // start = 2026-05-01 (lastLogDay), end = 2026-05-05 (today). Pause 05-01 → 05-01.
    // The day OF the last log is excluded from the "between" range, so this pause
    // contributes 0 paused days. Total = 4, paused = 0, result = 4.
    const windows: PauseWindow[] = [{ start: '2026-05-01', end: '2026-05-01' }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-05', windows)).toBe(4);
  });

  it('correctly bridges a full pause from the lastLogDay to today (gap of 0)', () => {
    // Streak boundary case: user logs Mon, pauses Mon→Fri, logs again Fri.
    // Days strictly after Mon and on/before Fri = {Tue, Wed, Thu, Fri} = 4.
    // All 4 are paused (Mon excluded from clip). Result = 0.
    // Streak engine reads 0 → consecutive across pause → increments.
    const windows: PauseWindow[] = [{ start: '2026-05-04', end: '2026-05-08' }];
    expect(nonPausedDaysBetween('2026-05-04', '2026-05-08', windows)).toBe(0);
  });

  it('counts a pause day overlapping `end` (today) the normal way', () => {
    // start = 2026-05-04, end = 2026-05-08. Pause 05-06 → 05-08 includes today.
    // Days in (Mon, Fri] = {Tue, Wed, Thu, Fri} = 4 calendar days. Paused: Wed, Thu, Fri = 3.
    // Result = 4 - 3 = 1.
    const windows: PauseWindow[] = [{ start: '2026-05-06', end: '2026-05-08' }];
    expect(nonPausedDaysBetween('2026-05-04', '2026-05-08', windows)).toBe(1);
  });

  it('handles multiple non-overlapping pause windows', () => {
    // Range 01 → 20 = 19. Pause 03–05 (3) + 10–12 (3) = 6. Result 13.
    const windows: PauseWindow[] = [
      { start: '2026-05-03', end: '2026-05-05' },
      { start: '2026-05-10', end: '2026-05-12' },
    ];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-20', windows)).toBe(13);
  });

  it('deduplicates overlapping pause windows (no double-subtract)', () => {
    // Range 01 → 10 = 9. Two overlapping windows 03-06 (4) and 05-08 (4) → union 03-08 (6). Result 3.
    const windows: PauseWindow[] = [
      { start: '2026-05-03', end: '2026-05-06' },
      { start: '2026-05-05', end: '2026-05-08' },
    ];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(3);
  });

  it('treats negative ranges as zero (no negative days when end < start)', () => {
    expect(nonPausedDaysBetween('2026-05-10', '2026-05-08', NO_PAUSE)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, see new ones fail**

Run: `npm test -- calendar`
Expected: previous tests pass; new tests FAIL with "Cannot find name 'nonPausedDaysBetween'".

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/calendar.ts

export interface PauseWindow {
  start: ISODate;
  /** null means "still paused; window extends to the calculation end date". */
  end: ISODate | null;
}

/**
 * Count of calendar days from `start` (exclusive) to `end` (inclusive) minus
 * any days falling inside any pause window. Pause windows are clipped to
 * `(start, end]` — a pause day on `start` itself does not count, because the
 * function counts non-paused days *between* start and end (the spec's
 * "exclusive of both" semantics in `GAME_RULES.md`). Overlapping windows are
 * merged. Returns 0 if `end` precedes `start`.
 */
export function nonPausedDaysBetween(
  start: ISODate,
  end: ISODate,
  windows: PauseWindow[],
): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 0;

  // Clip pause windows to (start, end] by shifting the lower bound forward 1 day.
  // mergeWindows clips to [clipFrom, end] internally and filters degenerate windows,
  // so each `merged` entry already has start >= clipFrom and end <= `end`.
  const clipFrom = addDays(start, 1);
  const merged = mergeWindows(windows, clipFrom, end);
  let pausedDayCount = 0;
  for (const window of merged) {
    pausedDayCount += daysBetween(window.start, window.end) + 1;
  }

  return Math.max(0, total - pausedDayCount);
}

function mergeWindows(
  windows: PauseWindow[],
  rangeStart: ISODate,
  rangeEnd: ISODate,
): PauseWindow[] {
  const normalized = windows
    .map((w) => ({
      start: laterDate(w.start, rangeStart),
      end: earlierDate(w.end ?? rangeEnd, rangeEnd),
    }))
    // Drop windows that don't overlap [rangeStart, rangeEnd] at all.
    .filter((w) => daysBetween(w.start, w.end) >= 0)
    // Sort ascending by start date: daysBetween(b.start, a.start) is `a - b` in days,
    // negative when a is earlier, which puts a before b.
    .sort((a, b) => daysBetween(b.start, a.start));

  const out: { start: ISODate; end: ISODate }[] = [];
  for (const window of normalized) {
    const last = out[out.length - 1];
    // Merge adjacent windows: 0 days apart (overlap) OR exactly 1 day apart
    // (back-to-back on calendar) are treated as one continuous pause.
    if (last && daysBetween(last.end, window.start) <= 1) {
      last.end = laterDate(last.end, window.end);
    } else {
      out.push({ ...window });
    }
  }
  return out;
}

function laterDate(a: ISODate, b: ISODate): ISODate {
  return daysBetween(a, b) >= 0 ? b : a;
}

function earlierDate(a: ISODate, b: ISODate): ISODate {
  return daysBetween(a, b) <= 0 ? b : a;
}
```

- [ ] **Step 4: Run tests, all pass**

Run: `npm test -- calendar`
Expected: 24 passing (6 daysBetween + 7 addDays + 11 nonPausedDaysBetween).

- [ ] **Step 5: Commit**

```bash
git add src/game/calendar.ts src/game/__tests__/calendar.test.ts
git commit -m "feat(game): add nonPausedDaysBetween for pause-aware day math"
```

---

## Section B — XP module (level math + multipliers + cap + level-up pipeline)

PR title: `feat(game): implement XP, leveling, and the per-log XP pipeline`

This section delivers the **core gain pipeline** the log-submission flow will call:

```
LogResult (validated) → applyImprovementBonus → applyStreakMultiplier → clampToDailyCap → applyXPGain
```

`applyXPGain` is the only function that mutates `AttributeState`-shaped values; it returns new states plus level-ups.

### Task B1: Level threshold and total-XP formulas

**Files:**

- Create: `src/game/xp.ts`
- Create: `src/game/__tests__/xp.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/game/__tests__/xp.test.ts
import { xpToReachLevel, totalXPForLevel, characterLevel } from '@/game/xp';

describe('xpToReachLevel', () => {
  it('returns 100 for level 2 (i.e., 1→2 takes 100 XP)', () => {
    expect(xpToReachLevel(2)).toBe(100);
  });
  it('returns 200 for level 3', () => {
    expect(xpToReachLevel(3)).toBe(200);
  });
  it('returns 1000 for level 11', () => {
    expect(xpToReachLevel(11)).toBe(1000);
  });
  it('throws for level <= 1 (no threshold to reach level 1)', () => {
    expect(() => xpToReachLevel(1)).toThrow();
    expect(() => xpToReachLevel(0)).toThrow();
  });
});

describe('totalXPForLevel', () => {
  it('returns 0 for level 1 (starting level)', () => {
    expect(totalXPForLevel(1)).toBe(0);
  });
  it('returns 100 for level 2', () => {
    expect(totalXPForLevel(2)).toBe(100);
  });
  it('returns 50*N*(N-1) for level N: e.g., 300 for level 3, 600 for level 4', () => {
    expect(totalXPForLevel(3)).toBe(300);
    expect(totalXPForLevel(4)).toBe(600);
    expect(totalXPForLevel(10)).toBe(4500);
  });
});

describe('characterLevel', () => {
  it('returns the floored average of six attribute levels', () => {
    expect(
      characterLevel({ STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }),
    ).toBe(1);
    expect(
      characterLevel({ STR: 2, DEX: 2, CON: 2, INT: 2, WIS: 2, CHA: 2 }),
    ).toBe(2);
    // (1+2+3+4+5+6)/6 = 3.5 → floor 3
    expect(
      characterLevel({ STR: 1, DEX: 2, CON: 3, INT: 4, WIS: 5, CHA: 6 }),
    ).toBe(3);
  });
});
```

- [ ] **Step 2: Run, see fail**

Run: `npm test -- xp`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// src/game/xp.ts
import type { Attribute } from '@/game/constants';

/**
 * XP needed to reach level `N` from level `N - 1`. `N` is the **target** level.
 * Per GAME_RULES §Level threshold formula: `xpToReachLevel(N) = 100 * (N - 1)` for N ≥ 2.
 * Examples: xpToReachLevel(2) === 100, xpToReachLevel(11) === 1000.
 */
export function xpToReachLevel(level: number): number {
  if (level < 2) {
    throw new Error(`xpToReachLevel: level must be >= 2 (got ${level})`);
  }
  return 100 * (level - 1);
}

/**
 * Cumulative XP from level 1 to level N. Equals 50 * N * (N - 1).
 */
export function totalXPForLevel(level: number): number {
  if (level < 1) {
    throw new Error(`totalXPForLevel: level must be >= 1 (got ${level})`);
  }
  return 50 * level * (level - 1);
}

/**
 * Character level = floor of the average of the six attribute levels.
 */
export function characterLevel(levels: Record<Attribute, number>): number {
  const sum =
    levels.STR + levels.DEX + levels.CON + levels.INT + levels.WIS + levels.CHA;
  return Math.floor(sum / 6);
}
```

- [ ] **Step 4: Run, all pass**

Run: `npm test -- xp`
Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add src/game/xp.ts src/game/__tests__/xp.test.ts
git commit -m "feat(game): add level threshold and character level math"
```

### Task B2: Improvement bonus and streak multiplier helpers

The streak multiplier table itself ships in `streak.ts` (Section C). For now, accept a multiplier value as input. We'll wire `getStreakMultiplier` from `streak.ts` once it lands.

**Rounding strategy (matches `GAME_RULES.md` §Per-log ceiling worked example):** the individual multiplier helpers return **floats** — they do not round. Rounding to integer XP happens **exactly once**, at the end of the multiplier chain, in `applyXPMultipliers`. This guarantees that `50 → ×1.25 → 62.5 → ×1.20 → 75` matches the spec (per-step rounding would yield 76).

`applyXPMultipliers` is the canonical entry point for callers. The two single-step helpers stay exported for debugging and partial composition, but consumers building `requestedGains` for `applyLogXP` should always go through `applyXPMultipliers`.

**Files:**

- Modify: `src/game/xp.ts`
- Modify: `src/game/__tests__/xp.test.ts`

- [ ] **Step 1: Append failing tests**

```typescript
// Add to src/game/__tests__/xp.test.ts
import {
  applyImprovementBonus,
  applyStreakMultiplier,
  applyXPMultipliers,
} from '@/game/xp';

describe('applyImprovementBonus', () => {
  it('returns the input unchanged when improvementDetected is false', () => {
    expect(applyImprovementBonus(50, false)).toBe(50);
    expect(applyImprovementBonus(0, false)).toBe(0);
  });
  it('returns 1.25 * input as a float when improvementDetected is true', () => {
    expect(applyImprovementBonus(50, true)).toBe(62.5);
    expect(applyImprovementBonus(40, true)).toBe(50);
    expect(applyImprovementBonus(0, true)).toBe(0);
  });
});

describe('applyStreakMultiplier', () => {
  it('returns the input multiplied as a float (no rounding)', () => {
    expect(applyStreakMultiplier(50, 1.0)).toBe(50);
    expect(applyStreakMultiplier(50, 1.05)).toBeCloseTo(52.5);
    expect(applyStreakMultiplier(50, 1.10)).toBeCloseTo(55);
    expect(applyStreakMultiplier(50, 1.20)).toBeCloseTo(60);
  });
  it('preserves fractional inputs through the multiply', () => {
    // float in, float out — composition with applyImprovementBonus stays exact
    expect(applyStreakMultiplier(62.5, 1.20)).toBeCloseTo(75);
  });
});

describe('applyXPMultipliers', () => {
  it('matches the GAME_RULES per-log ceiling worked example (50 → 75)', () => {
    // 50 → ×1.25 → 62.5 → ×1.20 → 75 (single round at the end)
    expect(applyXPMultipliers(50, true, 1.20)).toBe(75);
  });
  it('returns the base XP rounded when no improvement and 1.0 streak', () => {
    expect(applyXPMultipliers(37, false, 1.0)).toBe(37);
  });
  it('applies streak multiplier alone when no improvement', () => {
    // 50 × 1.05 = 52.5 → round to 53
    expect(applyXPMultipliers(50, false, 1.05)).toBe(53);
  });
  it('applies improvement bonus alone when streak multiplier is 1.0', () => {
    // 50 × 1.25 = 62.5 → Math.round(62.5) === 63 (rounds half away from zero).
    // Intentional: documents the rounding tie-break for future maintainers.
    expect(applyXPMultipliers(50, true, 1.0)).toBe(63);
  });
  it('returns 0 for a 0 base regardless of multipliers', () => {
    expect(applyXPMultipliers(0, true, 1.20)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, see new fails**

Run: `npm test -- xp`

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/xp.ts

/**
 * Multiplies XP by 1.25 when an improvement was detected on the log, otherwise
 * returns the input unchanged. Returns a float — rounding is the caller's job
 * (typically via `applyXPMultipliers`).
 */
export function applyImprovementBonus(xp: number, improvementDetected: boolean): number {
  if (!improvementDetected) return xp;
  return xp * 1.25;
}

/**
 * Multiplies XP by the streak multiplier. Returns a float — rounding is the
 * caller's job (typically via `applyXPMultipliers`).
 */
export function applyStreakMultiplier(xp: number, multiplier: number): number {
  return xp * multiplier;
}

/**
 * Canonical XP-multiplier pipeline: applies the improvement bonus and the
 * streak multiplier, then rounds to integer **once**. Callers building
 * `requestedGains` for `applyLogXP` should always go through this function so
 * the rounding strategy matches `GAME_RULES.md`.
 */
export function applyXPMultipliers(
  baseXP: number,
  improvementDetected: boolean,
  streakMultiplier: number,
): number {
  const afterImprovement = applyImprovementBonus(baseXP, improvementDetected);
  const afterStreak = applyStreakMultiplier(afterImprovement, streakMultiplier);
  return Math.round(afterStreak);
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git add src/game/xp.ts src/game/__tests__/xp.test.ts
git commit -m "feat(game): add XP multipliers with single-round composition"
```

### Task B3: Daily-cap clamp

**Files:**

- Modify: `src/game/xp.ts`
- Modify: `src/game/__tests__/xp.test.ts`

- [ ] **Step 1: Append failing tests**

```typescript
import { clampToDailyCap } from '@/game/xp';
import { DAILY_ATTRIBUTE_XP_CAP } from '@/game/constants';

describe('clampToDailyCap', () => {
  it('returns the requested amount when there is full headroom', () => {
    expect(clampToDailyCap(50, 0)).toBe(50);
  });
  it('returns the cap minus already-earned when partial headroom', () => {
    expect(clampToDailyCap(80, 150)).toBe(50); // headroom = 200 - 150 = 50
  });
  it('returns 0 when the cap is already met', () => {
    expect(clampToDailyCap(50, DAILY_ATTRIBUTE_XP_CAP)).toBe(0);
    expect(clampToDailyCap(50, DAILY_ATTRIBUTE_XP_CAP + 100)).toBe(0);
  });
  it('never returns more than the requested amount', () => {
    // headroom huge, but we only asked for 30
    expect(clampToDailyCap(30, 0)).toBe(30);
  });
  it('treats already-earned of 0 as full headroom', () => {
    expect(clampToDailyCap(200, 0)).toBe(200);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/xp.ts
import { DAILY_ATTRIBUTE_XP_CAP } from '@/game/constants';

/**
 * Returns the amount of XP that can actually land on an attribute given today's
 * accumulated XP for that attribute. Excess is silently dropped per GAME_RULES.
 */
export function clampToDailyCap(requested: number, alreadyEarnedToday: number): number {
  const headroom = Math.max(0, DAILY_ATTRIBUTE_XP_CAP - alreadyEarnedToday);
  return Math.min(requested, headroom);
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add daily-cap clamp"
```

### Task B4: applyXPGain — single-attribute, with level-up detection

This is the central state mutator: take an `AttributeState`, add XP, return new state plus a level-up record if the threshold was crossed (possibly multiple times in one gain).

**Files:**

- Modify: `src/game/xp.ts`
- Modify: `src/game/__tests__/xp.test.ts`

- [ ] **Step 1: Append failing tests**

```typescript
import { applyXPGain, type AttributeStateLike } from '@/game/xp';

const initial = (level: number, inProgressXp: number): AttributeStateLike => ({
  level,
  inProgressXp,
});

describe('applyXPGain', () => {
  it('adds XP without leveling up when below the threshold', () => {
    const result = applyXPGain(initial(1, 30), 50);
    expect(result.state).toEqual({ level: 1, inProgressXp: 80 });
    expect(result.levelUps).toEqual([]);
  });

  it('levels up exactly when XP equals the threshold (carries 0)', () => {
    const result = applyXPGain(initial(1, 0), 100);
    expect(result.state).toEqual({ level: 2, inProgressXp: 0 });
    expect(result.levelUps).toEqual([2]);
  });

  it('levels up and carries overflow to the new in-progress XP', () => {
    const result = applyXPGain(initial(1, 60), 80); // 60 + 80 = 140; over 100, carry 40 at level 2
    expect(result.state).toEqual({ level: 2, inProgressXp: 40 });
    expect(result.levelUps).toEqual([2]);
  });

  it('handles multi-level gains in one application (1 → 3)', () => {
    // Threshold to reach 2 = 100; threshold to reach 3 = 200. From level 1 with 0 in-progress,
    // 250 XP → level 2 (100), level 3 (200), carry 50 at level 3.
    // Wait: from level 1, gaining 250 means: 100 → level 2 (carry 150). At level 2,
    // threshold to reach 3 is 200. 150 < 200, so stay at level 2 with 150 in-progress.
    const result = applyXPGain(initial(1, 0), 250);
    expect(result.state).toEqual({ level: 2, inProgressXp: 150 });
    expect(result.levelUps).toEqual([2]);
  });

  it('handles a true double level-up when carry exceeds next threshold', () => {
    // From level 1 with 0 in-progress, gain 350. 100 → level 2 (carry 250 at level 2).
    // Threshold 2→3 is 200. 250 - 200 = 50, level 3 with 50 in-progress.
    const result = applyXPGain(initial(1, 0), 350);
    expect(result.state).toEqual({ level: 3, inProgressXp: 50 });
    expect(result.levelUps).toEqual([2, 3]);
  });

  it('returns identity for a zero gain', () => {
    const result = applyXPGain(initial(5, 42), 0);
    expect(result.state).toEqual({ level: 5, inProgressXp: 42 });
    expect(result.levelUps).toEqual([]);
  });

  it('throws on negative gain (undefined behavior in spec)', () => {
    expect(() => applyXPGain(initial(1, 0), -5)).toThrow();
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/xp.ts

/**
 * Subset of AttributeState that the XP gain function actually mutates. Kept
 * narrow so tests don't need to construct the full AttributeState
 * (which carries the attribute name).
 */
export interface AttributeStateLike {
  level: number;
  inProgressXp: number;
}

export interface ApplyXPGainResult {
  state: AttributeStateLike;
  /** Levels reached during this gain, in order (e.g. [2, 3] for a double). */
  levelUps: number[];
}

/**
 * Adds `gain` XP to a single attribute state, walking through any level
 * thresholds it crosses. Pure: returns a new state object.
 */
export function applyXPGain(
  state: AttributeStateLike,
  gain: number,
): ApplyXPGainResult {
  if (gain < 0) {
    throw new Error(`applyXPGain: gain must be non-negative (got ${gain})`);
  }
  let level = state.level;
  let inProgressXp = state.inProgressXp + gain;
  const levelUps: number[] = [];

  while (true) {
    const threshold = xpToReachLevel(level + 1);
    if (inProgressXp < threshold) break;
    inProgressXp -= threshold;
    level += 1;
    levelUps.push(level);
  }

  return { state: { level, inProgressXp }, levelUps };
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add applyXPGain with multi-level-up support"
```

### Task B5: Multi-attribute pipeline `applyLogXP`

Takes the per-attribute XP map (post-multipliers) and the daily-earned map, applies each per attribute via `clampToDailyCap` + `applyXPGain`, returns:

- Updated states keyed by attribute
- Per-attribute amount actually applied (for the caller to write back to `daily_xp_earned`)
- All level-ups: `Array<{ attribute, newLevel }>`

**Files:**

- Modify: `src/game/xp.ts`
- Modify: `src/game/__tests__/xp.test.ts`

- [ ] **Step 1: Append failing tests**

```typescript
import { applyLogXP } from '@/game/xp';
import { ATTRIBUTES } from '@/game/constants';
import type { Attribute } from '@/game/constants';

const evenStates = (level: number, inProgressXp: number) =>
  ATTRIBUTES.reduce(
    (acc, a) => {
      acc[a] = { level, inProgressXp };
      return acc;
    },
    {} as Record<Attribute, AttributeStateLike>,
  );

const zeroEarned = (): Record<Attribute, number> =>
  ATTRIBUTES.reduce(
    (acc, a) => { acc[a] = 0; return acc; },
    {} as Record<Attribute, number>,
  );

describe('applyLogXP', () => {
  it('applies XP only to attributes that received gain (others unchanged)', () => {
    const result = applyLogXP({
      states: evenStates(1, 0),
      requestedGains: { STR: 50, DEX: 30 },
      alreadyEarnedToday: zeroEarned(),
    });
    expect(result.newStates.STR).toEqual({ level: 1, inProgressXp: 50 });
    expect(result.newStates.DEX).toEqual({ level: 1, inProgressXp: 30 });
    expect(result.newStates.CON).toEqual({ level: 1, inProgressXp: 0 });
    expect(result.actuallyApplied.STR).toBe(50);
    expect(result.actuallyApplied.DEX).toBe(30);
    expect(result.actuallyApplied.CON).toBe(0);
    expect(result.levelUps).toEqual([]);
  });

  it('clamps to per-attribute daily cap and reports actually-applied accurately', () => {
    const earned = zeroEarned();
    earned.STR = 180;
    const result = applyLogXP({
      states: evenStates(1, 0),
      requestedGains: { STR: 50 },
      alreadyEarnedToday: earned,
    });
    // headroom is 20, so only 20 lands
    expect(result.newStates.STR.inProgressXp).toBe(20);
    expect(result.actuallyApplied.STR).toBe(20);
  });

  it('reports level-ups with attribute names', () => {
    const states = evenStates(1, 80);
    const result = applyLogXP({
      states,
      requestedGains: { INT: 30 },
      alreadyEarnedToday: zeroEarned(),
    });
    expect(result.newStates.INT).toEqual({ level: 2, inProgressXp: 10 });
    expect(result.levelUps).toEqual([{ attribute: 'INT', newLevel: 2 }]);
  });

  it('handles double level-ups across multiple attributes in one log', () => {
    const states = evenStates(1, 0);
    const result = applyLogXP({
      states,
      requestedGains: { STR: 350, INT: 150 },
      alreadyEarnedToday: zeroEarned(),
    });
    expect(result.newStates.STR).toEqual({ level: 3, inProgressXp: 50 });
    expect(result.newStates.INT).toEqual({ level: 2, inProgressXp: 50 });
    expect(result.levelUps).toEqual([
      { attribute: 'STR', newLevel: 2 },
      { attribute: 'STR', newLevel: 3 },
      { attribute: 'INT', newLevel: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/xp.ts
import { ATTRIBUTES } from '@/game/constants';

export interface LevelUp {
  attribute: Attribute;
  newLevel: number;
}

export interface ApplyLogXPInput {
  states: Record<Attribute, AttributeStateLike>;
  /**
   * Post-multiplier integer XP per attribute. Missing keys treated as 0.
   * Callers should produce these via `applyXPMultipliers` so the single-round
   * rounding strategy is preserved end-to-end.
   */
  requestedGains: Partial<Record<Attribute, number>>;
  /** Today's accumulated XP per attribute. Missing keys treated as 0. */
  alreadyEarnedToday: Partial<Record<Attribute, number>>;
}

export interface ApplyLogXPResult {
  newStates: Record<Attribute, AttributeStateLike>;
  /** Amount actually deposited per attribute after cap clamp. */
  actuallyApplied: Record<Attribute, number>;
  levelUps: LevelUp[];
}

export function applyLogXP(input: ApplyLogXPInput): ApplyLogXPResult {
  const newStates = {} as Record<Attribute, AttributeStateLike>;
  const actuallyApplied = {} as Record<Attribute, number>;
  const levelUps: LevelUp[] = [];

  for (const attribute of ATTRIBUTES) {
    const requested = input.requestedGains[attribute] ?? 0;
    const earned = input.alreadyEarnedToday[attribute] ?? 0;
    const toApply = clampToDailyCap(requested, earned);
    const before = input.states[attribute];
    const { state, levelUps: gained } = applyXPGain(before, toApply);
    newStates[attribute] = state;
    actuallyApplied[attribute] = toApply;
    for (const newLevel of gained) {
      levelUps.push({ attribute, newLevel });
    }
  }

  return { newStates, actuallyApplied, levelUps };
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add applyLogXP multi-attribute pipeline with level-up detection"
```

---

## Section C — Streak module

PR title: `feat(game): implement streak length and multiplier`

### Task C1: getStreakMultiplier table

**Files:**

- Create: `src/game/streak.ts`
- Create: `src/game/__tests__/streak.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// src/game/__tests__/streak.test.ts
import { getStreakMultiplier } from '@/game/streak';

describe('getStreakMultiplier', () => {
  it('returns 1.00 for streaks 0, 1, and 2', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(1)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.0);
  });
  it('returns 1.05 for streaks 3 and 4', () => {
    expect(getStreakMultiplier(3)).toBe(1.05);
    expect(getStreakMultiplier(4)).toBe(1.05);
  });
  it('returns 1.10 for streaks 5 and 6', () => {
    expect(getStreakMultiplier(5)).toBe(1.10);
    expect(getStreakMultiplier(6)).toBe(1.10);
  });
  it('returns 1.20 for streaks 7 and above', () => {
    expect(getStreakMultiplier(7)).toBe(1.20);
    expect(getStreakMultiplier(30)).toBe(1.20);
    expect(getStreakMultiplier(365)).toBe(1.20);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// src/game/streak.ts

/**
 * Streak multiplier table per GAME_RULES §Streak multiplier.
 * Streak length is "consecutive days with at least one log."
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.20;
  if (streakDays >= 5) return 1.10;
  if (streakDays >= 3) return 1.05;
  return 1.00;
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git add src/game/streak.ts src/game/__tests__/streak.test.ts
git commit -m "feat(game): add streak multiplier table"
```

### Task C2: updatePersistedStreak (write on log submit)

Per GAME_RULES §Streak update rules, the persisted streak updates when a log lands:

- If the user logged today already (`lastLogDay === today`), streak is unchanged.
- If the user's last log was on the previous non-paused day (`nonPausedDaysBetween` returns 0 across a full pause bridge, or 1 directly), streak increments by 1.
- Otherwise (`nonPausedDaysBetween` returns ≥ 2), the streak resets to 1.

**Why the `<= 1` branch covers two cases:** `nonPausedDaysBetween` returns the calendar gap minus paused days clipped to `(lastLogDay, today]`. A direct yesterday→today gap returns 1; a fully-paused bridge from lastLogDay to today returns 0. Both mean "no non-paused day was missed between the two logs," so both increment.

The function also owns the `longestStreak` watermark: it returns `Math.max(currentLongestStreak, newStreak)` so Phase 3 callers cannot forget to update `streak.longest_length` in the DB. The function returns the new persisted streak length, the new longest-streak watermark, and the new `lastLogDay`.

**Files:**

- Modify: `src/game/streak.ts`
- Modify: `src/game/__tests__/streak.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { updatePersistedStreak } from '@/game/streak';
import type { PauseWindow } from '@/game/calendar';

const NO_PAUSE: PauseWindow[] = [];

describe('updatePersistedStreak', () => {
  it('keeps streak and longest unchanged when today already has a log', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 5,
        currentLongestStreak: 12,
        lastLogDay: '2026-05-08',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 5, newLongestStreak: 12, newLastLogDay: '2026-05-08' });
  });

  it('increments when last log was yesterday (consecutive)', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 3,
        currentLongestStreak: 10,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 4, newLongestStreak: 10, newLastLogDay: '2026-05-08' });
  });

  it('updates longestStreak when newStreak exceeds the prior watermark', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 9,
        currentLongestStreak: 9,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 10, newLongestStreak: 10, newLastLogDay: '2026-05-08' });
  });

  it('does not lower longestStreak when current streak resets', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 10,
        currentLongestStreak: 15,
        lastLogDay: '2026-05-05',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 15, newLastLogDay: '2026-05-08' });
  });

  it('treats a paused gap as continuous (streak increments after 5 paused days)', () => {
    // Last log 05-01, today 05-07, pause 05-02 → 05-06 (does not overlap endpoints).
    // Calendar gap = 6, paused days in (05-01, 05-07] = 5, result = 1 → increment.
    expect(
      updatePersistedStreak({
        currentStreak: 8,
        currentLongestStreak: 8,
        lastLogDay: '2026-05-01',
        today: '2026-05-07',
        pauseWindows: [{ start: '2026-05-02', end: '2026-05-06' }],
      }),
    ).toEqual({ newStreak: 9, newLongestStreak: 9, newLastLogDay: '2026-05-07' });
  });

  it('increments across a full pause that overlaps lastLogDay (gap of 0)', () => {
    // Boundary case: user logs Mon (05-04), pauses Mon→Fri, logs Fri (05-08).
    // Calendar gap = 4, paused days in (05-04, 05-08] = {Tue,Wed,Thu,Fri} = 4 → result 0.
    // Engine treats 0 (with lastLogDay !== today) as "consecutive across pause" → increment.
    // newLastLogDay must update to today, NOT remain as lastLogDay.
    expect(
      updatePersistedStreak({
        currentStreak: 4,
        currentLongestStreak: 4,
        lastLogDay: '2026-05-04',
        today: '2026-05-08',
        pauseWindows: [{ start: '2026-05-04', end: '2026-05-08' }],
      }),
    ).toEqual({ newStreak: 5, newLongestStreak: 5, newLastLogDay: '2026-05-08' });
  });

  it('starts at 1 when there is no prior log (lastLogDay is null) and seeds longest', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 0,
        currentLongestStreak: 0,
        lastLogDay: null,
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 1, newLastLogDay: '2026-05-08' });
  });

  it('resets after one missed non-paused day (calendar gap of 2)', () => {
    // Decay grace period does not extend the streak — even one missed day breaks it.
    // Here: lastLog 05-06, today 05-08, no pause. One day (05-07) was skipped between
    // logs. `nonPausedDaysBetween` returns 2 (calendar gap), engine resets.
    expect(
      updatePersistedStreak({
        currentStreak: 5,
        currentLongestStreak: 7,
        lastLogDay: '2026-05-06',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 7, newLastLogDay: '2026-05-08' });
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/streak.ts
import { nonPausedDaysBetween, type ISODate, type PauseWindow } from '@/game/calendar';

export interface UpdatePersistedStreakInput {
  currentStreak: number;
  /** Previously stored longest-streak watermark (`streak.longest_length`). */
  currentLongestStreak: number;
  /** Previously stored last log day, or null if no prior log. */
  lastLogDay: ISODate | null;
  today: ISODate;
  pauseWindows: PauseWindow[];
}

export interface UpdatePersistedStreakOutput {
  newStreak: number;
  /** `Math.max(currentLongestStreak, newStreak)` — the new watermark to persist. */
  newLongestStreak: number;
  newLastLogDay: ISODate;
}

/**
 * Streak update rule per GAME_RULES §Streak update rules. Called when a log
 * is submitted on `today`.
 *
 * - `lastLogDay === today` → already logged today, streak unchanged.
 * - `nonPausedDaysBetween(lastLogDay, today, pauseWindows) <= 1` → consecutive
 *   (either yesterday → today directly, or last-log → today across a fully
 *   paused bridge with no non-paused day missed) → increment.
 * - Otherwise → reset to 1.
 *
 * Also returns the updated `longestStreak` watermark so Phase 3 callers can
 * persist `streak.longest_length` in a single write without recomputing.
 */
export function updatePersistedStreak(
  input: UpdatePersistedStreakInput,
): UpdatePersistedStreakOutput {
  const { currentStreak, currentLongestStreak, lastLogDay, today, pauseWindows } = input;
  const finalize = (newStreak: number, newLastLogDay: ISODate): UpdatePersistedStreakOutput => ({
    newStreak,
    newLongestStreak: Math.max(currentLongestStreak, newStreak),
    newLastLogDay,
  });

  if (lastLogDay === null) {
    return finalize(1, today);
  }
  if (lastLogDay === today) {
    return finalize(currentStreak, today);
  }
  const nonPausedGap = nonPausedDaysBetween(lastLogDay, today, pauseWindows);
  if (nonPausedGap <= 1) {
    return finalize(currentStreak + 1, today);
  }
  return finalize(1, today);
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add updatePersistedStreak with longest-streak watermark"
```

### Task C3: displayedStreak (compute at render)

Per GAME_RULES, the displayed streak shows 0 the moment the streak is broken (without writing to DB). It returns the stored value while the user is still in the active window, otherwise 0.

**Files:**

- Modify: `src/game/streak.ts`
- Modify: `src/game/__tests__/streak.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { displayedStreak } from '@/game/streak';

describe('displayedStreak', () => {
  it('returns stored when today equals lastLogDay (already logged today)', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-08',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(5);
  });
  it('returns stored when last log was yesterday non-paused (still in window)', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(5);
  });
  it('returns 0 when there is a non-paused gap of 2+ days', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-06',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(0);
  });
  it('returns stored when the gap is fully paused', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-01',
        today: '2026-05-08',
        pauseWindows: [{ start: '2026-05-02', end: '2026-05-07' }],
      }),
    ).toBe(5);
  });
  it('returns 0 when lastLogDay is null', () => {
    expect(
      displayedStreak({
        stored: 0,
        lastLogDay: null,
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/streak.ts
export interface DisplayedStreakInput {
  stored: number;
  lastLogDay: ISODate | null;
  today: ISODate;
  pauseWindows: PauseWindow[];
}

/**
 * displayedStreak: zero the moment a non-paused gap actually breaks the streak,
 * even before the next log writes to the DB. Per GAME_RULES §Displayed streak.
 *
 * The `today === lastLogDay` "still in window" case from the spec is handled
 * implicitly: `nonPausedDaysBetween` returns 0 when start === end, which falls
 * into the `<= 1` branch and returns `stored`. No explicit guard needed.
 */
export function displayedStreak(input: DisplayedStreakInput): number {
  if (input.lastLogDay === null) return 0;
  const nonPausedGap = nonPausedDaysBetween(
    input.lastLogDay,
    input.today,
    input.pauseWindows,
  );
  return nonPausedGap <= 1 ? input.stored : 0;
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add displayedStreak render helper"
```

---

## Section D — Decay module

PR title: `feat(game): implement compound decay with grace period`

### Task D1: effectiveInactiveDays helper

**Files:**

- Create: `src/game/decay.ts`
- Create: `src/game/__tests__/decay.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// src/game/__tests__/decay.test.ts
import { effectiveInactiveDays } from '@/game/decay';

describe('effectiveInactiveDays', () => {
  it('returns 0 for daysSinceLastLog <= 2 (grace period)', () => {
    expect(effectiveInactiveDays(0, 0)).toBe(0);
    expect(effectiveInactiveDays(1, 0)).toBe(0);
    expect(effectiveInactiveDays(2, 0)).toBe(0);
  });

  it('returns daysSinceLastLog - 2 once past the grace period', () => {
    expect(effectiveInactiveDays(3, 0)).toBe(1);
    expect(effectiveInactiveDays(10, 0)).toBe(8);
  });

  it('subtracts paused days inside the inactive window', () => {
    // 10 days inactive, 3 paused → effective = 10 - 2 - 3 = 5
    expect(effectiveInactiveDays(10, 3)).toBe(5);
  });

  it('clamps to 0 when paused days swallow the whole window', () => {
    expect(effectiveInactiveDays(10, 20)).toBe(0);
    expect(effectiveInactiveDays(3, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// src/game/decay.ts

/**
 * Per GAME_RULES §Grace period:
 * effectiveInactiveDays = max(0, daysSinceLastLog - 2 - pausedDaysInWindow)
 * The "2" is the always-on grace period. Pause days never count.
 */
export function effectiveInactiveDays(
  daysSinceLastLog: number,
  pausedDaysInWindow: number,
): number {
  return Math.max(0, daysSinceLastLog - 2 - pausedDaysInWindow);
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git add src/game/decay.ts src/game/__tests__/decay.test.ts
git commit -m "feat(game): add effectiveInactiveDays"
```

### Task D2: applyDecay — compound 1%/day on in-progress XP only

**Files:**

- Modify: `src/game/decay.ts`
- Modify: `src/game/__tests__/decay.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { applyDecay, effectiveInactiveDays } from '@/game/decay';
import type { AttributeStateLike } from '@/game/xp';

const at = (level: number, inProgressXp: number): AttributeStateLike => ({
  level, inProgressXp,
});

describe('applyDecay', () => {
  it('returns identity when effective days is 0', () => {
    expect(applyDecay(at(3, 80), 0)).toEqual({ level: 3, inProgressXp: 80 });
  });

  it('grace boundary: day 2 of inactivity yields no decay (composed with effectiveInactiveDays)', () => {
    // PHASES.md acceptance: "no decay days 1–2". effectiveInactiveDays(2, 0) === 0.
    expect(applyDecay(at(3, 80), effectiveInactiveDays(2, 0))).toEqual({ level: 3, inProgressXp: 80 });
  });

  it('grace boundary: day 3 of inactivity yields exactly one day of decay (composed)', () => {
    // PHASES.md acceptance: "decay applied days 3+". effectiveInactiveDays(3, 0) === 1 → -1%.
    expect(applyDecay(at(3, 100), effectiveInactiveDays(3, 0))).toEqual({ level: 3, inProgressXp: 99 });
  });

  it('applies one day of decay (1% compound, floor)', () => {
    expect(applyDecay(at(1, 100), 1)).toEqual({ level: 1, inProgressXp: 99 });
    expect(applyDecay(at(2, 50), 1)).toEqual({ level: 2, inProgressXp: 49 });
  });

  it('compounds across multiple days', () => {
    // 100 * 0.99^5 = 95.099... → floor 95
    expect(applyDecay(at(1, 100), 5)).toEqual({ level: 1, inProgressXp: 95 });
  });

  it('never reduces the level (only in-progress XP)', () => {
    // Even with massive decay, level stays. 200 * 0.99^88 ≈ 81.5 → 81
    const result = applyDecay(at(7, 200), 88);
    expect(result.level).toBe(7);
    expect(result.inProgressXp).toBeLessThan(200);
    expect(result.inProgressXp).toBeGreaterThanOrEqual(0);
  });

  it('clamps in-progress XP at 0 and never goes negative', () => {
    // 1 XP * 0.99^999 → near 0 → floor to 0
    const result = applyDecay(at(5, 1), 999);
    expect(result.level).toBe(5);
    expect(result.inProgressXp).toBe(0);
  });

  it('handles zero in-progress XP (no change)', () => {
    expect(applyDecay(at(4, 0), 30)).toEqual({ level: 4, inProgressXp: 0 });
  });

  it('throws on negative days', () => {
    expect(() => applyDecay(at(1, 100), -1)).toThrow();
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/decay.ts
import type { AttributeStateLike } from '@/game/xp';

const PER_DAY_RETENTION = 0.99;

/**
 * Per GAME_RULES §Per-day decay and §Applied to in-progress XP only:
 * inProgressXp_new = floor(inProgressXp_old * 0.99^days). Level is never touched.
 */
export function applyDecay(state: AttributeStateLike, effectiveDays: number): AttributeStateLike {
  if (effectiveDays < 0) {
    throw new Error(`applyDecay: effectiveDays must be >= 0 (got ${effectiveDays})`);
  }
  if (effectiveDays === 0) return { ...state };
  const multiplier = Math.pow(PER_DAY_RETENTION, effectiveDays);
  const decayed = Math.floor(state.inProgressXp * multiplier);
  return {
    level: state.level,
    inProgressXp: Math.max(0, decayed),
  };
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add applyDecay (compound, never reduces level)"
```

---

## Section E — Validation module

PR title: `feat(game): add post-AI validation guard`

### Task E1: validateLogResult clamps and rejects

Per GAME_RULES §Anti-cheat code-side validation:

- `total_xp` clamped to [0, 100]
- Each `attribute_xp[A]` clamped to [0, 50]
- If `confidence < 0.3`, return `{ ok: false, reason: 'low-confidence' }` — caller does not apply XP
- If `primaryAttribute` not in the six valid attributes, fall back: pick the highest-XP attribute. If all attributeXP values are zero, reject.

**Files:**

- Create: `src/game/validation.ts`
- Create: `src/game/__tests__/validation.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// src/game/__tests__/validation.test.ts
import { validateLogResult } from '@/game/validation';
import type { LogResult } from '@/ai/AIService';

const goodResult = (overrides: Partial<LogResult> = {}): LogResult => ({
  summary: 'Ran 5km',
  primaryAttribute: 'CON',
  attributeXP: { STR: 0, DEX: 0, CON: 50, INT: 0, WIS: 0, CHA: 0 },
  totalXP: 50,
  matchedMissions: [],
  confidence: 0.8,
  improvementDetected: false,
  ...overrides,
});

describe('validateLogResult', () => {
  it('passes a clean result through unchanged', () => {
    const r = validateLogResult(goodResult());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalXP).toBe(50);
      expect(r.value.attributeXP.CON).toBe(50);
    }
  });

  it('clamps totalXP above 100 down to 100', () => {
    const r = validateLogResult(goodResult({ totalXP: 250 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalXP).toBe(100);
  });

  it('clamps negative totalXP to 0', () => {
    const r = validateLogResult(goodResult({ totalXP: -10 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalXP).toBe(0);
  });

  it('clamps individual attribute XP above 50 to 50', () => {
    const r = validateLogResult(
      goodResult({
        attributeXP: { STR: 80, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
        primaryAttribute: 'STR',
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.attributeXP.STR).toBe(50);
  });

  it('rejects when confidence < 0.3', () => {
    const r = validateLogResult(goodResult({ confidence: 0.2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low-confidence');
  });

  it('replaces invalid primary with the highest-XP attribute', () => {
    const r = validateLogResult({
      ...goodResult(),
      primaryAttribute: 'NOPE' as never,
      attributeXP: { STR: 10, DEX: 30, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.primaryAttribute).toBe('DEX');
  });

  it('rejects when primary is invalid AND all attributeXP are zero', () => {
    const r = validateLogResult({
      ...goodResult(),
      primaryAttribute: 'NOPE' as never,
      attributeXP: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      totalXP: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid-primary');
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// src/game/validation.ts
import { ATTRIBUTES, MAX_LOG_TOTAL_XP, MAX_LOG_ATTRIBUTE_XP } from '@/game/constants';
import type { Attribute } from '@/game/constants';
import type { LogResult } from '@/ai/AIService';

const LOW_CONFIDENCE_THRESHOLD = 0.3;

export type ValidationResult =
  | { ok: true; value: LogResult }
  | { ok: false; reason: 'low-confidence' | 'invalid-primary' };

const isAttribute = (a: string): a is Attribute =>
  (ATTRIBUTES as readonly string[]).includes(a);

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
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git add src/game/validation.ts src/game/__tests__/validation.test.ts
git commit -m "feat(game): add post-AI validation guard"
```

---

## Section F — Missions module

PR title: `feat(game): implement mission templates, generation, and matching`

### Task F1: Mission template list and shapes

Per GAME_RULES §Mission templates and instances. Templates are static; instances are derived per day/week.

**Files:**

- Create: `src/game/missions.ts`
- Create: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// src/game/__tests__/missions.test.ts
import { MISSION_TEMPLATES, type MissionTemplate } from '@/game/missions';
import { ATTRIBUTES } from '@/game/constants';

describe('MISSION_TEMPLATES', () => {
  it('has at least one daily template per attribute', () => {
    for (const attribute of ATTRIBUTES) {
      const dailyForAttr = MISSION_TEMPLATES.filter(
        (t) => t.attribute === attribute && t.type === 'daily',
      );
      expect(dailyForAttr.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('has at least one weekly template per attribute', () => {
    for (const attribute of ATTRIBUTES) {
      const weeklyForAttr = MISSION_TEMPLATES.filter(
        (t) => t.attribute === attribute && t.type === 'weekly',
      );
      expect(weeklyForAttr.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every template has a unique templateId', () => {
    const ids = MISSION_TEMPLATES.map((t) => t.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('daily bonusXP is 50 and weekly is 150 by default', () => {
    for (const t of MISSION_TEMPLATES) {
      if (t.type === 'daily') expect(t.bonusXP).toBe(50);
      if (t.type === 'weekly') expect(t.bonusXP).toBe(150);
    }
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// src/game/missions.ts
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
  { templateId: 'daily_str_strength_session', description: 'Do a focused strength session', attribute: 'STR', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_str_carry_chore', description: 'Move something heavy or do a manual chore', attribute: 'STR', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_dex_skill_practice', description: 'Practice a coordination/skill activity', attribute: 'DEX', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_dex_play_game', description: 'Play a sport or active game', attribute: 'DEX', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_con_cardio', description: 'Move your body for 20 minutes', attribute: 'CON', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_con_sleep', description: 'Get 7+ hours of sleep tonight', attribute: 'CON', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_int_study', description: 'Spend 30 minutes learning something new', attribute: 'INT', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_int_read_nonfiction', description: 'Read non-fiction for 20+ minutes', attribute: 'INT', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_wis_meditate', description: 'Meditate or journal for 10+ minutes', attribute: 'WIS', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_wis_reflect', description: 'Reflect on a recent experience or decision', attribute: 'WIS', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_cha_meaningful_conversation', description: 'Have a meaningful conversation with someone', attribute: 'CHA', type: 'daily', bonusXP: 50 },
  { templateId: 'daily_cha_help_someone', description: 'Help someone or do something kind', attribute: 'CHA', type: 'daily', bonusXP: 50 },

  // Weekly templates
  { templateId: 'weekly_str_three_strength', description: 'Three strength sessions this week', attribute: 'STR', type: 'weekly', bonusXP: 150 },
  { templateId: 'weekly_dex_skill_progress', description: 'Make tangible progress on a skill this week', attribute: 'DEX', type: 'weekly', bonusXP: 150 },
  { templateId: 'weekly_con_three_cardio', description: 'Three cardio sessions this week', attribute: 'CON', type: 'weekly', bonusXP: 150 },
  { templateId: 'weekly_int_long_study', description: 'Have a long focused study session this week', attribute: 'INT', type: 'weekly', bonusXP: 150 },
  { templateId: 'weekly_wis_long_reflection', description: 'Spend a long reflective session this week', attribute: 'WIS', type: 'weekly', bonusXP: 150 },
  { templateId: 'weekly_cha_social_event', description: 'Show up to a social event this week', attribute: 'CHA', type: 'weekly', bonusXP: 150 },
];
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git add src/game/missions.ts src/game/__tests__/missions.test.ts
git commit -m "feat(game): add mission template list"
```

### Task F2: instanceIdFor and MissionInstance shape

**Files:**

- Modify: `src/game/missions.ts`
- Modify: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { instanceIdFor } from '@/game/missions';

describe('instanceIdFor', () => {
  it('joins templateId and ISO date with underscore', () => {
    expect(instanceIdFor('daily_con_cardio', '2026-05-08')).toBe(
      'daily_con_cardio_2026-05-08',
    );
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/missions.ts
import type { ISODate } from '@/game/calendar';

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
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add MissionInstance shape and instanceIdFor"
```

### Task F3: generateDailyMissions

Pick 3 templates targeting the user's three lowest-level attributes, ties broken by `ATTRIBUTES` order. If a target attribute has multiple daily templates, pick deterministically by hashing the date string into a template index — same date, same templates. If the user has never logged anything (all attribute levels 1, no other signal), the default attribute set is `['CON', 'INT', 'CHA']` (cardio + read + social per GAME_RULES default seed).

**Files:**

- Modify: `src/game/missions.ts`
- Modify: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { generateDailyMissions } from '@/game/missions';
import type { Attribute } from '@/game/constants';

const allLevel1 = (): Record<Attribute, number> => ({
  STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1,
});

describe('generateDailyMissions', () => {
  it('returns exactly 3 instances', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    expect(out).toHaveLength(3);
  });

  it('uses the default seed (CON, INT, CHA) when user has never logged', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    const attrs = out.map((m) => m.attribute);
    expect(new Set(attrs)).toEqual(new Set(['CON', 'INT', 'CHA']));
  });

  it('targets the three lowest-level attributes for an experienced user (ties broken by ATTRIBUTES order)', () => {
    // STR=5, DEX=2, CON=2, INT=4, WIS=2, CHA=3 → three lowest are DEX, CON, WIS (all 2)
    const out = generateDailyMissions({
      attributeLevels: { STR: 5, DEX: 2, CON: 2, INT: 4, WIS: 2, CHA: 3 },
      today: '2026-05-08',
      hasEverLogged: true,
    });
    const attrs = out.map((m) => m.attribute).sort();
    expect(attrs).toEqual(['CON', 'DEX', 'WIS']);
  });

  it('picks deterministic templates per date (same input → same instance ids)', () => {
    const a = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: true,
    });
    const b = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: true,
    });
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('produces unique instance ids and consistent generatedFor', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    expect(new Set(out.map((m) => m.id)).size).toBe(3);
    for (const m of out) {
      expect(m.generatedFor).toBe('2026-05-08');
      expect(m.type).toBe('daily');
    }
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/missions.ts
import { ATTRIBUTES } from '@/game/constants';

const DEFAULT_SEED_ATTRIBUTES: readonly Attribute[] = ['CON', 'INT', 'CHA'];

export interface GenerateDailyMissionsInput {
  attributeLevels: Record<Attribute, number>;
  today: ISODate;
  /** False on a fresh install with no logs yet → use default seed. */
  hasEverLogged: boolean;
}

export function generateDailyMissions(
  input: GenerateDailyMissionsInput,
): MissionInstance[] {
  const targets = input.hasEverLogged
    ? threeLowestAttributes(input.attributeLevels)
    : DEFAULT_SEED_ATTRIBUTES;

  return targets.map((attribute, idx) =>
    pickInstance(attribute, 'daily', input.today, idx),
  );
}

function threeLowestAttributes(levels: Record<Attribute, number>): Attribute[] {
  return [...ATTRIBUTES]
    .map((attribute, originalIndex) => ({ attribute, originalIndex, level: levels[attribute] }))
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
  const candidates = MISSION_TEMPLATES.filter(
    (t) => t.attribute === attribute && t.type === type,
  );
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
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add deterministic generateDailyMissions"
```

### Task F4: generateWeeklyQuest

Pick the lowest-level attribute over the trailing week, return one weekly instance with `generatedFor` set to the Monday of the current week.

**Files:**

- Modify: `src/game/missions.ts`
- Modify: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { generateWeeklyQuest, mondayOf } from '@/game/missions';

describe('mondayOf', () => {
  it('returns the input when input is a Monday', () => {
    expect(mondayOf('2026-05-04')).toBe('2026-05-04'); // 2026-05-04 is a Monday
  });
  it('returns the previous Monday for a Wednesday', () => {
    expect(mondayOf('2026-05-06')).toBe('2026-05-04');
  });
  it('returns the previous Monday for a Sunday', () => {
    expect(mondayOf('2026-05-10')).toBe('2026-05-04');
  });
});

describe('generateWeeklyQuest', () => {
  it('returns a single weekly instance generatedFor that Monday', () => {
    const quests = generateWeeklyQuest({
      attributeLevels: { STR: 5, DEX: 5, CON: 5, INT: 2, WIS: 5, CHA: 5 },
      today: '2026-05-08', // Friday → Monday is 05-04
    });
    expect(quests).toHaveLength(1);
    const q = quests[0]!;
    expect(q.type).toBe('weekly');
    expect(q.generatedFor).toBe('2026-05-04');
    expect(q.attribute).toBe('INT');
    expect(q.bonusXP).toBe(150);
  });

  it('breaks ties by ATTRIBUTES order (returns STR when STR and DEX both lowest)', () => {
    const quests = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 1, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-08',
    });
    expect(quests[0]!.attribute).toBe('STR');
  });

  it('produces a stable instance id for the same Monday', () => {
    const a = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 5, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-06',
    });
    const b = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 5, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-08',
    });
    expect(a[0]!.id).toBe(b[0]!.id);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/missions.ts.
// Update the existing calendar import at the top of missions.ts to include `addDays`:
//   import { addDays, type ISODate } from '@/game/calendar';

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

export function generateWeeklyQuest(
  input: GenerateWeeklyQuestInput,
): MissionInstance[] {
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
  let best: Attribute = ATTRIBUTES[0];
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
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add generateWeeklyQuest and mondayOf helper"
```

### Task F5: validateMatchedMissions

Per GAME_RULES, the AI returns `matchedMissions: string[]` of mission instance ids. The engine validates each ID exists in the active list, isn't already completed, and totals the bonus XP.

**Files:**

- Modify: `src/game/missions.ts`
- Modify: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { validateMatchedMissions } from '@/game/missions';
import type { MissionInstance } from '@/game/missions';

const dailyInst = (id: string, attribute: Attribute, bonusXP: number): MissionInstance => ({
  id, templateId: id, description: id, attribute, type: 'daily', bonusXP, generatedFor: '2026-05-08',
});

describe('validateMatchedMissions', () => {
  it('returns valid ids and summed bonus XP grouped by attribute', () => {
    const active: MissionInstance[] = [
      dailyInst('m1', 'STR', 50),
      dailyInst('m2', 'CON', 50),
      dailyInst('m3', 'INT', 50),
    ];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'm3'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.completedIds).toEqual(['m1', 'm3']);
    expect(result.bonusByAttribute).toEqual({ STR: 50, CON: 0, DEX: 0, INT: 50, WIS: 0, CHA: 0 });
  });

  it('drops unknown ids silently', () => {
    const active: MissionInstance[] = [dailyInst('m1', 'STR', 50)];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'unknown'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.completedIds).toEqual(['m1']);
    expect(result.unknownIds).toEqual(['unknown']);
  });

  it('drops already-completed ids', () => {
    const active: MissionInstance[] = [dailyInst('m1', 'STR', 50)];
    const result = validateMatchedMissions({
      matchedIds: ['m1'],
      activeMissions: active,
      completedIds: new Set(['m1']),
    });
    expect(result.completedIds).toEqual([]);
    expect(result.alreadyCompleted).toEqual(['m1']);
    expect(result.bonusByAttribute.STR).toBe(0);
  });

  it('sums bonuses when multiple matched missions target the same attribute', () => {
    const active: MissionInstance[] = [
      dailyInst('m1', 'STR', 50),
      { ...dailyInst('w1', 'STR', 150), type: 'weekly' },
    ];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'w1'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.bonusByAttribute.STR).toBe(200);
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/missions.ts

export interface ValidateMatchedMissionsInput {
  matchedIds: string[];
  activeMissions: MissionInstance[];
  completedIds: Set<string>;
}

export interface ValidateMatchedMissionsResult {
  /** Mission instance ids that should be marked completed. */
  completedIds: string[];
  /** Bonus XP per attribute, summed across newly-completed missions. */
  bonusByAttribute: Record<Attribute, number>;
  /** Ids the AI returned that aren't in the active list. */
  unknownIds: string[];
  /** Ids the AI returned that are already completed. */
  alreadyCompleted: string[];
}

export function validateMatchedMissions(
  input: ValidateMatchedMissionsInput,
): ValidateMatchedMissionsResult {
  const byId = new Map(input.activeMissions.map((m) => [m.id, m] as const));
  const completed: string[] = [];
  const unknown: string[] = [];
  const already: string[] = [];
  const bonus = ATTRIBUTES.reduce(
    (acc, a) => { acc[a] = 0; return acc; },
    {} as Record<Attribute, number>,
  );

  for (const id of input.matchedIds) {
    const mission = byId.get(id);
    if (!mission) { unknown.push(id); continue; }
    if (input.completedIds.has(id)) { already.push(id); continue; }
    completed.push(id);
    bonus[mission.attribute] += mission.bonusXP;
  }

  return { completedIds: completed, bonusByAttribute: bonus, unknownIds: unknown, alreadyCompleted: already };
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add validateMatchedMissions"
```

### Task F6: applyMissionBonus — bonus XP exempt from the daily cap

Per GAME_RULES §Mission matching: "Mission bonus XP does not count against the daily cap. It's applied as a separate bonus." This task adds the function that composes mission bonus XP into attribute states **without** clamping. The full log-submit pipeline is:

1. `validateLogResult(...)` → clamped `LogResult`
2. Per attribute: `applyImprovementBonus` + `applyStreakMultiplier` → final per-attribute AI XP
3. `applyLogXP({ states, requestedGains, alreadyEarnedToday })` → states after AI XP (cap applied), level-ups, `actuallyApplied`
4. `validateMatchedMissions(...)` → `bonusByAttribute`, completed mission ids
5. **`applyMissionBonus(statesAfterAIXP, bonusByAttribute)`** → final states + additional level-ups
6. Storage: write final states, add `actuallyApplied` (from step 3 only — never bonus) to `daily_xp_earned`

**Files:**

- Modify: `src/game/missions.ts`
- Modify: `src/game/__tests__/missions.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { applyMissionBonus } from '@/game/missions';
import type { AttributeStateLike } from '@/game/xp';

const evenStates = (level: number, inProgressXp: number) =>
  ATTRIBUTES.reduce(
    (acc, a) => { acc[a] = { level, inProgressXp }; return acc; },
    {} as Record<Attribute, AttributeStateLike>,
  );

const noBonus = (): Record<Attribute, number> =>
  ATTRIBUTES.reduce(
    (acc, a) => { acc[a] = 0; return acc; },
    {} as Record<Attribute, number>,
  );

describe('applyMissionBonus', () => {
  it('applies bonus XP without any cap clamping (can exceed 200/day on attribute)', () => {
    const states = evenStates(1, 0);
    const bonus = noBonus();
    bonus.STR = 200;
    const result = applyMissionBonus(states, bonus);
    // 200 → level 2 with 100 carry → 100 → level 3 with 0 carry. Wait: at level 2, threshold to reach 3 is 200.
    // 100 < 200, so stay at level 2 with 100 in-progress.
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 100 });
    expect(result.levelUps).toEqual([{ attribute: 'STR', newLevel: 2 }]);
  });

  it('returns identity when no attribute has bonus', () => {
    const states = evenStates(3, 50);
    const result = applyMissionBonus(states, noBonus());
    expect(result.newStates.STR).toEqual({ level: 3, inProgressXp: 50 });
    expect(result.levelUps).toEqual([]);
  });

  it('applies bonus across multiple attributes and reports level-ups in attribute order', () => {
    const states = evenStates(1, 80);
    const bonus = noBonus();
    bonus.STR = 30;
    bonus.INT = 25;
    const result = applyMissionBonus(states, bonus);
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 10 });
    expect(result.newStates.INT).toEqual({ level: 2, inProgressXp: 5 });
    // Level-ups iterate in ATTRIBUTES order: STR, DEX, CON, INT, WIS, CHA
    expect(result.levelUps).toEqual([
      { attribute: 'STR', newLevel: 2 },
      { attribute: 'INT', newLevel: 2 },
    ]);
  });

  it('produces double level-ups when bonus stacks high (e.g., daily + weekly on same attribute)', () => {
    // Per GAME_RULES §Per-log ceiling worst case: daily 50 + weekly 150 on same attribute = 200 bonus.
    const states = evenStates(1, 0);
    const bonus = noBonus();
    bonus.STR = 200; // 50 + 150
    const result = applyMissionBonus(states, bonus);
    // 200 from level 1 with 0 in-progress: → level 2 (carry 100). Threshold 2→3 = 200, 100 < 200, stop.
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 100 });
  });
});
```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

```typescript
// Append to src/game/missions.ts
import { applyXPGain, type AttributeStateLike, type LevelUp } from '@/game/xp';

export interface ApplyMissionBonusResult {
  newStates: Record<Attribute, AttributeStateLike>;
  levelUps: LevelUp[];
}

/**
 * Add mission bonus XP to attribute states. Bonus XP is exempt from the daily
 * cap per GAME_RULES §Mission matching, so this never clamps. Iterates
 * attributes in ATTRIBUTES order so level-up reports are deterministic.
 */
export function applyMissionBonus(
  states: Record<Attribute, AttributeStateLike>,
  bonusByAttribute: Record<Attribute, number>,
): ApplyMissionBonusResult {
  const newStates = {} as Record<Attribute, AttributeStateLike>;
  const levelUps: LevelUp[] = [];
  for (const attribute of ATTRIBUTES) {
    const bonus = bonusByAttribute[attribute] ?? 0;
    const before = states[attribute];
    const { state, levelUps: gained } = applyXPGain(before, bonus);
    newStates[attribute] = state;
    for (const newLevel of gained) {
      levelUps.push({ attribute, newLevel });
    }
  }
  return { newStates, levelUps };
}
```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(game): add applyMissionBonus (bonus XP exempt from cap)"
```

---

## Section G — Coverage gate and Phase 2 close-out

PR title: `chore(game): enforce 100% coverage on src/game and add coverage script`

### Task G1: Run full test suite and assert coverage

**Files:**

- Modify: `package.json` (add `test:coverage` script if missing)
- Modify: `jest.config.js` (or the `jest` block in `package.json`) — pin `collectCoverageFrom`

- [ ] **Step 1: Add `test:coverage` script if not already present**

Read `package.json`. If there is no `test:coverage` script, add it.

```json
{
  "scripts": {
    "test:coverage": "jest --coverage --coverageReporters=text --coverageReporters=html"
  }
}
```

- [ ] **Step 2: Add a `coverageThreshold` block that enforces 100% on `src/game/`**

The existing `jest.config.js` already pins `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**']`, which already includes every file under `src/game/`. **Do not narrow or replace `collectCoverageFrom`** — leave it as-is so coverage continues to be tracked across the rest of `src/`.

Only one change is needed: add a `coverageThreshold` block to the same config so Jest fails the run when any `src/game/` file falls below 100%. Without the threshold block, the coverage report is informational only and the gate is unenforced.

```js
// jest.config.js — add coverageThreshold; leave collectCoverageFrom untouched
module.exports = {
  // ...existing fields (preset, testEnvironment, testMatch, moduleNameMapper, collectCoverageFrom, testPathIgnorePatterns)...
  coverageThreshold: {
    './src/game/': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
```

The `'./src/game/'` key (with trailing slash) is Jest's directory-scope syntax: the threshold is enforced against the aggregated coverage of every file under that directory. Files outside `src/game/` are unaffected.

If the project later switches to `jest.config.ts` or a `jest` block in `package.json`, apply the same `coverageThreshold` field in the new location.

- [ ] **Step 3: Run coverage**

Run: `npm run test:coverage`

Expected: All tests pass. Coverage report at the end shows `src/game/calendar.ts`, `xp.ts`, `streak.ts`, `decay.ts`, `validation.ts`, `missions.ts` all at **100%** statements / branches / functions / lines. With the threshold pinned, Jest will fail the run (non-zero exit) if any file falls below 100% — that's the gate. If anything is below 100%, write the missing-line tests in that module's `__tests__` file and re-run.

- [ ] **Step 4: Verify the listed `GAME_RULES.md` edge cases all have explicit tests**

Cross-check this list against the test files. Each must have a named test:

- ✅ XP application with daily cap clamping (xp.test.ts)
- ✅ Level-up across single threshold (xp.test.ts)
- ✅ Level-up across multiple thresholds in one log (xp.test.ts)
- ✅ Streak increment on consecutive days (streak.test.ts)
- ✅ Streak reset after 2-day gap (streak.test.ts)
- ✅ Decay grace period (no decay days 1–2) (decay.test.ts via effectiveInactiveDays)
- ✅ Decay applied days 3+ (decay.test.ts)
- ✅ Decay never reduces level (decay.test.ts)
- ✅ Decay with pause periods (calendar.test.ts → nonPausedDaysBetween + decay.test.ts → effectiveInactiveDays)
- ✅ Decay over very long inactivity (90+ days) (decay.test.ts → "clamps in-progress XP at 0")
- ✅ Mission completion with bonus XP (missions.test.ts)
- ✅ Mission match validation against active missions (missions.test.ts)
- ✅ Improvement bonus multiplier (xp.test.ts)
- ✅ Streak multiplier at each tier (streak.test.ts)

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: zero warnings, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add package.json jest.config.js
git commit -m "chore(game): add coverage script, pin collectCoverageFrom, confirm 100% on src/game"
```

### Task G2: Update PHASES.md to mark Phase 2 done

**Files:**

- Modify: `docs/PHASES.md`

- [ ] **Step 1: Add a "Status" annotation under the Phase 2 heading**

Open `docs/PHASES.md`. Under `## Phase 2 — Game Engine` add immediately after the "Goal" line:

```markdown
**Status:** Complete (2026-05-08). 100% coverage on `src/game/`. All edge cases listed below have explicit tests.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PHASES.md
git commit -m "docs(phases): mark Phase 2 complete"
```

---

## Acceptance — Phase 2 close-out checklist

Before closing this plan and proceeding to Phase 3:

- [ ] `npm test` passes with 0 failures
- [ ] `npm run test:coverage` reports 100% statement/branch/function/line coverage on `src/game/`
- [ ] `npm run lint` reports 0 warnings/errors
- [ ] `npm run typecheck` reports 0 errors
- [ ] No file under `src/game/` imports from `react`, `react-native`, `expo-*`, `@/state/*`, or `@/storage/*`
- [ ] All 14 named edge cases from `docs/PHASES.md` §Phase 2 have a test that explicitly references them in the test name
- [ ] `docs/PHASES.md` is updated to mark Phase 2 done

When all boxes are checked, Phase 2 is shipped. Phase 3 (UI with mock AI) builds on this engine.
