# Phase 4 — Animations & Haptics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five animation moments (XP gain reveal, bar fill, level-up overlay, decay shimmer, streak milestones) plus haptics on key interactions, all respecting the system reduce-motion setting.

**Architecture:** Reanimated 4 only (no Moti). A single `<AnimationOrchestrator>` mounted at the root reads `logsStore.lastSubmitResult` and sequences a queue of overlay components. Each overlay is a focused, pure-presentational component with one job and a clear `onComplete` contract. Reduced-motion users see the same content with instant transitions.

**Tech Stack:** TypeScript (strict), `react-native-reanimated` 4, `expo-haptics`, React Native `AccessibilityInfo`, Zustand. Jest (node env) for pure logic and the new state plumbing; RNTL (`jest-expo` preset) for hooks and components.

**Spec:** `docs/superpowers/specs/2026-05-10-phase-4-animations-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `src/game/streakMilestone.ts` | New | `crossedStreakMilestone(prev, next)` + `streakMultiplierAt(threshold)` |
| `src/game/__tests__/streakMilestone.test.ts` | New | Unit tests, 100% coverage |
| `jest.config.js` | Modify | Add `streakMilestone.ts` 100% coverage threshold |
| `src/state/hooks/useReducedMotion.ts` | New | Subscribe to `AccessibilityInfo` `reduceMotionChanged` |
| `src/state/hooks/__tests__/useReducedMotion.test.tsx` | New | RNTL hook test |
| `src/lib/haptics.ts` | New | `tap`/`submit`/`levelUp`/`success` wrappers |
| `src/state/submitLog.ts` | Modify | Add `gains`, `prevStreak`, `newStreak` to success result |
| `src/state/__tests__/submitLog.test.ts` | Modify | Add assertions for the new return fields |
| `src/state/logsStore.ts` | Modify | Add `lastSubmitResult` + `clearLastSubmitResult`; fire `haptics.submit` |
| `src/ui/screens/CharacterSheetScreen.tsx` | Modify | `haptics.tap()` on FAB press (only when AI available) |
| `src/ui/screens/LogEntryScreen.tsx` | Modify | `haptics.tap()` on submit press |
| `jest.setup.ui.js` | Modify | Mock `react-native-reanimated` |
| `src/ui/components/AttributeBar.tsx` | Modify | Animate fill via Reanimated; shimmer when decayedToday |
| `src/ui/components/__tests__/AttributeBar.test.tsx` | New | Renders, fill width, shimmer presence |
| `src/ui/components/StreakIndicator.tsx` | Modify | Pulse on `streakDays` change |
| `src/ui/components/__tests__/StreakIndicator.test.tsx` | New | Renders, pulse triggers |
| `src/ui/components/XPGainReveal.tsx` | New | Floating "+N" floats per attribute |
| `src/ui/components/__tests__/XPGainReveal.test.tsx` | New | Renders right count, fires onComplete |
| `src/ui/components/LevelUpOverlay.tsx` | New | Full-screen burst, ~1.5s |
| `src/ui/components/__tests__/LevelUpOverlay.test.tsx` | New | Tests + haptic |
| `src/ui/components/MissionCompletionToast.tsx` | New | Top toast, ~1.2s |
| `src/ui/components/__tests__/MissionCompletionToast.test.tsx` | New | Tests + haptic |
| `src/ui/components/StreakMilestoneOverlay.tsx` | New | 🔥 + "N-day streak!" overlay |
| `src/ui/components/__tests__/StreakMilestoneOverlay.test.tsx` | New | Tests + haptic |
| `src/ui/components/AnimationOrchestrator.tsx` | New | Sequencer; reads `lastSubmitResult` |
| `src/ui/components/__tests__/AnimationOrchestrator.test.tsx` | New | Queue building, advance, multi-submit append |
| `app/_layout.tsx` | Modify | Mount `<AnimationOrchestrator />` |

---

## Task 1: Pure `crossedStreakMilestone` + `streakMultiplierAt`

**Files:**
- Create: `src/game/streakMilestone.ts`
- Create: `src/game/__tests__/streakMilestone.test.ts`
- Modify: `jest.config.js` — add 100% coverage threshold

- [ ] **Step 1.1: Write failing tests**

```typescript
// src/game/__tests__/streakMilestone.test.ts
import {
  crossedStreakMilestone,
  streakMultiplierAt,
} from '@/game/streakMilestone';

describe('crossedStreakMilestone', () => {
  it('returns null when no threshold is crossed', () => {
    expect(crossedStreakMilestone(0, 1)).toBeNull();
    expect(crossedStreakMilestone(0, 0)).toBeNull();
    expect(crossedStreakMilestone(7, 8)).toBeNull();
    expect(crossedStreakMilestone(7, 7)).toBeNull();
    expect(crossedStreakMilestone(30, 31)).toBeNull();
    expect(crossedStreakMilestone(30, 100)).toBeNull();
  });

  it('returns 3 when crossing the 3-day threshold', () => {
    expect(crossedStreakMilestone(2, 3)).toBe(3);
    expect(crossedStreakMilestone(2, 4)).toBe(3);
    expect(crossedStreakMilestone(2, 6)).toBe(3);
    expect(crossedStreakMilestone(0, 3)).toBe(3);
  });

  it('returns 7 when crossing the 7-day threshold', () => {
    expect(crossedStreakMilestone(6, 7)).toBe(7);
    expect(crossedStreakMilestone(2, 7)).toBe(7);
    expect(crossedStreakMilestone(2, 8)).toBe(7);
    expect(crossedStreakMilestone(2, 29)).toBe(7);
  });

  it('returns 30 when crossing the 30-day threshold', () => {
    expect(crossedStreakMilestone(29, 30)).toBe(30);
    expect(crossedStreakMilestone(2, 30)).toBe(30);
    expect(crossedStreakMilestone(2, 100)).toBe(30);
  });
});

describe('streakMultiplierAt', () => {
  it('returns the GAME_RULES multipliers for each threshold', () => {
    expect(streakMultiplierAt(3)).toBe(1.05);
    expect(streakMultiplierAt(7)).toBe(1.2);
    expect(streakMultiplierAt(30)).toBe(1.2);
  });
});
```

- [ ] **Step 1.2: Run tests, verify failure**

Run: `npm test -- --testPathPattern=streakMilestone`
Expected: FAIL with `Cannot find module '@/game/streakMilestone'`.

- [ ] **Step 1.3: Implement**

Create `src/game/streakMilestone.ts`:

```typescript
/**
 * Returns the highest streak milestone threshold the user crossed in this
 * submission, or null if no milestone was crossed.
 *
 * "Crossed" means: prev was strictly below the threshold, and next is at or
 * above the threshold. Sitting at a milestone (e.g., 7 → 8) returns null.
 */
export type StreakMilestone = 3 | 7 | 30;

export function crossedStreakMilestone(prev: number, next: number): StreakMilestone | null {
  for (const threshold of [30, 7, 3] as const) {
    if (prev < threshold && next >= threshold) return threshold;
  }
  return null;
}

/**
 * Streak multiplier at a given milestone. Mirrors the tiers in
 * `STREAK_MULTIPLIER_TIERS` (game/constants) — both the 7 and 30 tiers cap at
 * 1.20×, since GAME_RULES.md does not introduce a higher tier above 7.
 */
