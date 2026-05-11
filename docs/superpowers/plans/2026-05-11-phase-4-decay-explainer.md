# Phase 4 — First-Decay Explainer & Decay-Shimmer Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the deferred decay-shimmer animation (from sub-project 2) to live state, and ship a one-time first-decay explainer modal that fires when decay first applies.

**Architecture:** `characterStore` gets a runtime-only `decayedAttributesToday: Attribute[]` field that `useAppForegroundDecay` populates after each foreground recompute. `CharacterSheetScreen` reads it to thread `decayedToday` into each `<AttributeBar>` (driving the shimmer) and conditionally renders `<FirstDecayModal>` when `firstDecayShown=false` and decayed attrs exist. The modal's dismiss handler is the only place that sets `firstDecayShown=true` — the old auto-set in `useAppForegroundDecay` is removed.

**Tech Stack:** TypeScript (strict), Zustand, React Native, Reanimated 4 (already installed). Jest (node env) for engine; RNTL (`jest-expo` preset, `*.test.tsx`) for components and screens.

**Spec:** `docs/superpowers/specs/2026-05-11-phase-4-decay-explainer-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `src/state/characterStore.ts` | Modify | Add `decayedAttributesToday` field + `setDecayedAttributesToday` setter |
| `src/state/hooks/useAppForegroundDecay.ts` | Modify | Track reduced attrs; remove auto-set of `firstDecayShown`; call setter after every foreground |
| `src/ui/components/FirstDecayModal.tsx` | New | Presentational one-time explainer modal |
| `src/ui/components/__tests__/FirstDecayModal.test.tsx` | New | RNTL component tests |
| `src/ui/screens/CharacterSheetScreen.tsx` | Modify | Thread `decayedToday` to bars; render modal conditionally |
| `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx` | Modify | Extend with shimmer + modal cases |

No new dependencies. No `jest.config.js` changes (no new 100%-coverage targets — the new logic is structural).

---

## Task 1: Extend `characterStore` with `decayedAttributesToday`

**Files:**
- Modify: `src/state/characterStore.ts`

- [ ] **Step 1.1: Replace `src/state/characterStore.ts` with the extended version**

Read the current file first to confirm shape, then replace with:

```typescript
import { create } from 'zustand';
import type { Attribute } from '@/game/constants';
import * as characterRepo from '@/storage/repositories/characterRepo';
import type { Character, AttributeState, Streak } from '@/storage/repositories/characterRepo';
import { getDb } from '@/storage/db';

export interface CharacterStoreState {
  character: Character | null;
  attributeStates: AttributeState[];
  streak: Streak;
  /**
   * Attributes that had non-zero in-progress XP reduced during the most recent
   * foreground decay recompute. Runtime-only — not persisted to SQLite. Drives
   * the AttributeBar shimmer + the FirstDecayModal trigger.
   */
  decayedAttributesToday: Attribute[];
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  createCharacter: (name: string, avatarId: string) => Promise<void>;
  setDecayedAttributesToday: (attrs: Attribute[]) => void;
}