export function streakMultiplierAt(threshold: StreakMilestone): number {
  if (threshold === 3) return 1.05;
  return 1.2;
}
```

- [ ] **Step 1.4: Run tests, verify pass**

Run: `npm test -- --testPathPattern=streakMilestone`
Expected: 4 test cases pass (3 in `crossedStreakMilestone`, 1 in `streakMultiplierAt`). Total: 4 passed.

- [ ] **Step 1.5: Add 100% coverage threshold**

Edit `jest.config.js`. Find the existing `coverageThreshold` block. Add this entry alongside the existing 100% targets (e.g., adjacent to `'./src/lib/clock.ts'`):

```javascript
'./src/game/streakMilestone.ts': {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
},
```

- [ ] **Step 1.6: Verify 100% coverage**

Run: `npm test -- --coverage --collectCoverageFrom='src/game/streakMilestone.ts'`
Expected: `streakMilestone.ts | 100 | 100 | 100 | 100 |`.

- [ ] **Step 1.7: Commit**

```bash
git add src/game/streakMilestone.ts src/game/__tests__/streakMilestone.test.ts jest.config.js
git commit -m "feat(game): add crossedStreakMilestone + streakMultiplierAt"
```

---

## Task 2: `useReducedMotion` hook

**Files:**
- Create: `src/state/hooks/useReducedMotion.ts`
- Create: `src/state/hooks/__tests__/useReducedMotion.test.tsx`

- [ ] **Step 2.1: Write failing test**

```typescript
// src/state/hooks/__tests__/useReducedMotion.test.tsx
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockIsReduceMotionEnabled = jest.fn().mockResolvedValue(false);
const mockRemove = jest.fn();
const mockAddEventListener = jest.fn().mockReturnValue({ remove: mockRemove });

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    AccessibilityInfo: {
      ...actual.AccessibilityInfo,
      isReduceMotionEnabled: () => mockIsReduceMotionEnabled(),
      addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
    },
  };
});

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
  const v = useReducedMotion();
  onValue(v);
  return <Text testID="probe">{String(v)}</Text>;
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    mockIsReduceMotionEnabled.mockClear();
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
  });

  it('initializes with the resolved value of isReduceMotionEnabled', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    let last = false;
    render(<Probe onValue={(v) => { last = v; }} />);
    await act(async () => {});
    expect(last).toBe(true);
  });

  it('subscribes to reduceMotionChanged on mount', () => {
    render(<Probe onValue={() => {}} />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener.mock.calls[0]?.[0]).toBe('reduceMotionChanged');
    expect(typeof mockAddEventListener.mock.calls[0]?.[1]).toBe('function');
  });

  it('updates on reduceMotionChanged events', async () => {
    let last = false;
    render(<Probe onValue={(v) => { last = v; }} />);
    await act(async () => {});
    const handler = mockAddEventListener.mock.calls[0]?.[1] as (v: boolean) => void;
    await act(async () => {
      handler(true);
    });
    expect(last).toBe(true);
  });

  it('removes the listener on unmount', () => {
    const view = render(<Probe onValue={() => {}} />);
    view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.2: Run test, verify failure**

Run: `npm run test:ui -- --testPathPattern=useReducedMotion`
Expected: FAIL with `Cannot find module '@/state/hooks/useReducedMotion'`.

- [ ] **Step 2.3: Implement**

Create `src/state/hooks/useReducedMotion.ts`:

```typescript
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Subscribes to the system reduce-motion accessibility setting. Initial value
 * is resolved asynchronously, so first render returns `false` then updates
 * once the OS responds. Subsequent OS-level changes (e.g., user toggles the
 * setting in Settings while the app is foregrounded) propagate via the
 * `reduceMotionChanged` event.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
```

- [ ] **Step 2.4: Run test, verify pass**

Run: `npm run test:ui -- --testPathPattern=useReducedMotion`
Expected: 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/state/hooks/useReducedMotion.ts src/state/hooks/__tests__/useReducedMotion.test.tsx
git commit -m "feat(state): add useReducedMotion hook"
```

---

## Task 3: `lib/haptics.ts` wrapper

**Files:**
- Create: `src/lib/haptics.ts`

No dedicated test file. The wrapper is exercised by every component that calls `haptics.*` — those tests assert the underlying `expo-haptics` API was called with the right intensity.

- [ ] **Step 3.1: Implement**

Create `src/lib/haptics.ts`:

```typescript
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<void>): void {
  if (!isHapticPlatform) return;
  void fn().catch(() => {
    // Haptics failures are silent — the user's experience is the haptic itself,
    // and a missing haptic should never throw an error to higher layers.
  });
}

/**
 * Small surface for the four haptic moments the app uses. Each call is
 * fire-and-forget — the wrapper never throws, and platforms that don't
 * support haptics (web, future platforms) are no-ops.
 */
export const haptics = {
  /** Light tap — FAB press, button presses. */
  tap: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium impact — log submit success. */
  submit: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Heavy impact — level-up moment. */
  levelUp: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Success notification — mission completion, streak milestone. */
  success: (): void => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
```

- [ ] **Step 3.2: Verify typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/haptics.ts
git commit -m "feat(lib): add haptics wrapper for tap/submit/levelUp/success"
```

---

## Task 4: Extend `submitLog` return with `gains`, `prevStreak`, `newStreak`

**Files:**
- Modify: `src/state/submitLog.ts`
- Modify: `src/state/__tests__/submitLog.test.ts`

- [ ] **Step 4.1: Read current `submitLog.test.ts` so you know its existing structure**

Use the Read tool. The file has a `describe('submitLog', ...)` with several success-path tests using `freshDriver()` and seeded character/missions. You'll add assertions inside one or two of those existing tests rather than writing new test files.

- [ ] **Step 4.2: Update `SubmitLogResult` type and the success return**

In `src/state/submitLog.ts`:

1. Add an import for `Attribute` if not already imported (it is — line 3 imports `ATTRIBUTES, type Attribute`).
2. Replace the `SubmitLogResult` type definition (currently `src/state/submitLog.ts:27-34`) with:

```typescript
export type SubmitLogResult =
  | {
      ok: true;
      gains: Partial<Record<Attribute, number>>;
      levelUps: LevelUp[];
      missionCompletions: string[];
      prevStreak: number;
      newStreak: number;
    }
  | {
      ok: false;
      reason: 'low-confidence' | 'invalid-primary' | 'aborted' | 'storage-error' | 'unknown';
      detail?: string;
    };
```

3. At the bottom of `submitLog`, replace the existing success return (currently `return { ok: true, levelUps: [...levelUps, ...bonusLevelUps], missionCompletions: completedIds };`) with:

```typescript
// Build sparse gains map: only include attributes that gained > 0 XP.
const gains: Partial<Record<Attribute, number>> = {};
for (const attr of ATTRIBUTES) {
  const v = actuallyApplied[attr];
  if (v > 0) gains[attr] = v;
}

return {
  ok: true,
  gains,
  levelUps: [...levelUps, ...bonusLevelUps],
  missionCompletions: completedIds,
  prevStreak: streak.currentLength,
  newStreak,
};
```

- [ ] **Step 4.3: Add assertions to existing tests**

Open `src/state/__tests__/submitLog.test.ts`. Find an existing success-path test that exercises a clean log submission (no level-up). Add assertions:

```typescript
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.prevStreak).toBeGreaterThanOrEqual(0);
  expect(result.newStreak).toBeGreaterThanOrEqual(result.prevStreak);
  expect(typeof result.gains).toBe('object');
  // gains must only contain attributes with non-zero deposits
  for (const value of Object.values(result.gains)) {
    expect(value).toBeGreaterThan(0);
  }
}
```

If a level-up test exists, add:

```typescript
if (result.ok) {
  // gains map must include an entry for the leveled attribute (since gain was non-zero)
  for (const lu of result.levelUps) {
    expect(result.gains[lu.attribute]).toBeGreaterThan(0);
  }
}
```

- [ ] **Step 4.4: Run tests**

Run: `npm test -- --testPathPattern=submitLog`
Expected: all existing assertions still pass; new assertions pass.

- [ ] **Step 4.5: Run full node test suite**

Run: `npm test`
Expected: all suites pass; total = previous total + any new tests added.

- [ ] **Step 4.6: Commit**

```bash
git add src/state/submitLog.ts src/state/__tests__/submitLog.test.ts
git commit -m "feat(state): add gains, prevStreak, newStreak to submitLog result"
```

---

## Task 5: Extend `logsStore` with `lastSubmitResult` + fire `haptics.submit`

**Files:**
- Modify: `src/state/logsStore.ts`

- [ ] **Step 5.1: Update `LogsStoreState` interface and the success path**

Replace the contents of `src/state/logsStore.ts` with:

```typescript
import { create } from 'zustand';
import { getAIService } from '@/ai/aiServiceFactory';
import type { Attribute } from '@/game/constants';
import type { LevelUp } from '@/game/xp';
import { todayLocalISODate } from '@/lib/clock';
import { haptics } from '@/lib/haptics';
import * as logRepo from '@/storage/repositories/logRepo';
import type { LogEntry } from '@/storage/repositories/logRepo';
import { getDb } from '@/storage/db';
import { useCharacterStore } from '@/state/characterStore';
import { useMissionsStore } from '@/state/missionsStore';
import { submitLog as submitLogFn } from '@/state/submitLog';

export interface LastSubmitResult {
  gains: Partial<Record<Attribute, number>>;
  levelUps: LevelUp[];
  missionCompletions: string[];
  prevStreak: number;
  newStreak: number;
}

export interface LogsStoreState {
  logs: LogEntry[];
  submitting: boolean;
  lastResultSummary: string | null;
  lowConfidence: boolean;
  error: 'storage-error' | 'unknown' | null;
  errorDetail: string | null;
  lastSubmitResult: LastSubmitResult | null;

  hydrate: () => Promise<void>;
  submitLog: (text: string) => Promise<void>;
  cancelSubmit: () => void;
  clearLastSubmitResult: () => void;
}

interface InternalLogsStoreState extends LogsStoreState {
  _abortController: AbortController | null;
}

export const useLogsStore = create<LogsStoreState>((set, get) => {
  const internalSet = set as (
    partial:
      | Partial<InternalLogsStoreState>
      | ((state: InternalLogsStoreState) => Partial<InternalLogsStoreState>),
  ) => void;
  const internalGet = get as () => InternalLogsStoreState;

  const initial: InternalLogsStoreState = {
    logs: [],
    submitting: false,
    lastResultSummary: null,
    lowConfidence: false,
    error: null,
    errorDetail: null,
    lastSubmitResult: null,
    _abortController: null,

    hydrate: async () => {
      const db = await getDb();
      const logs = await logRepo.getRecentLogs(db, 50, 0);
      internalSet({ logs });
    },

    submitLog: async (text) => {
      const controller = new AbortController();
      internalSet({
        _abortController: controller,
        submitting: true,
        error: null,
        errorDetail: null,
        lowConfidence: false,
      });

      const db = await getDb();
      const today = todayLocalISODate();
      const aiService = getAIService();

      const result = await submitLogFn(text, {
        aiService,
        db,
        today,
        signal: controller.signal,
      });

      if (result.ok) {
        await useCharacterStore.getState().hydrate();
        await useMissionsStore.getState().generateForToday();
        await internalGet().hydrate();
        internalSet({
          submitting: false,
          lastResultSummary: null,
          lastSubmitResult: {
            gains: result.gains,
            levelUps: result.levelUps,
            missionCompletions: result.missionCompletions,
            prevStreak: result.prevStreak,
            newStreak: result.newStreak,
          },
          _abortController: null,
        });
        haptics.submit();
        return;
      }

      const detail = 'detail' in result ? (result.detail ?? null) : null;
      switch (result.reason) {
        case 'low-confidence':
          internalSet({ submitting: false, lowConfidence: true, _abortController: null });
          break;
        case 'aborted':
          internalSet({ submitting: false, _abortController: null });
          break;
        case 'storage-error':
          internalSet({
            submitting: false,
            error: 'storage-error',
            errorDetail: detail,
            _abortController: null,
          });
          break;
        case 'invalid-primary':
        case 'unknown':
        default:
          internalSet({
            submitting: false,
            error: 'unknown',
            errorDetail: detail,
            _abortController: null,
          });
          break;
      }
    },

    cancelSubmit: () => {
      internalGet()._abortController?.abort();
    },

    clearLastSubmitResult: () => {
      internalSet({ lastSubmitResult: null });
    },
  };

  return initial;
});
```

- [ ] **Step 5.2: Verify typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5.3: Run all node tests**

Run: `npm test`
Expected: all pass — `submitLog.test.ts` exercises the success path indirectly via state mocks; this change only adds fields without removing any.

- [ ] **Step 5.4: Run all UI tests**

Run: `npm run test:ui`
Expected: all pass — existing screen tests don't reach into `lastSubmitResult`.

- [ ] **Step 5.5: Commit**

```bash
git add src/state/logsStore.ts
git commit -m "feat(state): add lastSubmitResult to logsStore and fire haptics.submit"
```

---

## Task 6: Wire `haptics.tap()` on FAB and submit button presses

**Files:**
- Modify: `src/ui/screens/CharacterSheetScreen.tsx`
- Modify: `src/ui/screens/LogEntryScreen.tsx`
- Modify: `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`
- Modify: `src/ui/screens/__tests__/LogEntryScreen.test.tsx`

- [ ] **Step 6.1: Add haptics import to CharacterSheetScreen**

In `src/ui/screens/CharacterSheetScreen.tsx`, alongside existing imports:

```typescript
import { haptics } from '@/lib/haptics';
```

Update the FAB onPress (currently the block starting near `src/ui/screens/CharacterSheetScreen.tsx:124`):

```tsx
onPress={() => {
  if (!aiAvailable) {
    void Linking.openSettings();
    return;
  }
  haptics.tap();
  router.push('/(main)/log');
}}
```

The disabled-FAB path does NOT fire haptics — opening Settings is its own affordance.

- [ ] **Step 6.2: Add haptics import to LogEntryScreen**

In `src/ui/screens/LogEntryScreen.tsx`, alongside existing imports:

```typescript
import { haptics } from '@/lib/haptics';
```

Update `handleSubmit`:

```typescript
const handleSubmit = () => {
  if (submitDisabled) return;
  haptics.tap();
  void submitLog(text);
};
```

- [ ] **Step 6.3: Mock `expo-haptics` in `CharacterSheetScreen.test.tsx`**

At the top of `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`, alongside existing `jest.mock` blocks:

```typescript
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
```

Add a test inside the existing `describe('CharacterSheetScreen', ...)`:

```typescript
describe('FAB haptics', () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    mockAvailabilityState = { available: true, displayName: 'Mock (development)' };
  });

  it('fires a light impact on FAB press when AI is available', () => {
    const { getByTestId } = render(<CharacterSheetScreen />);
    fireEvent.press(getByTestId('fab-log'));
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('does NOT fire haptics on disabled FAB press', () => {
    mockAvailabilityState = { available: false, displayName: 'Mock (development)' };
    const { getByTestId } = render(<CharacterSheetScreen />);
    fireEvent.press(getByTestId('fab-log'));
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.4: Mock `expo-haptics` in `LogEntryScreen.test.tsx`**

At the top of `src/ui/screens/__tests__/LogEntryScreen.test.tsx`, alongside existing `jest.mock` blocks:

```typescript
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
```

Add a test inside the existing `describe('LogEntryScreen', ...)`:

```typescript
describe('submit haptics', () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
  });

  it('fires a light impact when Submit is pressed with non-empty text', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'ran 5km');
    fireEvent.press(getByTestId('log-submit'));
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('does not fire haptics when Submit is disabled', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.press(getByTestId('log-submit'));
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.5: Run UI tests**

Run: `npm run test:ui -- --testPathPattern='CharacterSheetScreen|LogEntryScreen'`
Expected: all tests pass.

- [ ] **Step 6.6: Commit**

```bash
git add src/ui/screens/CharacterSheetScreen.tsx src/ui/screens/LogEntryScreen.tsx src/ui/screens/__tests__/CharacterSheetScreen.test.tsx src/ui/screens/__tests__/LogEntryScreen.test.tsx
git commit -m "feat(ui): fire haptics.tap on FAB press and submit press"
```

---

## Task 7: Mock Reanimated for jest-expo tests

**Files:**
- Modify: `jest.setup.ui.js`

Reanimated 4 ships its own jest mock that replaces the native worklet runtime with deterministic JS implementations. Without this mock, components that use `useSharedValue` or `withTiming` will fail to render under jest-expo. This task lays the groundwork for Tasks 8-15.

- [ ] **Step 7.1: Add the reanimated mock**

In `jest.setup.ui.js`, append at the bottom:

```javascript
require('react-native-reanimated').setUpTests();
```

If your installed Reanimated version doesn't ship `setUpTests`, fall back to the older mock:

```javascript
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line global-require
  require('react-native-reanimated/mock'),
);
```

To check which is correct: run `node -e "console.log(typeof require('react-native-reanimated').setUpTests)"` from the project root. If it prints `function`, use the first form. Otherwise use the mock-import form.

- [ ] **Step 7.2: Run all UI tests**

Run: `npm run test:ui`
Expected: all existing tests still pass — the mock doesn't change behavior for non-Reanimated components.

- [ ] **Step 7.3: Commit**

```bash
git add jest.setup.ui.js
git commit -m "test(ui): set up Reanimated jest mock for animation tests"
```

---

## Task 8: Animate `<AttributeBar>` fill via Reanimated

**Files:**
- Modify: `src/ui/components/AttributeBar.tsx`
- Create: `src/ui/components/__tests__/AttributeBar.test.tsx`

- [ ] **Step 8.1: Write failing tests**

Create `src/ui/components/__tests__/AttributeBar.test.tsx`:

```typescript
import { render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { AttributeBar } from '@/ui/components/AttributeBar';

describe('AttributeBar', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders the attribute label and level', () => {
    const { getByText } = render(
      <AttributeBar attribute="STR" level={3} inProgressXp={50} xpThreshold={100} />,
    );
    expect(getByText('STR')).toBeTruthy();
    expect(getByText('Lv 3')).toBeTruthy();
  });

  it('exposes a fill testID', () => {
    const { getByTestId } = render(
      <AttributeBar attribute="DEX" level={2} inProgressXp={30} xpThreshold={100} />,
    );
    expect(getByTestId('attribute-bar-fill-DEX')).toBeTruthy();
  });

  it('renders the shimmer overlay when decayedToday is true', () => {
    const { getByTestId } = render(
      <AttributeBar
        attribute="CON"
        level={4}
        inProgressXp={20}
        xpThreshold={100}
        decayedToday
      />,
    );
    expect(getByTestId('attribute-bar-shimmer-CON')).toBeTruthy();
  });

  it('does not render the shimmer overlay when decayedToday is false', () => {
    const { queryByTestId } = render(
      <AttributeBar attribute="CON" level={4} inProgressXp={20} xpThreshold={100} />,
    );
    expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
  });

  it('skips shimmer animation when reduced motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { getByTestId } = render(
      <AttributeBar
        attribute="INT"
        level={1}
        inProgressXp={10}
        xpThreshold={100}
        decayedToday
      />,
    );
    // With reduced motion, the shimmer testID is still present but its animated transform is static.
    expect(getByTestId('attribute-bar-shimmer-INT')).toBeTruthy();
  });
});
```

- [ ] **Step 8.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=AttributeBar`
Expected: FAIL — `attribute-bar-shimmer-*` testIDs not found.

- [ ] **Step 8.3: Implement the animated bar fill + shimmer overlay**

Replace `src/ui/components/AttributeBar.tsx` with:

```tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
  /** XP needed to reach the next level. Caller computes via `xpToReachLevel(level + 1)`. */
  xpThreshold: number;
  /**
   * When true, render a shimmer overlay that loops a soft white gradient across
   * the bar to indicate decay applied earlier today.
   */
  decayedToday?: boolean;
}

const FILL_ANIMATION_MS = 600;
const SHIMMER_LOOP_MS = 2500;

export function AttributeBar({
  attribute,
  level,
  inProgressXp,
  xpThreshold,
  decayedToday = false,
}: AttributeBarProps) {
  const reducedMotion = useReducedMotion();

  const safeThreshold = xpThreshold > 0 ? xpThreshold : 1;
  const targetProgress = Math.min(Math.max(inProgressXp, 0) / safeThreshold, 1);
  const fillColor = ATTRIBUTE_COLORS[attribute];

  // Bar fill — animates width on `targetProgress` change.
  const progress = useSharedValue(targetProgress);
  useEffect(() => {
    if (reducedMotion) {
      progress.value = targetProgress;
      return;
    }
    progress.value = withTiming(targetProgress, {
      duration: FILL_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetProgress, reducedMotion, progress]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Shimmer — only animates when decayedToday and reduced-motion is off.
  const shimmerOffset = useSharedValue(0);
  useEffect(() => {
    if (!decayedToday || reducedMotion) {
      shimmerOffset.value = 0;
      return;
    }
    shimmerOffset.value = 0;
    shimmerOffset.value = withRepeat(
      withTiming(1, { duration: SHIMMER_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [decayedToday, reducedMotion, shimmerOffset]);

  const animatedShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmerOffset.value * 100}%` }],
  }));

  return (
    <View testID={`attribute-bar-${attribute}`} className="w-full">
      <View className="flex-row items-center justify-between">
        <Text className="font-manrope-semibold text-text" style={{ fontSize: 14 }}>
          {attribute}
        </Text>
        <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
          {`Lv ${level}`}
        </Text>
      </View>
      <View
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: safeThreshold,
          now: Math.min(inProgressXp, safeThreshold),
        }}
      >
        <Animated.View
          testID={`attribute-bar-fill-${attribute}`}
          className="h-full rounded-full"
          style={[
            {
              backgroundColor: fillColor,
              opacity: decayedToday ? 0.6 : 1,
            },
            animatedFillStyle,
          ]}
        />
        {decayedToday ? (
          <Animated.View
            testID={`attribute-bar-shimmer-${attribute}`}
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: '-50%',
                width: '50%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.25)',
              },
              animatedShimmerStyle,
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 8.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=AttributeBar`
Expected: 5 tests pass.

- [ ] **Step 8.5: Run all UI tests**

Run: `npm run test:ui`
Expected: all suites pass — existing screen tests that render AttributeBar (CharacterSheetScreen) still pass.

- [ ] **Step 8.6: Commit**

```bash
git add src/ui/components/AttributeBar.tsx src/ui/components/__tests__/AttributeBar.test.tsx
git commit -m "feat(ui): animate AttributeBar fill and add decay shimmer"
```

---

## Task 9: Animate `<StreakIndicator>` pulse on streak change

**Files:**
- Modify: `src/ui/components/StreakIndicator.tsx`
- Create: `src/ui/components/__tests__/StreakIndicator.test.tsx`

- [ ] **Step 9.1: Write failing tests**

Create `src/ui/components/__tests__/StreakIndicator.test.tsx`:

```typescript
import { render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { StreakIndicator } from '@/ui/components/StreakIndicator';

describe('StreakIndicator', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders nothing when streakDays is 0', () => {
    const { queryByTestId } = render(<StreakIndicator streakDays={0} />);
    expect(queryByTestId('streak-indicator')).toBeNull();
  });

  it('renders the flame and label when streakDays > 0', () => {
    const { getByTestId, getByText } = render(<StreakIndicator streakDays={5} />);
    expect(getByTestId('streak-indicator')).toBeTruthy();
    expect(getByText('5 days')).toBeTruthy();
  });

  it('uses the singular form for streakDays === 1', () => {
    const { getByText } = render(<StreakIndicator streakDays={1} />);
    expect(getByText('1 day')).toBeTruthy();
  });

  it('still renders content when reduced motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { getByText } = render(<StreakIndicator streakDays={3} />);
    expect(getByText('3 days')).toBeTruthy();
  });
});
```

- [ ] **Step 9.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=StreakIndicator`
Expected: FAIL — `useReducedMotion` import not consumed by component yet (the test imports the component which doesn't yet use the hook). The actual failure depends on test layering; capture it.

- [ ] **Step 9.3: Implement**

Replace `src/ui/components/StreakIndicator.tsx`:

```tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface StreakIndicatorProps {
  streakDays: number;
}

const PULSE_HALF_MS = 90;

/**
 * Tiny presentational streak indicator: flame emoji + day count. The flame
 * pulses (scale 1 → 1.2 → 1) whenever `streakDays` changes — gives the user
 * a small confirmation moment when their streak ticks over. Returns `null`
 * when `streakDays` is 0 so callers don't have to gate it.
 */
export function StreakIndicator({ streakDays }: StreakIndicatorProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(1.2, { duration: PULSE_HALF_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.in(Easing.cubic) }),
    );
  }, [streakDays, reducedMotion, scale]);

  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (streakDays === 0) {
    return null;
  }

  const label = `${streakDays} day${streakDays !== 1 ? 's' : ''}`;

  return (
    <View testID="streak-indicator" className="flex-row items-center gap-1">
      <Animated.Text style={[{ fontSize: 14 }, animatedFlameStyle]}>{'\u{1F525}'}</Animated.Text>
      <Text className="font-manrope-medium text-text" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 9.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=StreakIndicator`
Expected: 4 tests pass.

- [ ] **Step 9.5: Run all UI tests**

Run: `npm run test:ui`
Expected: all suites pass.

- [ ] **Step 9.6: Commit**

```bash
git add src/ui/components/StreakIndicator.tsx src/ui/components/__tests__/StreakIndicator.test.tsx
git commit -m "feat(ui): pulse StreakIndicator flame on streakDays change"
```

---

## Task 10: `<XPGainReveal>` floating numbers

**Files:**
- Create: `src/ui/components/XPGainReveal.tsx`
- Create: `src/ui/components/__tests__/XPGainReveal.test.tsx`

- [ ] **Step 10.1: Write failing tests**

```typescript
// src/ui/components/__tests__/XPGainReveal.test.tsx
import { act, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { XPGainReveal } from '@/ui/components/XPGainReveal';

describe('XPGainReveal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    jest.useRealTimers();
  });

  it('renders one entry per non-zero gain', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <XPGainReveal gains={{ STR: 30, CON: 15 }} onComplete={onComplete} />,
    );
    expect(getByTestId('xp-reveal-STR').props.children).toBe('+30');
    expect(getByTestId('xp-reveal-CON').props.children).toBe('+15');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<XPGainReveal gains={{ STR: 10 }} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips render and fires onComplete when reduced motion is on', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    const { queryByTestId } = render(
      <XPGainReveal gains={{ STR: 10 }} onComplete={onComplete} />,
    );
    expect(queryByTestId('xp-reveal-STR')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 10.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=XPGainReveal`
Expected: FAIL with `Cannot find module '@/ui/components/XPGainReveal'`.

- [ ] **Step 10.3: Implement**

Create `src/ui/components/XPGainReveal.tsx`:

```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTES, ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface XPGainRevealProps {
  gains: Partial<Record<Attribute, number>>;
  onComplete: () => void;
}

const REVEAL_MS = 900;
const REDUCED_MOTION_MS = 1;

/**
 * Floats "+N" numbers above the affected attribute bars during the reveal
 * window after a successful log submission. Uses absolute positioning at the
 * root so it can be mounted by the AnimationOrchestrator without knowing the
 * exact layout of the bars below — the user reads them as ambient feedback.
 */
export function XPGainReveal({ gains, onComplete }: XPGainRevealProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timeout = setTimeout(onComplete, reducedMotion ? REDUCED_MOTION_MS : REVEAL_MS + 100);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion]);

  if (reducedMotion) return null;

  const entries = ATTRIBUTES.flatMap((attr) => {
    const v = gains[attr];
    return v && v > 0 ? [{ attr, v }] : [];
  });

  return (
    <View pointerEvents="none" style={styles.host}>
      {entries.map(({ attr, v }, idx) => (
        <Float key={attr} attribute={attr} value={v} indexInList={idx} />
      ))}
    </View>
  );
}

interface FloatProps {
  attribute: Attribute;
  value: number;
  indexInList: number;
}

function Float({ attribute, value, indexInList }: FloatProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-24, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: REVEAL_MS, easing: Easing.in(Easing.cubic) });
  }, [translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      testID={`xp-reveal-${attribute}`}
      style={[
        styles.float,
        {
          color: ATTRIBUTE_COLORS[attribute],
          top: 80 + indexInList * 32,
        },
        animatedStyle,
      ]}
    >
      {`+${value}`}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  float: {
    position: 'absolute',
    right: 24,
    fontSize: 18,
    fontWeight: '700',
  },
});
```

- [ ] **Step 10.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=XPGainReveal`
Expected: 3 tests pass.

- [ ] **Step 10.5: Commit**

```bash
git add src/ui/components/XPGainReveal.tsx src/ui/components/__tests__/XPGainReveal.test.tsx
git commit -m "feat(ui): add XPGainReveal floating numbers"
```

---

## Task 11: `<LevelUpOverlay>` celebration

**Files:**
- Create: `src/ui/components/LevelUpOverlay.tsx`
- Create: `src/ui/components/__tests__/LevelUpOverlay.test.tsx`

- [ ] **Step 11.1: Write failing tests**

```typescript
// src/ui/components/__tests__/LevelUpOverlay.test.tsx
import { act, fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { LevelUpOverlay } from '@/ui/components/LevelUpOverlay';

describe('LevelUpOverlay', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockImpactAsync.mockClear();
  });

  it('renders the attribute and level', () => {
    const { getByText } = render(
      <LevelUpOverlay attribute="STR" newLevel={4} onComplete={() => {}} />,
    );
    expect(getByText('STR')).toBeTruthy();
    expect(getByText('Lv 4')).toBeTruthy();
  });

  it('fires haptics.levelUp (heavy impact) on mount', () => {
    render(<LevelUpOverlay attribute="DEX" newLevel={2} onComplete={() => {}} />);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('heavy');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<LevelUpOverlay attribute="CON" newLevel={3} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <LevelUpOverlay attribute="INT" newLevel={5} onComplete={onComplete} />,
    );
    fireEvent.press(getByTestId('level-up-overlay'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(<LevelUpOverlay attribute="WIS" newLevel={2} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 11.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=LevelUpOverlay`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 11.3: Implement**

Create `src/ui/components/LevelUpOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface LevelUpOverlayProps {
  attribute: Attribute;
  newLevel: number;
  onComplete: () => void;
}

const ENTER_MS = 250;
const HOLD_MS = 1000;
const EXIT_MS = 250;
const REDUCED_MOTION_HOLD_MS = 800;

/**
 * Full-screen celebration overlay rendered for ~1.5s when an attribute levels
 * up. The orchestrator queues one of these per LevelUp from a successful log.
 * Tap anywhere to dismiss early and advance the queue.
 */
export function LevelUpOverlay({ attribute, newLevel, onComplete }: LevelUpOverlayProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    haptics.levelUp();
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : ENTER_MS + HOLD_MS + EXIT_MS;
    const timeout = setTimeout(onComplete, totalMs);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion]);

  const scale = useSharedValue(reducedMotion ? 1 : 0.5);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    scale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 140 }),
      withTiming(1, { duration: 120 }),
    );
  }, [reducedMotion, scale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      testID="level-up-overlay"
      onPress={onComplete}
      style={StyleSheet.absoluteFill}
      accessibilityRole="alert"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: ATTRIBUTE_COLORS[attribute] },
            animatedIconStyle,
          ]}
        >
          <Text style={styles.iconText}>{attribute}</Text>
        </Animated.View>
        <Text style={styles.levelText}>{`Lv ${newLevel}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(14, 17, 22, 0.85)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#0E1116',
    fontSize: 36,
    fontWeight: '800',
  },
  levelText: {
    color: '#E8C547',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
  },
});
```

- [ ] **Step 11.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=LevelUpOverlay`
Expected: 5 tests pass.

- [ ] **Step 11.5: Commit**

```bash
git add src/ui/components/LevelUpOverlay.tsx src/ui/components/__tests__/LevelUpOverlay.test.tsx
git commit -m "feat(ui): add LevelUpOverlay celebration"
```

---

## Task 12: `<MissionCompletionToast>`

**Files:**
- Create: `src/ui/components/MissionCompletionToast.tsx`
- Create: `src/ui/components/__tests__/MissionCompletionToast.test.tsx`

- [ ] **Step 12.1: Write failing tests**

```typescript
// src/ui/components/__tests__/MissionCompletionToast.test.tsx
import { act, fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { MissionCompletionToast } from '@/ui/components/MissionCompletionToast';

describe('MissionCompletionToast', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockNotificationAsync.mockClear();
  });

  it('renders mission description and bonus XP', () => {
    const { getByText } = render(
      <MissionCompletionToast
        missionDescription="Move your body for 20 minutes"
        bonusXP={50}
        attribute="CON"
        onComplete={() => {}}
      />,
    );
    expect(getByText('Move your body for 20 minutes')).toBeTruthy();
    expect(getByText('+50 XP')).toBeTruthy();
  });

  it('fires haptics.success on mount', () => {
    render(
      <MissionCompletionToast
        missionDescription="Read 20 minutes"
        bonusXP={50}
        attribute="INT"
        onComplete={() => {}}
      />,
    );
    expect(mockNotificationAsync).toHaveBeenCalledWith('success');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(
      <MissionCompletionToast
        missionDescription="Read 20 minutes"
        bonusXP={50}
        attribute="INT"
        onComplete={onComplete}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <MissionCompletionToast
        missionDescription="x"
        bonusXP={50}
        attribute="STR"
        onComplete={onComplete}
      />,
    );
    fireEvent.press(getByTestId('mission-completion-toast'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(
      <MissionCompletionToast
        missionDescription="x"
        bonusXP={50}
        attribute="STR"
        onComplete={onComplete}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 12.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=MissionCompletionToast`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 12.3: Implement**