export const useCharacterStore = create<CharacterStoreState>((set, get) => ({
  character: null,
  attributeStates: [],
  streak: { currentLength: 0, longestLength: 0 },
  decayedAttributesToday: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const [character, attributeStates, streak] = await Promise.all([
        characterRepo.getCharacter(db),
        characterRepo.getAttributeStates(db),
        characterRepo.getStreak(db),
      ]);
      set({ character, attributeStates, streak, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  createCharacter: async (name, avatarId) => {
    const db = await getDb();
    await characterRepo.createCharacter(db, name, avatarId);
    await get().hydrate();
  },

  setDecayedAttributesToday: (attrs) => {
    set({ decayedAttributesToday: attrs });
  },
}));
```

- [ ] **Step 1.2: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 1.3: Run all tests as a smoke pass**

Run: `npm test && npm run test:ui`
Expected: all suites pass. Existing tests don't read `decayedAttributesToday`, so adding it is non-breaking.

- [ ] **Step 1.4: Commit**

```bash
git add src/state/characterStore.ts
git commit -m "feat(state): add decayedAttributesToday to characterStore"
```

The pre-commit hook re-runs lint + typecheck. If it fails, paste verbatim.

---

## Task 2: Modify `useAppForegroundDecay` to track reduced attrs and stop auto-setting `firstDecayShown`

**Files:**
- Modify: `src/state/hooks/useAppForegroundDecay.ts`

This task changes the existing hook's `runDecay` callback. The hook has no test file (manually verified per ARCHITECTURE convention).

- [ ] **Step 2.1: Read the current file**

Use Read on `src/state/hooks/useAppForegroundDecay.ts` so you have the exact current shape.

- [ ] **Step 2.2: Replace the file's contents**

Replace `src/state/hooks/useAppForegroundDecay.ts` with:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getDb } from '@/storage/db';
import { todayLocalISODate } from '@/lib/clock';
import type { Attribute } from '@/game/constants';
import { useSettingsStore } from '@/state/settingsStore';
import { useCharacterStore } from '@/state/characterStore';
import { effectiveInactiveDays, applyDecay } from '@/game/decay';
import * as characterRepo from '@/storage/repositories/characterRepo';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import * as logRepo from '@/storage/repositories/logRepo';
import type { ISODate } from '@/game/calendar';

/**
 * Runs XP decay on app foreground transitions and on cold start.
 *
 * Behavior:
 * - Subscribes to `AppState` and runs decay on each `"active"` transition,
 *   plus once on mount (cold start).
 * - Idempotent within the same calendar day, guarded by a `useRef` holding
 *   the most recent run-day. The ref is initialized from `getState()` so
 *   the hook does not subscribe reactively — the guard only needs the value
 *   at the moment decay fires.
 * - On a successful decay pass: writes attribute states to SQLite, calls
 *   `characterStore.hydrate()`, and records which attributes had non-zero
 *   in-progress XP reduced via `characterStore.setDecayedAttributesToday(...)`.
 * - On a no-decay foreground (within grace window, or user logged today),
 *   clears `decayedAttributesToday` to `[]` so the shimmer turns off and the
 *   first-decay modal trigger condition unsets.
 * - Does NOT set `firstDecayShown`. That flag is now owned by the
 *   FirstDecayModal dismiss handler (see CharacterSheetScreen).
 *
 * No unit test — depends on `AppState` (native). Verified manually.
 */
export function useAppForegroundDecay(): void {
  // Initialize from getState() (non-reactive) so we don't resubscribe on every
  // settings change — the guard only reads the value when runDecay fires.
  const lastDecayRunDayRef = useRef<ISODate | null>(useSettingsStore.getState().lastDecayRunDay);

  const runDecay = useCallback(async () => {
    const today = todayLocalISODate();
    if (lastDecayRunDayRef.current === today) return; // already ran today

    const db = await getDb();
    const lastLogDay = await logRepo.getLastLogDay(db);

    if (lastLogDay === null) {
      // No prior log — record the run-day to avoid re-running, then return.
      await settingsRepo.setSetting(db, 'last_decay_run_day', today);
      await useSettingsStore.getState().setLastDecayRunDay(today);
      lastDecayRunDayRef.current = today;
      useCharacterStore.getState().setDecayedAttributesToday([]);
      return;
    }

    // Inline daysSince — calendar.ts is frozen and does not export this helper.
    const daysSince = Math.round(
      (new Date(today).getTime() - new Date(lastLogDay).getTime()) / 86_400_000,
    );
    const eff = effectiveInactiveDays(daysSince, 0); // pauseWindows is Phase 4

    const reducedAttrs: Attribute[] = [];
    if (eff > 0) {
      const states = await characterRepo.getAttributeStates(db);
      const decayed = states.map((s) => {
        const nextXp = applyDecay(
          { level: s.level, inProgressXp: s.inProgressXp },
          eff,
        ).inProgressXp;
        if (nextXp < s.inProgressXp) reducedAttrs.push(s.attribute);
        return { ...s, inProgressXp: nextXp };
      });
      await characterRepo.updateAttributeStates(db, decayed);
      await useCharacterStore.getState().hydrate();
    }

    useCharacterStore.getState().setDecayedAttributesToday(reducedAttrs);

    await settingsRepo.setSetting(db, 'last_decay_run_day', today);
    await useSettingsStore.getState().setLastDecayRunDay(today);
    lastDecayRunDayRef.current = today; // update AFTER successful run
  }, []); // empty deps — ref is intentionally non-reactive

  useEffect(() => {
    // Run on mount (cold start)
    void runDecay();

    // Subscribe to foreground transitions. Modern RN returns an
    // EventSubscription whose `.remove()` is the cleanup; do not use the
    // legacy `removeEventListener` API.
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void runDecay();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runDecay]);
}
```

Key differences from the previous version:
- Imports `Attribute` type.
- Tracks `reducedAttrs` and calls `setDecayedAttributesToday` in three places: the no-log-yet branch (with `[]`), after a decay pass (with `reducedAttrs`), and implicitly when `eff === 0` falls through to the final `setDecayedAttributesToday(reducedAttrs)` call (which writes `[]` since the array stayed empty).
- The `firstDecayShown=true` auto-set is REMOVED. The modal owns that lifecycle now.

- [ ] **Step 2.3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 2.4: Run all tests**

Run: `npm test && npm run test:ui`
Expected: all suites pass. The hook has no automated tests; existing tests that touch it (none) are unaffected.

- [ ] **Step 2.5: Commit**

```bash
git add src/state/hooks/useAppForegroundDecay.ts
git commit -m "feat(state): track decayed attributes per foreground; stop auto-setting firstDecayShown"
```

The pre-commit hook re-runs lint + typecheck. If it fails, paste verbatim.

---

## Task 3: Build `<FirstDecayModal>` (TDD)

**Files:**
- Create: `src/ui/components/FirstDecayModal.tsx`
- Create: `src/ui/components/__tests__/FirstDecayModal.test.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `src/ui/components/__tests__/FirstDecayModal.test.tsx`:

```typescript
import { fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { FirstDecayModal } from '@/ui/components/FirstDecayModal';

describe('FirstDecayModal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders the title and body copy', () => {
    const { getByText } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByText('Your XP just decayed.')).toBeTruthy();
    expect(
      getByText(
        'Inactive days slowly drain your in-progress XP — never your level. Log something today to stop it.',
      ),
    ).toBeTruthy();
  });

  it('renders the "Got it" button', () => {
    const { getByTestId } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByTestId('first-decay-modal-dismiss')).toBeTruthy();
  });

  it('fires onDismiss when the button is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('first-decay-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onDismiss when the backdrop is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('first-decay-modal'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('exposes accessibilityRole="alert" on the host', () => {
    const { getByTestId } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByTestId('first-decay-modal').props.accessibilityRole).toBe('alert');
  });

  it('reduced-motion variant still renders and fires onDismiss on button tap', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const onDismiss = jest.fn();
    const { getByText, getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    expect(getByText('Your XP just decayed.')).toBeTruthy();
    fireEvent.press(getByTestId('first-decay-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=FirstDecayModal`
Expected: FAIL with `Could not locate module @/ui/components/FirstDecayModal`. Capture the error line.

- [ ] **Step 3.3: Implement the modal**

Create `src/ui/components/FirstDecayModal.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface FirstDecayModalProps {
  onDismiss: () => void;
}

const ENTER_MS = 200;

/**
 * One-time explainer shown the first time decay reduces a user's in-progress
 * XP. Rendered by CharacterSheetScreen when `firstDecayShown=false` and
 * `decayedAttributesToday.length > 0`. Dismissed only via the explicit "Got it"
 * button — the backdrop is not tap-to-dismiss because this is informational
 * onboarding, not an interruption.
 */
export function FirstDecayModal({ onDismiss }: FirstDecayModalProps) {
  const reducedMotion = useReducedMotion();

  const iconScale = useSharedValue(reducedMotion ? 1 : 0.5);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
    iconScale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 140 }),
      withTiming(1, { duration: 120 }),
    );
  }, [reducedMotion, iconScale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <Pressable
      testID="first-decay-modal"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Animated.Text style={[styles.icon, animatedIconStyle]}>{'⏳'}</Animated.Text>
          <Text style={styles.title}>Your XP just decayed.</Text>
          <Text style={styles.body}>
            Inactive days slowly drain your in-progress XP — never your level. Log something today
            to stop it.
          </Text>
          <TouchableOpacity
            testID="first-decay-modal-dismiss"
            accessibilityRole="button"
            accessibilityLabel="Got it"
            onPress={onDismiss}
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>Got it</Text>
          </TouchableOpacity>
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
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1F26',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  icon: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  body: {
    color: '#9AA4AE',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#E8C547',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#0E1116',
    fontSize: 16,
    fontWeight: '800',
  },
});
```

- [ ] **Step 3.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=FirstDecayModal`
Expected: 6 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/ui/components/FirstDecayModal.tsx src/ui/components/__tests__/FirstDecayModal.test.tsx
git commit -m "feat(ui): add FirstDecayModal explainer"
```

The pre-commit hook re-runs lint + typecheck.

## TDD discipline

Run 3.2 (failing) BEFORE writing 3.3.

---

## Task 4: Wire `<FirstDecayModal>` + `decayedToday` into `CharacterSheetScreen` (TDD)

**Files:**
- Modify: `src/ui/screens/CharacterSheetScreen.tsx`
- Modify: `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`

This task threads two pieces:
1. `decayedToday={decayedSet.has(attr)}` to each `<AttributeBar>` (live shimmer wiring).
2. Conditional render of `<FirstDecayModal>` based on the trigger condition.

- [ ] **Step 4.1: Read both files**

Use Read on:
- `src/ui/screens/CharacterSheetScreen.tsx`
- `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`

Both files have been extended across prior sub-projects; understand the existing mock structure before editing.

- [ ] **Step 4.2: Extend the test file's mocks**

In `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`:

The existing test mocks `@/state/characterStore` with `useCharacterStore: jest.fn((selector) => selector({...}))` containing `character`, `attributeStates`, `streak`, `loading`. Extend the mock state shape to include the new field. Update the existing inline mock to include `decayedAttributesToday: []` (default empty array) at the top of the mock state. Also add `setDecayedAttributesToday: jest.fn()` — but since this test only renders the screen (no decay-running code path), the setter will not be called by the screen tests. It's there for type completeness.

Concrete change: replace the `selector({...})` argument inside `jest.mock('@/state/characterStore', ...)` with the extended object:

```typescript
jest.mock('@/state/characterStore', () => ({
  useCharacterStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      character: {
        id: 1,
        name: 'Zara',
        avatarId: 'avatar_1',
        createdAt: '2026-01-01T00:00:00Z',
      },
      attributeStates: [
        { attribute: 'STR', level: 1, inProgressXp: 50 },
        { attribute: 'DEX', level: 1, inProgressXp: 0 },
        { attribute: 'CON', level: 2, inProgressXp: 150 },
        { attribute: 'INT', level: 1, inProgressXp: 30 },
        { attribute: 'WIS', level: 1, inProgressXp: 10 },
        { attribute: 'CHA', level: 1, inProgressXp: 0 },
      ],
      streak: { currentLength: 3, longestLength: 5 },
      decayedAttributesToday: [],
      loading: false,
      setDecayedAttributesToday: jest.fn(),
    }),
  ),
}));
```

(If the existing mock already includes some of these fields, preserve them — only add the two new ones.)

For the modal-trigger tests, the test needs to vary `firstDecayShown` and `decayedAttributesToday` per test. The existing settings store mock (if present in this file from prior sub-projects) is module-scoped via a `let mockSettingsState`. Use the same pattern for the character store: introduce a `let mockCharacterState` module-scoped object and change the mock to `selector(mockCharacterState)`. Then `beforeEach` resets it; individual tests assign new values.

Refactor pattern (replace the inline object above with a let-bound mock):

```typescript
let mockCharacterState: {
  character: { id: number; name: string; avatarId: string; createdAt: string } | null;
  attributeStates: Array<{ attribute: string; level: number; inProgressXp: number }>;
  streak: { currentLength: number; longestLength: number };
  decayedAttributesToday: string[];
  loading: boolean;
  setDecayedAttributesToday: jest.Mock;
};

const defaultCharacterState = {
  character: {
    id: 1,
    name: 'Zara',
    avatarId: 'avatar_1',
    createdAt: '2026-01-01T00:00:00Z',
  },
  attributeStates: [
    { attribute: 'STR', level: 1, inProgressXp: 50 },
    { attribute: 'DEX', level: 1, inProgressXp: 0 },
    { attribute: 'CON', level: 2, inProgressXp: 150 },
    { attribute: 'INT', level: 1, inProgressXp: 30 },
    { attribute: 'WIS', level: 1, inProgressXp: 10 },
    { attribute: 'CHA', level: 1, inProgressXp: 0 },
  ],
  streak: { currentLength: 3, longestLength: 5 },
  decayedAttributesToday: [],
  loading: false,
  setDecayedAttributesToday: jest.fn(),
};

mockCharacterState = { ...defaultCharacterState };

jest.mock('@/state/characterStore', () => ({
  useCharacterStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockCharacterState)),
}));
```

Add a `beforeEach` reset (or extend an existing one):

```typescript
beforeEach(() => {
  mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
});
```

Now add the settings store mock (if not already present in this file — it might be, from sub-project 1 work). Pattern:

```typescript
const mockSetFirstDecayShown = jest.fn().mockResolvedValue(undefined);

let mockSettingsState: {
  firstDecayShown: boolean;
  setFirstDecayShown: jest.Mock;
};

const defaultSettingsState = {
  firstDecayShown: false,
  setFirstDecayShown: mockSetFirstDecayShown,
};

mockSettingsState = { ...defaultSettingsState };

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockSettingsState)),
}));
```

If `@/state/settingsStore` is already mocked in this file from a prior sub-project (e.g., for `aiSourceLastUsed`), extend the existing mock's state shape instead of duplicating. Add `firstDecayShown` and `setFirstDecayShown` fields to the existing `MockSettingsState` interface and default object.

Reset in `beforeEach`:

```typescript
mockSetFirstDecayShown.mockClear();
mockSettingsState = { ...defaultSettingsState };
```

- [ ] **Step 4.3: Append new test cases for the modal trigger and shimmer wiring**

Add inside the existing outer `describe('CharacterSheetScreen', ...)`:

```typescript
describe('FirstDecayModal trigger', () => {
  beforeEach(() => {
    mockSetFirstDecayShown.mockClear();
  });

  it('renders the modal when firstDecayShown=false AND decayedAttributesToday is non-empty', () => {
    mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
    const { getByTestId } = render(<CharacterSheetScreen />);
    expect(getByTestId('first-decay-modal')).toBeTruthy();
  });

  it('does NOT render the modal when firstDecayShown=true', () => {
    mockSettingsState = { ...defaultSettingsState, firstDecayShown: true };
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
    const { queryByTestId } = render(<CharacterSheetScreen />);
    expect(queryByTestId('first-decay-modal')).toBeNull();
  });

  it('does NOT render the modal when decayedAttributesToday is empty', () => {
    mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
    const { queryByTestId } = render(<CharacterSheetScreen />);
    expect(queryByTestId('first-decay-modal')).toBeNull();
  });

  it('dismissing the modal calls setFirstDecayShown(true)', () => {
    mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
    const { getByTestId } = render(<CharacterSheetScreen />);
    fireEvent.press(getByTestId('first-decay-modal-dismiss'));
    expect(mockSetFirstDecayShown).toHaveBeenCalledWith(true);
  });
});

describe('Decay shimmer wiring', () => {
  it('passes decayedToday=true to bars in decayedAttributesToday', () => {
    mockCharacterState = {
      ...defaultCharacterState,
      decayedAttributesToday: ['STR', 'CON'],
    };
    const { getByTestId } = render(<CharacterSheetScreen />);
    // The shimmer overlay testID is `attribute-bar-shimmer-<ATTR>` per AttributeBar.
    expect(getByTestId('attribute-bar-shimmer-STR')).toBeTruthy();
    expect(getByTestId('attribute-bar-shimmer-CON')).toBeTruthy();
  });

  it('does NOT render shimmer for bars not in decayedAttributesToday', () => {
    mockCharacterState = {
      ...defaultCharacterState,
      decayedAttributesToday: ['STR'],
    };
    const { queryByTestId } = render(<CharacterSheetScreen />);
    expect(queryByTestId('attribute-bar-shimmer-DEX')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
  });

  it('does NOT render any shimmer when decayedAttributesToday is empty', () => {
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
    const { queryByTestId } = render(<CharacterSheetScreen />);
    expect(queryByTestId('attribute-bar-shimmer-STR')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-DEX')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-INT')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-WIS')).toBeNull();
    expect(queryByTestId('attribute-bar-shimmer-CHA')).toBeNull();
  });
});
```

- [ ] **Step 4.4: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=CharacterSheetScreen`
Expected: the new tests fail because the screen doesn't yet render the modal or pass `decayedToday`. Existing tests continue to pass.

- [ ] **Step 4.5: Update `CharacterSheetScreen.tsx`**

In `src/ui/screens/CharacterSheetScreen.tsx`:

1. Add imports alongside existing `@/` imports:

```typescript
import { useSettingsStore } from '@/state/settingsStore';
import { FirstDecayModal } from '@/ui/components/FirstDecayModal';
```

If `useSettingsStore` is already imported (e.g., for `notificationsEnabled` from a prior sub-project), don't add it again.

2. Inside the component body, alongside existing store selectors, add:

```typescript
const decayedAttributesToday = useCharacterStore((s) => s.decayedAttributesToday);
const firstDecayShown = useSettingsStore((s) => s.firstDecayShown);
const setFirstDecayShown = useSettingsStore((s) => s.setFirstDecayShown);
```

3. Build a memoized set near the existing `useMemo` hooks:

```typescript
const decayedSet = useMemo(() => new Set(decayedAttributesToday), [decayedAttributesToday]);
```

4. In the `ATTRIBUTES.map(...)` block that renders `<AttributeBar>`, pass `decayedToday`:

```tsx
{ATTRIBUTES.map((attr) => {
  const s = stateByAttribute[attr];
  return (
    <AttributeBar
      key={attr}
      attribute={attr}
      level={s.level}
      inProgressXp={s.inProgressXp}
      xpThreshold={xpToReachLevel(s.level + 1)}
      decayedToday={decayedSet.has(attr)}
    />
  );
})}
```

5. At the bottom of the screen's return tree (after the FAB), add:

```tsx
{!firstDecayShown && decayedAttributesToday.length > 0 ? (
  <FirstDecayModal
    onDismiss={() => {
      void setFirstDecayShown(true);
    }}
  />
) : null}
```

- [ ] **Step 4.6: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=CharacterSheetScreen`
Expected: all tests pass (existing + 7 new).

- [ ] **Step 4.7: Run all UI tests as a smoke pass**

Run: `npm run test:ui`
Expected: all suites pass — no regressions.

- [ ] **Step 4.8: Final node-env smoke pass**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4.9: Commit**

```bash
git add src/ui/screens/CharacterSheetScreen.tsx src/ui/screens/__tests__/CharacterSheetScreen.test.tsx
git commit -m "feat(ui): thread decayedToday to bars and render FirstDecayModal"
```

The pre-commit hook re-runs lint + typecheck.

## TDD discipline

Run 4.4 (failing) BEFORE writing 4.5.

---

## Task 5: Manual device verification

Not a code task — perform on the user's iPhone via Expo Go after Tasks 1-4 land.

- [ ] **Step 5.1:** Fresh install. Submit one log. Background app. Wait 3+ days (or change device clock forward 3 days). Reopen app.

- [ ] **Step 5.2:** **Expected:** All six bars dim slightly (existing 60% opacity for decayed bars) + shimmer animation runs left-to-right; first-decay modal appears with hourglass icon + "Your XP just decayed." title.

- [ ] **Step 5.3:** Tap "Got it" → modal dismisses with no animation hiccup.

- [ ] **Step 5.4:** Force-quit and reopen → modal does NOT reappear.

- [ ] **Step 5.5:** Submit a log → next foreground (the same day, within the grace window again), `setDecayedAttributesToday([])` is called → shimmer turns off, bars return to full opacity.

- [ ] **Step 5.6:** Wait another 3 days inactive → bars decay again, shimmer animates, modal does NOT reappear (one-time only).

- [ ] **Step 5.7:** Toggle iOS Settings → Accessibility → Reduce Motion ON → repeat #1 on a fresh install. Shimmer is off (per sub-project 2); modal still renders (static, no animation); "Got it" dismisses normally.

---

## Acceptance criteria

This sub-project is complete when:

1. `characterStore.decayedAttributesToday` exists and is updated by `useAppForegroundDecay` on every foreground.
2. `useAppForegroundDecay` no longer sets `firstDecayShown=true`.
3. `<AttributeBar>` receives `decayedToday=true` for the attributes that actually had non-zero decay on the most recent foreground.
4. `<FirstDecayModal>` renders only when `firstDecayShown=false` AND `decayedAttributesToday.length > 0`.
5. The modal's "Got it" button persists `firstDecayShown=true`; the backdrop is non-interactive.
6. All Jest and RNTL tests pass; lint and typecheck clean.