Create `src/ui/components/MissionCompletionToast.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface MissionCompletionToastProps {
  missionDescription: string;
  bonusXP: number;
  attribute: Attribute;
  onComplete: () => void;
}

const ENTER_MS = 200;
const HOLD_MS = 800;
const EXIT_MS = 200;
const REDUCED_MOTION_HOLD_MS = 800;

export function MissionCompletionToast({
  missionDescription,
  bonusXP,
  attribute,
  onComplete,
}: MissionCompletionToastProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(reducedMotion ? 0 : -100);

  useEffect(() => {
    haptics.success();
    if (!reducedMotion) {
      translateY.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    }
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : ENTER_MS + HOLD_MS + EXIT_MS;
    const exitTimer = reducedMotion
      ? null
      : setTimeout(() => {
          translateY.value = withTiming(-100, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
        }, ENTER_MS + HOLD_MS);
    const completeTimer = setTimeout(onComplete, totalMs);
    return () => {
      if (exitTimer) clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, reducedMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Pressable
      testID="mission-completion-toast"
      onPress={onComplete}
      style={[styles.host, { paddingTop: insets.top + 8 }]}
      accessibilityRole="alert"
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={[styles.attrDot, { backgroundColor: ATTRIBUTE_COLORS[attribute] }]} />
        <Text style={styles.description} numberOfLines={1}>
          {missionDescription}
        </Text>
        <Text style={styles.bonus}>{`+${bonusXP} XP`}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F26',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  attrDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  description: {
    flex: 1,
    color: '#E6EDF3',
    fontSize: 14,
    fontWeight: '500',
  },
  bonus: {
    color: '#E8C547',
    fontSize: 13,
    fontWeight: '700',
  },
});
```

- [ ] **Step 12.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=MissionCompletionToast`
Expected: 5 tests pass.

- [ ] **Step 12.5: Commit**

```bash
git add src/ui/components/MissionCompletionToast.tsx src/ui/components/__tests__/MissionCompletionToast.test.tsx
git commit -m "feat(ui): add MissionCompletionToast"
```

---

## Task 13: `<StreakMilestoneOverlay>`

**Files:**
- Create: `src/ui/components/StreakMilestoneOverlay.tsx`
- Create: `src/ui/components/__tests__/StreakMilestoneOverlay.test.tsx`

- [ ] **Step 13.1: Write failing tests**

```typescript
// src/ui/components/__tests__/StreakMilestoneOverlay.test.tsx
import { act, fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { StreakMilestoneOverlay } from '@/ui/components/StreakMilestoneOverlay';

describe('StreakMilestoneOverlay', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockNotificationAsync.mockClear();
  });

  it('renders threshold and multiplier text', () => {
    const { getByText } = render(
      <StreakMilestoneOverlay threshold={7} multiplier={1.2} onComplete={() => {}} />,
    );
    expect(getByText('7-day streak!')).toBeTruthy();
    expect(getByText('Streak multiplier now 1.20×')).toBeTruthy();
  });

  it('fires haptics.success on mount', () => {
    render(<StreakMilestoneOverlay threshold={3} multiplier={1.05} onComplete={() => {}} />);
    expect(mockNotificationAsync).toHaveBeenCalledWith('success');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<StreakMilestoneOverlay threshold={30} multiplier={1.2} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <StreakMilestoneOverlay threshold={3} multiplier={1.05} onComplete={onComplete} />,
    );
    fireEvent.press(getByTestId('streak-milestone-overlay'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(<StreakMilestoneOverlay threshold={7} multiplier={1.2} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 13.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=StreakMilestoneOverlay`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 13.3: Implement**

Create `src/ui/components/StreakMilestoneOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface StreakMilestoneOverlayProps {
  threshold: 3 | 7 | 30;
  multiplier: number;
  onComplete: () => void;
}

const TOTAL_MS = 1500;
const REDUCED_MOTION_HOLD_MS = 800;

export function StreakMilestoneOverlay({ threshold, multiplier, onComplete }: StreakMilestoneOverlayProps) {
  const reducedMotion = useReducedMotion();
  const flameScale = useSharedValue(reducedMotion ? 1 : 0.6);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    haptics.success();
    if (!reducedMotion) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      flameScale.value = withSequence(
        withSpring(1.2, { damping: 6, stiffness: 140 }),
        withTiming(1, { duration: 120 }),
      );
    }
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : TOTAL_MS;
    const timeout = setTimeout(onComplete, totalMs);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion, flameScale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedFlameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flameScale.value }] }));

  const multiplierText = `Streak multiplier now ${multiplier.toFixed(2)}×`;

  return (
    <Pressable
      testID="streak-milestone-overlay"
      onPress={onComplete}
      style={StyleSheet.absoluteFill}
      accessibilityRole="alert"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Animated.Text style={[styles.flame, animatedFlameStyle]}>{'\u{1F525}'}</Animated.Text>
          <Text style={styles.title}>{`${threshold}-day streak!`}</Text>
          <Text style={styles.subtitle}>{multiplierText}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(14, 17, 22, 0.85)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1A1F26',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 260,
  },
  flame: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9AA4AE',
    fontSize: 14,
    marginTop: 6,
  },
});
```

- [ ] **Step 13.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=StreakMilestoneOverlay`
Expected: 5 tests pass.

- [ ] **Step 13.5: Commit**

```bash
git add src/ui/components/StreakMilestoneOverlay.tsx src/ui/components/__tests__/StreakMilestoneOverlay.test.tsx
git commit -m "feat(ui): add StreakMilestoneOverlay"
```

---

## Task 14: `<AnimationOrchestrator>` — sequencer

**Files:**
- Create: `src/ui/components/AnimationOrchestrator.tsx`
- Create: `src/ui/components/__tests__/AnimationOrchestrator.test.tsx`

- [ ] **Step 14.1: Write failing tests**

```typescript
// src/ui/components/__tests__/AnimationOrchestrator.test.tsx
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

interface MockLogsState {
  lastSubmitResult: {
    gains: Record<string, number>;
    levelUps: Array<{ attribute: string; newLevel: number }>;
    missionCompletions: string[];
    prevStreak: number;
    newStreak: number;
  } | null;
  clearLastSubmitResult: jest.Mock;
}

let mockLogsState: MockLogsState = {
  lastSubmitResult: null,
  clearLastSubmitResult: jest.fn(),
};

jest.mock('@/state/logsStore', () => ({
  useLogsStore: Object.assign(
    jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
    { getState: () => mockLogsState },
  ),
}));

interface MockMissionsState {
  active: Array<{ id: string; description: string; bonusXP: number; attribute: string }>;
}
const mockMissionsState: MockMissionsState = {
  active: [
    { id: 'daily_con_cardio_2026-05-10', description: 'Move 20 minutes', bonusXP: 50, attribute: 'CON' },
  ],
};
jest.mock('@/state/missionsStore', () => ({
  useMissionsStore: Object.assign(
    jest.fn((selector: (s: unknown) => unknown) => selector(mockMissionsState)),
    { getState: () => mockMissionsState },
  ),
}));

const captured: Array<{ kind: string; props: Record<string, unknown> }> = [];

jest.mock('@/ui/components/XPGainReveal', () => ({
  XPGainReveal: (props: Record<string, unknown>) => {
    captured.push({ kind: 'xp-reveal', props });
    setTimeout(() => (props.onComplete as () => void)(), 0);
    return <Text testID="stub-xp-reveal">xp</Text>;
  },
}));
jest.mock('@/ui/components/LevelUpOverlay', () => ({
  LevelUpOverlay: (props: Record<string, unknown>) => {
    captured.push({ kind: 'level-up', props });
    setTimeout(() => (props.onComplete as () => void)(), 0);
    return <Text testID="stub-level-up">{`${props.attribute}-${props.newLevel}`}</Text>;
  },
}));
jest.mock('@/ui/components/MissionCompletionToast', () => ({
  MissionCompletionToast: (props: Record<string, unknown>) => {
    captured.push({ kind: 'mission', props });
    setTimeout(() => (props.onComplete as () => void)(), 0);
    return <Text testID="stub-mission">m</Text>;
  },
}));
jest.mock('@/ui/components/StreakMilestoneOverlay', () => ({
  StreakMilestoneOverlay: (props: Record<string, unknown>) => {
    captured.push({ kind: 'streak', props });
    setTimeout(() => (props.onComplete as () => void)(), 0);
    return <Text testID="stub-streak">s</Text>;
  },
}));

import { AnimationOrchestrator } from '@/ui/components/AnimationOrchestrator';

describe('AnimationOrchestrator', () => {
  beforeEach(() => {
    captured.length = 0;
    mockLogsState = {
      lastSubmitResult: null,
      clearLastSubmitResult: jest.fn(),
    };
  });

  it('renders nothing when lastSubmitResult is null', () => {
    const { queryByTestId } = render(<AnimationOrchestrator />);
    expect(queryByTestId('stub-xp-reveal')).toBeNull();
    expect(queryByTestId('stub-level-up')).toBeNull();
  });

  it('processes a queue with all four item kinds in order', async () => {
    mockLogsState = {
      lastSubmitResult: {
        gains: { STR: 30, CON: 15 },
        levelUps: [
          { attribute: 'STR', newLevel: 4 },
          { attribute: 'CON', newLevel: 3 },
        ],
        missionCompletions: ['daily_con_cardio_2026-05-10'],
        prevStreak: 6,
        newStreak: 7,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    // Advance through the queue. Each stub fires onComplete via setTimeout(0).
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    const kinds = captured.map((c) => c.kind);
    expect(kinds).toEqual(['xp-reveal', 'level-up', 'level-up', 'mission', 'streak']);
    // Level-ups in attribute order
    expect(captured[1]?.props.attribute).toBe('STR');
    expect(captured[2]?.props.attribute).toBe('CON');
    // Streak threshold
    expect(captured[4]?.props.threshold).toBe(7);
    expect(captured[4]?.props.multiplier).toBe(1.2);
    // clearLastSubmitResult called once when the new result was enqueued
    expect(mockLogsState.clearLastSubmitResult).toHaveBeenCalledTimes(1);
  });

  it('skips the streak overlay when no milestone was crossed', async () => {
    mockLogsState = {
      lastSubmitResult: {
        gains: { STR: 10 },
        levelUps: [],
        missionCompletions: [],
        prevStreak: 7,
        newStreak: 8,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(captured.map((c) => c.kind)).toEqual(['xp-reveal']);
  });

  it('clears lastSubmitResult even when there is nothing to enqueue', async () => {
    mockLogsState = {
      lastSubmitResult: {
        gains: {},
        levelUps: [],
        missionCompletions: [],
        prevStreak: 1,
        newStreak: 1,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(captured).toEqual([]);
    expect(mockLogsState.clearLastSubmitResult).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 14.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=AnimationOrchestrator`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 14.3: Implement**

Create `src/ui/components/AnimationOrchestrator.tsx`:

```tsx
import { useEffect, useState } from 'react';

import { ATTRIBUTES, type Attribute } from '@/game/constants';
import { crossedStreakMilestone, streakMultiplierAt } from '@/game/streakMilestone';
import { useLogsStore } from '@/state/logsStore';
import { useMissionsStore } from '@/state/missionsStore';

import { LevelUpOverlay } from '@/ui/components/LevelUpOverlay';
import { MissionCompletionToast } from '@/ui/components/MissionCompletionToast';
import { StreakMilestoneOverlay } from '@/ui/components/StreakMilestoneOverlay';
import { XPGainReveal } from '@/ui/components/XPGainReveal';

type QueueItem =
  | { kind: 'xp-reveal'; gains: Partial<Record<Attribute, number>> }
  | { kind: 'level-up'; attribute: Attribute; newLevel: number }
  | { kind: 'mission'; missionDescription: string; bonusXP: number; attribute: Attribute }
  | { kind: 'streak'; threshold: 3 | 7 | 30; multiplier: number };

/**
 * Single sequencer for post-submit animations. Mounted once at the root
 * (`app/_layout.tsx`). Watches `lastSubmitResult` on the logs store; when a new
 * one arrives, builds a queue of overlay items and plays them one at a time.
 *
 * The orchestrator clears `lastSubmitResult` as soon as it has read it, so the
 * next subscriber update doesn't re-enqueue the same items. If a new submit
 * arrives mid-queue, its items are appended to the existing queue rather than
 * replacing it (so two submits in quick succession both get celebrated).
 */
export function AnimationOrchestrator(): React.JSX.Element | null {
  const lastSubmitResult = useLogsStore((s) => s.lastSubmitResult);
  const activeMissions = useMissionsStore((s) => s.active);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);

  // Enqueue effect — runs whenever lastSubmitResult changes to a non-null value.
  useEffect(() => {
    if (!lastSubmitResult) return;

    const items: QueueItem[] = [];
    if (Object.keys(lastSubmitResult.gains).length > 0) {
      items.push({ kind: 'xp-reveal', gains: lastSubmitResult.gains });
    }

    // Level-ups in canonical ATTRIBUTES order, regardless of the order the
    // engine returned. Handles multi-attribute level-ups in a stable sequence.
    const sortedLevelUps = [...lastSubmitResult.levelUps].sort(
      (a, b) => ATTRIBUTES.indexOf(a.attribute) - ATTRIBUTES.indexOf(b.attribute),
    );
    for (const lu of sortedLevelUps) {
      items.push({ kind: 'level-up', attribute: lu.attribute, newLevel: lu.newLevel });
    }

    for (const id of lastSubmitResult.missionCompletions) {
      const m = activeMissions.find((x) => x.id === id);
      if (!m) continue;
      items.push({
        kind: 'mission',
        missionDescription: m.description,
        bonusXP: m.bonusXP,
        attribute: m.attribute,
      });
    }

    const milestone = crossedStreakMilestone(lastSubmitResult.prevStreak, lastSubmitResult.newStreak);
    if (milestone) {
      items.push({ kind: 'streak', threshold: milestone, multiplier: streakMultiplierAt(milestone) });
    }

    if (items.length > 0) {
      setQueue((q) => [...q, ...items]);
    }
    useLogsStore.getState().clearLastSubmitResult();
  }, [lastSubmitResult, activeMissions]);

  // Advance effect — when nothing is playing and the queue has items, dequeue.
  useEffect(() => {
    if (current === null && queue.length > 0) {
      setCurrent(queue[0] ?? null);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  if (!current) return null;

  const advance = () => setCurrent(null);

  switch (current.kind) {
    case 'xp-reveal':
      return <XPGainReveal gains={current.gains} onComplete={advance} />;
    case 'level-up':
      return (
        <LevelUpOverlay
          attribute={current.attribute}
          newLevel={current.newLevel}
          onComplete={advance}
        />
      );
    case 'mission':
      return (
        <MissionCompletionToast
          missionDescription={current.missionDescription}
          bonusXP={current.bonusXP}
          attribute={current.attribute}
          onComplete={advance}
        />
      );
    case 'streak':
      return (
        <StreakMilestoneOverlay
          threshold={current.threshold}
          multiplier={current.multiplier}
          onComplete={advance}
        />
      );
  }
}
```

- [ ] **Step 14.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=AnimationOrchestrator`
Expected: 4 tests pass.

- [ ] **Step 14.5: Commit**

```bash
git add src/ui/components/AnimationOrchestrator.tsx src/ui/components/__tests__/AnimationOrchestrator.test.tsx
git commit -m "feat(ui): add AnimationOrchestrator sequencer"
```

---

## Task 15: Mount `<AnimationOrchestrator>` in root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 15.1: Add the import**

Add to existing imports in `app/_layout.tsx`:

```typescript
import { AnimationOrchestrator } from '@/ui/components/AnimationOrchestrator';
```

- [ ] **Step 15.2: Render alongside existing root-level UI**

Replace `PostBootShell` to include the orchestrator:

```tsx
function PostBootShell(): React.JSX.Element {
  useAppForegroundDecay();
  useAIAvailabilityProbe();
  return (
    <>
      <AIUnavailableBanner />
      <Slot />
      <AnimationOrchestrator />
    </>
  );
}
```

The orchestrator sits AFTER `<Slot />` so its overlays render above route screens.

- [ ] **Step 15.3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: zero errors.

- [ ] **Step 15.4: Run all tests**

Run: `npm test && npm run test:ui`
Expected: all suites pass.

- [ ] **Step 15.5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): mount AnimationOrchestrator in root layout"
```

---

## Task 16: Manual device verification

Not a code task — perform on the user's iPhone via Expo Go after Tasks 1-15 land.

- [ ] **Step 16.1:** Submit a log with no level-up. Bars fill smoothly. No overlay.

- [ ] **Step 16.2:** Submit a log that triggers a level-up. Overlay shows with attribute icon scaling, "Lv N" text, ~1.5s. Heavy haptic on appearance. Auto-dismisses.

- [ ] **Step 16.3:** Submit a log that triggers two level-ups. Overlays sequence in `ATTRIBUTES` order (STR, DEX, CON, INT, WIS, CHA). One haptic per overlay.

- [ ] **Step 16.4:** Submit a log that completes a daily mission. After the level-up overlay (if any), a top-anchored toast slides in with "+50 XP" badge. Success haptic.

- [ ] **Step 16.5:** Cross from 6 → 7-day streak. Streak milestone overlay fires after the previous animations, showing 🔥 + "7-day streak!" + "Streak multiplier now 1.20×". Success haptic.

- [ ] **Step 16.6:** With streak already at 7+, submit again. NO milestone overlay fires (already crossed).

- [ ] **Step 16.7:** Toggle iOS Settings → Accessibility → Reduce Motion ON. Submit again. Bar fill is instant. Overlays show static end-state for ~800ms then dismiss. No scaling, no springs, no shimmer.

- [ ] **Step 16.8:** Tap mid-overlay to verify tap-to-skip — animation queue advances immediately.

- [ ] **Step 16.9:** With AI available, tap the FAB. Light haptic. Tap Submit on a non-empty input. Light haptic.

- [ ] **Step 16.10:** With AI force-disabled (Settings → Developer → Force AI unavailable). FAB tap opens iOS Settings — no haptic.

---

## Acceptance criteria

This sub-project is complete when:

1. `submitLog` returns `gains`, `prevStreak`, `newStreak` in addition to existing fields. (`grep -n "prevStreak" src/state/submitLog.ts` matches; existing tests pass.)
2. `logsStore.lastSubmitResult` reflects the most recent successful submission; `clearLastSubmitResult()` empties it.
3. `<AnimationOrchestrator>` is mounted at the root and processes queues correctly, including the multi-submit append guard.
4. Bar fill animates over ~600ms after a successful submit.
5. Decay shimmer renders when `decayedToday: true`.
6. Level-up overlays sequence per attribute and auto-dismiss.
7. Mission completion toasts slide in/out after level-up overlays.
8. Streak milestone overlay fires on the submit that crosses 3/7/30.
9. All animations skip to instant when `useReducedMotion()` is true.
10. Haptics fire on FAB press, submit, each level-up, each mission completion, and each streak milestone.
11. All Jest and RNTL tests listed above pass; 100% coverage on `streakMilestone.ts`.
12. `npm run lint && npm run typecheck` pass with zero warnings.
