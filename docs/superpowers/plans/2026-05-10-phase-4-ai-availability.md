# Phase 4 — AI Availability (Factory + Probe + Banner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire on-device AI availability into the app — a single factory the rest of the app calls, a foreground probe that detects when AI is unusable, and a top-of-screen banner that disables the FAB and gates onboarding when unavailable.

**Architecture:** Factory module (`src/ai/aiServiceFactory.ts`) returns `MockAIService` in Phase 4 and is the Phase 5 swap point for `AppleAIService`. Runtime availability lives in a new in-memory Zustand store (`aiAvailabilityStore`). A foreground hook (`useAIAvailabilityProbe`) re-runs the probe on mount and on every `AppState === 'active'` transition. A `__DEV__`-only persisted setting (`dev_force_ai_unavailable`) lets the developer simulate unavailability via Settings → Developer.

**Tech Stack:** TypeScript (strict), Zustand, React Native `AppState`, `expo-linking` (`Linking.openSettings`), Jest (node env) for stores/factory, RNTL (`jest-expo` preset, `*.test.tsx`) for components/hooks/screens. SQLite key-value `settings` table (no new migration — `setSetting` accepts arbitrary keys, only the `SettingKey` union needs widening).

**Spec:** `docs/superpowers/specs/2026-05-10-phase-4-ai-availability-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `src/ai/aiServiceFactory.ts` | New | `getAIService()` (cached), `probeAIAvailability()`, `__resetFactoryForTests()`. Reads `__DEV__ + devForceAIUnavailable` for the override. |
| `src/ai/__tests__/aiServiceFactory.test.ts` | New | Unit tests for factory + probe + dev override + thrown-isAvailable handling. |
| `src/storage/repositories/settingsRepo.ts` | Modify | Add `'dev_force_ai_unavailable'` to `SettingKey`. |
| `src/state/settingsStore.ts` | Modify | Add `devForceAIUnavailable` field, `setDevForceAIUnavailable` setter, hydrate path. |
| `src/state/aiAvailabilityStore.ts` | New | Zustand store: `available`, `displayName`, `lastProbedAt`, `probing`, `runProbe()`, `setAvailability()`. |
| `src/state/__tests__/aiAvailabilityStore.test.ts` | New | Unit tests for store actions. |
| `src/state/hooks/useAIAvailabilityProbe.ts` | New | Mounts `AppState` listener; re-runs probe on `'active'`. |
| `src/state/hooks/__tests__/useAIAvailabilityProbe.test.tsx` | New | RNTL test for hook. |
| `src/ui/components/AIUnavailableBanner.tsx` | New | Presentational; reads from store; renders top-anchored amber bar with `Open Settings` action. |
| `src/ui/components/__tests__/AIUnavailableBanner.test.tsx` | New | RNTL tests for banner. |
| `app/_layout.tsx` | Modify | Add `useAIAvailabilityProbe()` to `PostBootShell`; render `<AIUnavailableBanner />` above `<Slot />`. |
| `src/ui/screens/CharacterSheetScreen.tsx` | Modify | FAB reads `available`; muted style + `Linking.openSettings` when false. |
| `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx` | Modify | New test: disabled FAB tap calls `Linking.openSettings`, not router. |
| `src/ui/screens/onboarding/AIConfirmScreen.tsx` | Modify | Reads `available`; switches headline + disables Continue when false. |
| `src/ui/screens/__tests__/OnboardingScreens.test.tsx` | Modify | New test: AIConfirmScreen unavailable branch. |
| `src/ui/screens/SettingsScreen.tsx` | Modify | Add `__DEV__` Developer toggle for `devForceAIUnavailable`. |
| `src/ui/screens/__tests__/SettingsScreen.test.tsx` | Modify | New test: dev toggle flips store and triggers probe. |
| `jest.config.js` | Modify | Add `aiServiceFactory.ts` to coverage threshold (100%). |

Dependencies follow `docs/ARCHITECTURE.md` rules: factory imports only `AIService`/`MockAIService` types and `settingsStore`; availability store imports the factory; banner imports the store + `expo-linking`; screens import their store dependencies.

---

## Task 1: Add `dev_force_ai_unavailable` to `SettingKey` union

**Files:**
- Modify: `src/storage/repositories/settingsRepo.ts:3-13`

- [ ] **Step 1.1: Add the new key to the union**

```typescript
// src/storage/repositories/settingsRepo.ts (replace existing SettingKey union)
export type SettingKey =
  | 'notifications_enabled'
  | 'notification_morning_time'
  | 'decay_paused'
  | 'decay_pause_started_at'
  | 'decay_paused_days_this_year'
  | 'decay_paused_year'
  | 'first_decay_shown'
  | 'ai_source_last_used'
  | 'onboarding_complete'
  | 'last_decay_run_day'
  | 'dev_force_ai_unavailable';
```

- [ ] **Step 1.2: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 1.3: Commit**

```bash
git add src/storage/repositories/settingsRepo.ts
git commit -m "feat(storage): allow dev_force_ai_unavailable setting key"
```

---

## Task 2: Extend `settingsStore` with `devForceAIUnavailable`

**Files:**
- Modify: `src/state/settingsStore.ts` (entire file — add field, setter, hydrate path)
- Test: existing `src/state/__tests__/submitLog.test.ts` indirectly exercises `settingsStore` hydrate; we add no new store unit test here because the new field is plumbing — its behavior is exercised by the `aiServiceFactory` and `SettingsScreen` tests in later tasks.

- [ ] **Step 2.1: Add `devForceAIUnavailable` to the interface and initial state**

```typescript
// src/state/settingsStore.ts — replace file with this content
import { create } from 'zustand';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import { getDb } from '@/storage/db';

export interface SettingsStoreState {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  notificationMorningTime: string;
  decayPaused: boolean;
  firstDecayShown: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  lastDecayRunDay: string | null;
  decayPausedDaysThisYear: number;
  decayPauseStartedAt: string | null;
  devForceAIUnavailable: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  setDecayPaused: (value: boolean) => Promise<void>;
  setFirstDecayShown: (value: boolean) => Promise<void>;
  setLastDecayRunDay: (day: string) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setNotificationMorningTime: (value: string) => Promise<void>;
  setDevForceAIUnavailable: (value: boolean) => Promise<void>;
}

function parseAiSource(raw: string | undefined): 'apple' | 'gemini' | 'mock' | 'none' {
  if (raw === 'apple' || raw === 'gemini' || raw === 'mock') return raw;
  return 'none';
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  onboardingComplete: false,
  notificationsEnabled: false,
  notificationMorningTime: '08:00',
  decayPaused: false,
  firstDecayShown: false,
  aiSourceLastUsed: 'none',
  lastDecayRunDay: null,
  decayPausedDaysThisYear: 0,
  decayPauseStartedAt: null,
  devForceAIUnavailable: false,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const db = await getDb();
    const all = await settingsRepo.getAllSettings(db);
    set({
      onboardingComplete: all['onboarding_complete'] === 'true',
      notificationsEnabled: all['notifications_enabled'] === 'true',
      notificationMorningTime: all['notification_morning_time'] ?? '08:00',
      decayPaused: all['decay_paused'] === 'true',
      firstDecayShown: all['first_decay_shown'] === 'true',
      aiSourceLastUsed: parseAiSource(all['ai_source_last_used']),
      lastDecayRunDay: all['last_decay_run_day'] ?? null,
      decayPausedDaysThisYear: parseInt(all['decay_paused_days_this_year'] ?? '0', 10),
      decayPauseStartedAt: all['decay_pause_started_at'] ?? null,
      devForceAIUnavailable: all['dev_force_ai_unavailable'] === 'true',
      loading: false,
    });
  },

  setOnboardingComplete: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'onboarding_complete', value ? 'true' : 'false');
    set({ onboardingComplete: value });
  },

  setDecayPaused: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'decay_paused', value ? 'true' : 'false');
    set({ decayPaused: value });
  },

  setFirstDecayShown: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'first_decay_shown', value ? 'true' : 'false');
    set({ firstDecayShown: value });
  },

  setLastDecayRunDay: async (day) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'last_decay_run_day', day);
    set({ lastDecayRunDay: day });
  },

  setNotificationsEnabled: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notifications_enabled', value ? 'true' : 'false');
    set({ notificationsEnabled: value });
  },

  setNotificationMorningTime: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'notification_morning_time', value);
    set({ notificationMorningTime: value });
  },

  setDevForceAIUnavailable: async (value) => {
    const db = await getDb();
    await settingsRepo.setSetting(db, 'dev_force_ai_unavailable', value ? 'true' : 'false');
    set({ devForceAIUnavailable: value });
  },
}));
```

- [ ] **Step 2.2: Run typecheck and existing tests**

Run: `npm run typecheck && npm test -- --testPathPattern=submitLog`
Expected: typecheck passes; existing `submitLog.test.ts` still passes (it doesn't touch the new field).

- [ ] **Step 2.3: Commit**

```bash
git add src/state/settingsStore.ts
git commit -m "feat(state): add devForceAIUnavailable to settingsStore"
```

---

## Task 3: Create `aiServiceFactory` (failing test first)

**Files:**
- Create: `src/ai/aiServiceFactory.ts`
- Create: `src/ai/__tests__/aiServiceFactory.test.ts`

- [ ] **Step 3.1: Write failing tests**

```typescript
// src/ai/__tests__/aiServiceFactory.test.ts
import { MockAIService } from '@/ai/MockAIService';
import { useSettingsStore } from '@/state/settingsStore';

import {
  __resetFactoryForTests,
  getAIService,
  probeAIAvailability,
} from '@/ai/aiServiceFactory';

describe('aiServiceFactory', () => {
  beforeEach(() => {
    __resetFactoryForTests();
    // Reset the dev override on each test. Reach into the store directly so we
    // don't hit SQLite (no `getDb` in this jest.config.js node env).
    useSettingsStore.setState({ devForceAIUnavailable: false });
  });

  describe('getAIService', () => {
    it('returns a MockAIService instance', () => {
      const service = getAIService();
      expect(service).toBeInstanceOf(MockAIService);
    });

    it('returns the same instance on repeated calls (cache)', () => {
      const a = getAIService();
      const b = getAIService();
      expect(a).toBe(b);
    });

    it('rebuilds after __resetFactoryForTests', () => {
      const a = getAIService();
      __resetFactoryForTests();
      const b = getAIService();
      expect(a).not.toBe(b);
      expect(b).toBeInstanceOf(MockAIService);
    });
  });

  describe('probeAIAvailability', () => {
    it('returns available=true and Mock displayName when override is off', async () => {
      const result = await probeAIAvailability();
      expect(result).toEqual({ available: true, displayName: 'Mock (development)' });
    });

    it('returns available=false when __DEV__ and devForceAIUnavailable are both true', async () => {
      // jest sets __DEV__ to true by default; verify guard
      expect(__DEV__).toBe(true);
      useSettingsStore.setState({ devForceAIUnavailable: true });
      const result = await probeAIAvailability();
      expect(result.available).toBe(false);
      expect(result.displayName).toBe('Mock (development)');
    });

    it('treats a thrown isAvailable() as unavailable', async () => {
      const service = getAIService();
      const spy = jest
        .spyOn(service, 'isAvailable')
        .mockRejectedValueOnce(new Error('OS API missing'));
      const result = await probeAIAvailability();
      expect(result.available).toBe(false);
      expect(result.displayName).toBe('Mock (development)');
      spy.mockRestore();
    });
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=aiServiceFactory`
Expected: FAIL with `Cannot find module '@/ai/aiServiceFactory'`.

- [ ] **Step 3.3: Implement the factory**

```typescript
// src/ai/aiServiceFactory.ts
import type { AIService } from '@/ai/AIService';
import { MockAIService } from '@/ai/MockAIService';
import { useSettingsStore } from '@/state/settingsStore';

let cached: AIService | null = null;

/**
 * Returns the AI service for the current device. Phase 4: only `MockAIService`
 * exists. Phase 5 branches here on `Platform.OS` to return `AppleAIService`,
 * `GeminiNanoService`, or fall back to Mock — the cache layer is unchanged.
 */
export function getAIService(): AIService {
  if (cached) return cached;
  cached = new MockAIService();
  return cached;
}

export interface ProbeResult {
  available: boolean;
  displayName: string;
}

/**
 * Asks the active service "are you usable right now?" Honors a `__DEV__`-only
 * override from `settingsStore.devForceAIUnavailable` so the developer can
 * exercise the AI-unavailable banner without a real failure. Treats a thrown
 * `isAvailable()` as unavailable (Phase 5: Apple's API can throw if the OS
 * runtime isn't installed).
 */
export async function probeAIAvailability(): Promise<ProbeResult> {
  const service = getAIService();
  if (__DEV__ && useSettingsStore.getState().devForceAIUnavailable) {
    return { available: false, displayName: service.displayName };
  }
  try {
    const available = await service.isAvailable();
    return { available, displayName: service.displayName };
  } catch {
    return { available: false, displayName: service.displayName };
  }
}

/** Test-only: clears the cached service so each test gets a fresh instance. */
export function __resetFactoryForTests(): void {
  cached = null;
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=aiServiceFactory`
Expected: PASS — 5 tests.

- [ ] **Step 3.5: Add coverage threshold for the new file**

Modify `jest.config.js` — extend `coverageThreshold` with the factory:

```javascript
// jest.config.js — inside coverageThreshold, alongside the existing entries
'./src/ai/aiServiceFactory.ts': {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
},
```

- [ ] **Step 3.6: Run coverage check**

Run: `npm test -- --coverage --collectCoverageFrom='src/ai/aiServiceFactory.ts'`
Expected: 100% across all metrics for `aiServiceFactory.ts`.

- [ ] **Step 3.7: Commit**

```bash
git add src/ai/aiServiceFactory.ts src/ai/__tests__/aiServiceFactory.test.ts jest.config.js
git commit -m "feat(ai): add aiServiceFactory with availability probe"
```

---

## Task 4: Create `aiAvailabilityStore`

**Files:**
- Create: `src/state/aiAvailabilityStore.ts`
- Create: `src/state/__tests__/aiAvailabilityStore.test.ts`

- [ ] **Step 4.1: Write failing tests**

```typescript
// src/state/__tests__/aiAvailabilityStore.test.ts
import { __resetFactoryForTests } from '@/ai/aiServiceFactory';
import { useSettingsStore } from '@/state/settingsStore';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

describe('aiAvailabilityStore', () => {
  beforeEach(() => {
    __resetFactoryForTests();
    useSettingsStore.setState({ devForceAIUnavailable: false });
    useAIAvailabilityStore.setState({
      available: true,
      displayName: 'On-device AI',
      lastProbedAt: null,
      probing: false,
    });
  });

  it('initializes with optimistic available=true and a placeholder displayName', () => {
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(true);
    expect(state.displayName).toBe('On-device AI');
    expect(state.lastProbedAt).toBeNull();
    expect(state.probing).toBe(false);
  });

  it('runProbe writes the factory result and timestamps lastProbedAt', async () => {
    const before = Date.now();
    await useAIAvailabilityStore.getState().runProbe();
    const after = Date.now();
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(true);
    expect(state.displayName).toBe('Mock (development)');
    expect(state.probing).toBe(false);
    expect(state.lastProbedAt).not.toBeNull();
    expect(state.lastProbedAt!).toBeGreaterThanOrEqual(before);
    expect(state.lastProbedAt!).toBeLessThanOrEqual(after);
  });

  it('runProbe surfaces unavailability when the dev override is on', async () => {
    useSettingsStore.setState({ devForceAIUnavailable: true });
    await useAIAvailabilityStore.getState().runProbe();
    expect(useAIAvailabilityStore.getState().available).toBe(false);
  });

  it('setAvailability writes fields without calling the factory', () => {
    useAIAvailabilityStore.getState().setAvailability({
      available: false,
      displayName: 'X',
    });
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(false);
    expect(state.displayName).toBe('X');
    expect(state.lastProbedAt).not.toBeNull();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=aiAvailabilityStore`
Expected: FAIL with `Cannot find module '@/state/aiAvailabilityStore'`.

- [ ] **Step 4.3: Implement the store**

```typescript
// src/state/aiAvailabilityStore.ts
import { create } from 'zustand';

import { probeAIAvailability } from '@/ai/aiServiceFactory';

export interface AIAvailabilityState {
  /**
   * Whether the on-device AI is currently usable. Initialized to `true`
   * (optimistic) so the banner doesn't flash on cold start before the first
   * probe completes; flipped to false within a few hundred ms if the probe
   * fails.
   */
  available: boolean;
  /** AI service human-readable name. Overwritten on every probe. */
  displayName: string;
  /** Epoch ms of the most recent probe; null until first probe completes. */
  lastProbedAt: number | null;
  /** True while a probe is in flight. */
  probing: boolean;

  /** Runs the factory probe and writes the result to the store. */
  runProbe: () => Promise<void>;
  /** Test/manual seam — set state directly without running the factory. */
  setAvailability: (next: { available: boolean; displayName: string }) => void;
}

export const useAIAvailabilityStore = create<AIAvailabilityState>((set) => ({
  available: true,
  displayName: 'On-device AI',
  lastProbedAt: null,
  probing: false,

  runProbe: async () => {
    set({ probing: true });
    const result = await probeAIAvailability();
    set({
      available: result.available,
      displayName: result.displayName,
      lastProbedAt: Date.now(),
      probing: false,
    });
  },

  setAvailability: (next) =>
    set({
      available: next.available,
      displayName: next.displayName,
      lastProbedAt: Date.now(),
    }),
}));
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=aiAvailabilityStore`
Expected: PASS — 4 tests.

- [ ] **Step 4.5: Commit**

```bash
git add src/state/aiAvailabilityStore.ts src/state/__tests__/aiAvailabilityStore.test.ts
git commit -m "feat(state): add aiAvailabilityStore"
```

---

## Task 5: Create `useAIAvailabilityProbe` hook

**Files:**
- Create: `src/state/hooks/useAIAvailabilityProbe.ts`
- Create: `src/state/hooks/__tests__/useAIAvailabilityProbe.test.tsx`

- [ ] **Step 5.1: Write failing test**

```typescript
// src/state/hooks/__tests__/useAIAvailabilityProbe.test.tsx
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const addEventListenerMock = jest.fn();
const removeMock = jest.fn();

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    AppState: {
      ...actual.AppState,
      addEventListener: (...args: unknown[]) => {
        addEventListenerMock(...args);
        return { remove: removeMock };
      },
    },
  };
});

const runProbeMock = jest.fn(async () => {});
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: {
    getState: () => ({ runProbe: runProbeMock }),
  },
}));

import { useAIAvailabilityProbe } from '@/state/hooks/useAIAvailabilityProbe';

function Probe() {
  useAIAvailabilityProbe();
  return <Text testID="probe-host">ok</Text>;
}

describe('useAIAvailabilityProbe', () => {
  beforeEach(() => {
    addEventListenerMock.mockClear();
    removeMock.mockClear();
    runProbeMock.mockClear();
  });

  it('runs the probe on mount', async () => {
    render(<Probe />);
    // runProbe is fired inside an effect — let microtasks flush.
    await act(async () => {});
    expect(runProbeMock).toHaveBeenCalledTimes(1);
  });

  it('subscribes to AppState change events', () => {
    render(<Probe />);
    expect(addEventListenerMock).toHaveBeenCalledTimes(1);
    expect(addEventListenerMock.mock.calls[0]?.[0]).toBe('change');
    expect(typeof addEventListenerMock.mock.calls[0]?.[1]).toBe('function');
  });

  it('re-runs the probe when AppState transitions to "active"', async () => {
    render(<Probe />);
    await act(async () => {});
    runProbeMock.mockClear();

    const handler = addEventListenerMock.mock.calls[0]?.[1] as (s: string) => void;
    await act(async () => {
      handler('active');
    });
    expect(runProbeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      handler('background');
    });
    expect(runProbeMock).toHaveBeenCalledTimes(1); // still 1, no extra call

    await act(async () => {
      handler('inactive');
    });
    expect(runProbeMock).toHaveBeenCalledTimes(1); // still 1
  });

  it('removes the listener on unmount', () => {
    const view = render(<Probe />);
    view.unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npm run test:ui -- --testPathPattern=useAIAvailabilityProbe`
Expected: FAIL with `Cannot find module '@/state/hooks/useAIAvailabilityProbe'`.

- [ ] **Step 5.3: Implement the hook**

```typescript
// src/state/hooks/useAIAvailabilityProbe.ts
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Runs the AI-availability probe on mount and on every transition to
 * `'active'`. Mirrors `useAppForegroundDecay` so the two probes share the
 * same lifecycle pattern. The hook does not subscribe reactively to the
 * store — it only calls `runProbe()` via `getState()`, so re-rendering the
 * mounting component does not create extra subscriptions.
 */
export function useAIAvailabilityProbe(): void {
  useEffect(() => {
    void useAIAvailabilityStore.getState().runProbe();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void useAIAvailabilityStore.getState().runProbe();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
```

- [ ] **Step 5.4: Run test to verify it passes**

Run: `npm run test:ui -- --testPathPattern=useAIAvailabilityProbe`
Expected: PASS — 4 tests.

- [ ] **Step 5.5: Commit**

```bash
git add src/state/hooks/useAIAvailabilityProbe.ts src/state/hooks/__tests__/useAIAvailabilityProbe.test.tsx
git commit -m "feat(state): add useAIAvailabilityProbe hook"
```

---

## Task 6: Build `AIUnavailableBanner` component

**Files:**
- Create: `src/ui/components/AIUnavailableBanner.tsx`
- Create: `src/ui/components/__tests__/AIUnavailableBanner.test.tsx`

- [ ] **Step 6.1: Write failing test**

```typescript
// src/ui/components/__tests__/AIUnavailableBanner.test.tsx
import { fireEvent, render } from '@testing-library/react-native';

const openSettingsMock = jest.fn(async () => {});

jest.mock('expo-linking', () => ({
  openSettings: (...args: unknown[]) => openSettingsMock(...args),
}));

interface MockAvailabilityState {
  available: boolean;
  displayName: string;
}

let mockState: MockAvailabilityState = { available: true, displayName: 'Mock (development)' };

jest.mock('@/state/aiAvailabilityStore', () => {
  const useAIAvailabilityStore = jest.fn((selector: (s: unknown) => unknown) => selector(mockState));
  return { useAIAvailabilityStore };
});

import { AIUnavailableBanner } from '@/ui/components/AIUnavailableBanner';

describe('AIUnavailableBanner', () => {
  beforeEach(() => {
    openSettingsMock.mockClear();
    mockState = { available: true, displayName: 'Mock (development)' };
  });

  it('renders nothing when AI is available', () => {
    const { queryByTestId } = render(<AIUnavailableBanner />);
    expect(queryByTestId('ai-unavailable-banner')).toBeNull();
  });

  it('renders title, body, and Open Settings affordance when unavailable', () => {
    mockState = { available: false, displayName: 'Mock (development)' };
    const { getByTestId } = render(<AIUnavailableBanner />);
    expect(getByTestId('ai-unavailable-banner')).toBeTruthy();
    expect(getByTestId('ai-unavailable-banner-title').props.children).toBe(
      'On-device AI is currently unavailable',
    );
    expect(getByTestId('ai-unavailable-banner-body').props.children).toBe(
      'Enable Apple Intelligence in Settings to log activities.',
    );
    expect(getByTestId('ai-unavailable-banner-open-settings')).toBeTruthy();
  });

  it('calls Linking.openSettings when the Open Settings affordance is tapped', () => {
    mockState = { available: false, displayName: 'Mock (development)' };
    const { getByTestId } = render(<AIUnavailableBanner />);
    fireEvent.press(getByTestId('ai-unavailable-banner-open-settings'));
    expect(openSettingsMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npm run test:ui -- --testPathPattern=AIUnavailableBanner`
Expected: FAIL with `Cannot find module '@/ui/components/AIUnavailableBanner'`.

- [ ] **Step 6.3: Implement the banner**

```tsx
// src/ui/components/AIUnavailableBanner.tsx
import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Top-anchored banner that appears when the on-device AI probe reports
 * unavailable. Reads `available` from `aiAvailabilityStore` and renders nothing
 * when AI is reachable. Tapping "Open Settings" dispatches to the OS app
 * settings page via `expo-linking`.
 *
 * Mounted once at the root layout (`app/_layout.tsx`) so it sits above both
 * onboarding and `(main)` route groups without per-screen wiring.
 */
export function AIUnavailableBanner(): React.JSX.Element | null {
  const available = useAIAvailabilityStore((s) => s.available);
  const insets = useSafeAreaInsets();

  if (available) return null;

  const handleOpenSettings = () => {
    void Linking.openSettings();
  };

  return (
    <View
      testID="ai-unavailable-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ paddingTop: insets.top }}
      className="bg-amber-900/40 border-b border-amber-700/60"
    >
      <View className="flex-row items-start gap-3 px-4 py-3">
        <View className="flex-1">
          <Text
            testID="ai-unavailable-banner-title"
            className="font-manrope-bold text-accent"
            style={{ fontSize: 13, lineHeight: 17 }}
          >
            On-device AI is currently unavailable
          </Text>
          <Text
            testID="ai-unavailable-banner-body"
            className="mt-0.5 font-manrope text-text"
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            Enable Apple Intelligence in Settings to log activities.
          </Text>
        </View>
        <TouchableOpacity
          testID="ai-unavailable-banner-open-settings"
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          onPress={handleOpenSettings}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text className="font-manrope-bold text-accent" style={{ fontSize: 13 }}>
            Open Settings →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `npm run test:ui -- --testPathPattern=AIUnavailableBanner`
Expected: PASS — 3 tests.

- [ ] **Step 6.5: Commit**

```bash
git add src/ui/components/AIUnavailableBanner.tsx src/ui/components/__tests__/AIUnavailableBanner.test.tsx
git commit -m "feat(ui): add AIUnavailableBanner component"
```

---

## Task 7: Mount probe + banner in root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 7.1: Add the imports near the top**

Add to existing imports at the top of `app/_layout.tsx`:

```typescript
import { useAIAvailabilityProbe } from '@/state/hooks/useAIAvailabilityProbe';
import { AIUnavailableBanner } from '@/ui/components/AIUnavailableBanner';
```

- [ ] **Step 7.2: Wire the probe and banner into `PostBootShell`**

Replace `PostBootShell` (currently `app/_layout.tsx:30-33`):

```tsx
function PostBootShell(): React.JSX.Element {
  useAppForegroundDecay();
  useAIAvailabilityProbe();
  return (
    <>
      <AIUnavailableBanner />
      <Slot />
    </>
  );
}
```

- [ ] **Step 7.3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: zero errors.

- [ ] **Step 7.4: Run all tests as a smoke pass**

Run: `npm test && npm run test:ui`
Expected: all tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): mount AI availability probe and banner in root layout"
```

---

## Task 8: Disable FAB when AI is unavailable

**Files:**
- Modify: `src/ui/screens/CharacterSheetScreen.tsx:1-131`
- Modify: `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`

- [ ] **Step 8.1: Add the new mocks at the top of `CharacterSheetScreen.test.tsx`**

Insert these blocks just above the existing `import CharacterSheetScreen from '@/ui/screens/CharacterSheetScreen';` line (i.e. alongside the existing `jest.mock(...)` calls). The file currently imports `fireEvent, render` from `@testing-library/react-native` and uses a module-level `mockPush` jest.fn — we will reuse those.

```typescript
const openSettingsMock = jest.fn(async () => {});
jest.mock('expo-linking', () => ({
  openSettings: (...args: unknown[]) => openSettingsMock(...args),
}));

interface MockAvailabilityState {
  available: boolean;
  displayName: string;
}
let mockAvailabilityState: MockAvailabilityState = {
  available: true,
  displayName: 'Mock (development)',
};
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockAvailabilityState),
  ),
}));
```

- [ ] **Step 8.2: Append a new `describe` block at the bottom of the file (inside the outer `describe('CharacterSheetScreen', ...)` is fine)**

```typescript
describe('FAB when AI is unavailable', () => {
  beforeEach(() => {
    openSettingsMock.mockClear();
    mockPush.mockClear();
    mockAvailabilityState = { available: false, displayName: 'Mock (development)' };
  });

  afterEach(() => {
    mockAvailabilityState = { available: true, displayName: 'Mock (development)' };
  });

  it('exposes accessibilityState.disabled = true', () => {
    const { getByTestId } = render(<CharacterSheetScreen />);
    const fab = getByTestId('fab-log');
    expect(fab.props.accessibilityState?.disabled).toBe(true);
  });

  it('opens system Settings on tap, does not navigate to /log', () => {
    const { getByTestId } = render(<CharacterSheetScreen />);
    fireEvent.press(getByTestId('fab-log'));
    expect(openSettingsMock).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8.3: Run test to verify it fails**

Run: `npm run test:ui -- --testPathPattern=CharacterSheetScreen`
Expected: FAIL — `accessibilityState.disabled` is undefined and `openSettings` is not called.

- [ ] **Step 8.4: Update the FAB to react to availability**

In `src/ui/screens/CharacterSheetScreen.tsx`:

1. Add imports near the top alongside existing ones:

```typescript
import * as Linking from 'expo-linking';
import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';
```

2. Inside the component body, add:

```typescript
const aiAvailable = useAIAvailabilityStore((s) => s.available);
```

3. Replace the FAB block (currently `src/ui/screens/CharacterSheetScreen.tsx:118-128`):

```tsx
<TouchableOpacity
  testID="fab-log"
  accessibilityRole="button"
  accessibilityLabel={aiAvailable ? 'Log activity' : 'Open Settings'}
  accessibilityState={{ disabled: !aiAvailable }}
  onPress={() => {
    if (!aiAvailable) {
      void Linking.openSettings();
      return;
    }
    router.push('/(main)/log');
  }}
  className={`absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full ${
    aiAvailable ? 'bg-accent' : 'bg-surface-2 opacity-40'
  }`}
>
  <Text
    className={aiAvailable ? 'font-manrope-bold text-bg' : 'font-manrope-bold text-text-mute'}
    style={{ fontSize: 28, lineHeight: 30 }}
  >
    +
  </Text>
</TouchableOpacity>
```

- [ ] **Step 8.5: Run test to verify it passes**

Run: `npm run test:ui -- --testPathPattern=CharacterSheetScreen`
Expected: PASS — including existing tests and the two new ones.

- [ ] **Step 8.6: Commit**

```bash
git add src/ui/screens/CharacterSheetScreen.tsx src/ui/screens/__tests__/CharacterSheetScreen.test.tsx
git commit -m "feat(ui): disable Character FAB when AI is unavailable"
```

---

## Task 9: Gate `AIConfirmScreen` Continue button on availability

**Files:**
- Modify: `src/ui/screens/onboarding/AIConfirmScreen.tsx:1-56`
- Modify: `src/ui/screens/__tests__/OnboardingScreens.test.tsx`

- [ ] **Step 9.1: Add a failing test for the unavailable branch**

Append this `describe` inside the existing `OnboardingScreens.test.tsx`. If `aiAvailabilityStore` isn't already mocked at the top of the file, add the mock block alongside the existing ones:

```typescript
// At top of file, alongside other jest.mock(...) blocks:
interface MockAvailabilityState {
  available: boolean;
  displayName: string;
}
let mockAvailabilityState: MockAvailabilityState = {
  available: true,
  displayName: 'Mock (development)',
};
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockAvailabilityState),
  ),
}));
```

```typescript
// New describe within the file:
describe('AIConfirmScreen — AI unavailable', () => {
  beforeEach(() => {
    mockAvailabilityState = { available: false, displayName: 'Mock (development)' };
  });

  afterEach(() => {
    mockAvailabilityState = { available: true, displayName: 'Mock (development)' };
  });

  it('switches the engine label to the unavailable copy', () => {
    const { getByTestId } = render(<AIConfirmScreen />);
    expect(getByTestId('ai-confirm-engine').props.children).toBe(
      'Apple Intelligence unavailable',
    );
  });

  it('disables Continue with the resolve copy', () => {
    const { getByTestId } = render(<AIConfirmScreen />);
    const continueBtn = getByTestId('ai-confirm-continue');
    expect(continueBtn.props.accessibilityState?.disabled).toBe(true);
    // Children of TouchableOpacity → first child is the inner Text element
    const innerText = continueBtn.findByProps({ testID: 'ai-confirm-continue-label' });
    expect(innerText.props.children).toBe('Resolve to continue');
  });
});
```

(Add `import AIConfirmScreen from '@/ui/screens/onboarding/AIConfirmScreen';` at the top of the test file if it isn't imported already.)

- [ ] **Step 9.2: Run test to verify it fails**

Run: `npm run test:ui -- --testPathPattern=OnboardingScreens`
Expected: FAIL — `accessibilityState.disabled` undefined; engine label still says `Mock (development)`.

- [ ] **Step 9.3: Update `AIConfirmScreen`**

Replace the file contents with:

```tsx
// src/ui/screens/onboarding/AIConfirmScreen.tsx
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Onboarding step 2 — confirms which AI engine the user is running and notes
 * the on-device privacy story. Reads runtime availability from
 * `aiAvailabilityStore`; if the probe says unavailable (rare, since store-level
 * device filtering covers the common case), the headline switches and the
 * Continue button is disabled until the user resolves the issue (typically by
 * re-enabling Apple Intelligence in iOS Settings — the top-of-screen banner
 * already exposes the deep link).
 */
export default function AIConfirmScreen() {
  const router = useRouter();
  const available = useAIAvailabilityStore((s) => s.available);
  const displayName = useAIAvailabilityStore((s) => s.displayName);

  const handleContinue = () => {
    if (!available) return;
    router.push('/onboarding/creation');
  };

  const engineLabel = available ? displayName : 'Apple Intelligence unavailable';
  const continueLabel = available ? 'Continue' : 'Resolve to continue';

  return (
    <View testID="ai-confirm-screen" className="flex-1 bg-bg px-6 pt-16">
      <View className="flex-1">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 28, lineHeight: 34 }}>
          AI Engine
        </Text>

        <Text
          testID="ai-confirm-engine"
          className={`mt-8 font-manrope-semibold ${available ? 'text-accent' : 'text-text-mute'}`}
          style={{ fontSize: 18 }}
        >
          {engineLabel}
        </Text>

        <Text
          testID="ai-confirm-privacy"
          className="mt-4 font-manrope text-text-mute"
          style={{ fontSize: 15, lineHeight: 22 }}
        >
          Your logs stay on your device. No data leaves your phone.
        </Text>
      </View>

      <View className="mb-12">
        <TouchableOpacity
          testID="ai-confirm-continue"
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: !available }}
          disabled={!available}
          onPress={handleContinue}
          className={`rounded-2xl py-4 ${available ? 'bg-accent' : 'bg-surface-2'}`}
        >
          <Text
            testID="ai-confirm-continue-label"
            className={`text-center font-manrope-bold ${available ? 'text-bg' : 'text-text-mute'}`}
            style={{ fontSize: 16 }}
          >
            {continueLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 9.4: Run test to verify it passes**

Run: `npm run test:ui -- --testPathPattern=OnboardingScreens`
Expected: PASS — including all existing onboarding tests.

- [ ] **Step 9.5: Commit**

```bash
git add src/ui/screens/onboarding/AIConfirmScreen.tsx src/ui/screens/__tests__/OnboardingScreens.test.tsx
git commit -m "feat(ui): gate onboarding Continue on AI availability"
```

---

## Task 10: Add Settings → Developer "Force AI unavailable" toggle

**Files:**
- Modify: `src/ui/screens/SettingsScreen.tsx:130-147`
- Modify: `src/ui/screens/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 10.1: Extend the existing `MockSettingsState` interface and default state**

In `src/ui/screens/__tests__/SettingsScreen.test.tsx`:

1. Add this jest.fn near the top (next to `mockSetNotificationsEnabled`/`mockSetDecayPaused`):

```typescript
const mockSetDevForceAIUnavailable = jest.fn(async () => {});
```

2. Update the existing `MockSettingsState` interface (currently `SettingsScreen.test.tsx:9-15`) by appending two fields:

```typescript
interface MockSettingsState {
  notificationsEnabled: boolean;
  decayPaused: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setDecayPaused: (value: boolean) => Promise<void>;
  devForceAIUnavailable: boolean;
  setDevForceAIUnavailable: (value: boolean) => Promise<void>;
}
```

3. Update `defaultSettingsState` (currently `SettingsScreen.test.tsx:29-35`) by appending two fields:

```typescript
const defaultSettingsState: MockSettingsState = {
  notificationsEnabled: false,
  decayPaused: false,
  aiSourceLastUsed: 'mock',
  setNotificationsEnabled: mockSetNotificationsEnabled,
  setDecayPaused: mockSetDecayPaused,
  devForceAIUnavailable: false,
  setDevForceAIUnavailable: mockSetDevForceAIUnavailable,
};
```

4. Update `beforeEach` (currently `SettingsScreen.test.tsx:56-67`) so the mocked setter is restored every test and the new mock fn is cleared:

```typescript
beforeEach(() => {
  mockSetNotificationsEnabled.mockClear();
  mockSetDecayPaused.mockClear();
  mockSetDevForceAIUnavailable.mockClear();
  mockRunProbe.mockClear();
  mockCharacterState = {
    character: defaultCharacterState.character ? { ...defaultCharacterState.character } : null,
  };
  mockSettingsState = {
    ...defaultSettingsState,
    setNotificationsEnabled: mockSetNotificationsEnabled,
    setDecayPaused: mockSetDecayPaused,
    setDevForceAIUnavailable: mockSetDevForceAIUnavailable,
  };
});
```

5. Add the availability store mock alongside the existing `jest.mock(...)` calls (top of the file, just above `import SettingsScreen from ...`):

```typescript
const mockRunProbe = jest.fn(async () => {});
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: {
    getState: () => ({ runProbe: mockRunProbe }),
  },
}));
```

- [ ] **Step 10.2: Append a new `describe` at the bottom of the outer `describe('SettingsScreen', ...)`**

Test pattern matches the existing Notifications switch test (no `act` wrapping — `fireEvent ... 'valueChange'` works synchronously in RNTL):

```typescript
describe('Developer — Force AI unavailable', () => {
  it('renders the toggle in __DEV__', () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('settings-dev-force-ai-unavailable')).toBeTruthy();
  });

  it('flipping the toggle persists the value and re-runs the probe', async () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent(getByTestId('settings-dev-force-ai-unavailable'), 'valueChange', true);
    // Wait one microtask for the async onValueChange handler to flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSetDevForceAIUnavailable).toHaveBeenCalledTimes(1);
    expect(mockSetDevForceAIUnavailable).toHaveBeenCalledWith(true);
    expect(mockRunProbe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 10.3: Run test to verify it fails**

Run: `npm run test:ui -- --testPathPattern=SettingsScreen`
Expected: FAIL — testID not present, setter never called.

- [ ] **Step 10.4: Update `SettingsScreen.tsx`**

Add imports near the top:

```typescript
import { Switch } from 'react-native';
import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';
```

(`Switch` is already imported in the file — verify before re-adding.)

Inside the component body, alongside the existing `useSettingsStore` selectors, add:

```typescript
const devForceAIUnavailable = useSettingsStore((s) => s.devForceAIUnavailable);
const setDevForceAIUnavailable = useSettingsStore((s) => s.setDevForceAIUnavailable);
```

Replace the existing `__DEV__` Developer section block (currently the bottom of the screen). New block:

```tsx
{__DEV__ ? (
  <Section title="Developer">
    <Pressable
      testID="settings-reset-character"
      accessibilityRole="button"
      onPress={() => {
        // Phase 3: stub. Real implementation arrives in a later phase.
        // eslint-disable-next-line no-console
        console.log('TODO: reset character');
      }}
      className="px-4 py-3"
    >
      <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
        Reset character
      </Text>
    </Pressable>
    <Row
      label="Force AI unavailable"
      testID="settings-dev-force-ai-unavailable-row"
      value={
        <Switch
          testID="settings-dev-force-ai-unavailable"
          value={devForceAIUnavailable}
          onValueChange={(v) => {
            void (async () => {
              await setDevForceAIUnavailable(v);
              await useAIAvailabilityStore.getState().runProbe();
            })();
          }}
        />
      }
    />
  </Section>
) : null}
```

- [ ] **Step 10.5: Run test to verify it passes**

Run: `npm run test:ui -- --testPathPattern=SettingsScreen`
Expected: PASS.

- [ ] **Step 10.6: Final smoke run**

Run: `npm test && npm run test:ui && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 10.7: Commit**

```bash
git add src/ui/screens/SettingsScreen.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx
git commit -m "feat(ui): add dev toggle for forcing AI unavailable"
```

---

## Task 11: Manual verification on device

Not a code task — perform on the user's iPhone via Expo Go after the implementation tasks land.

- [ ] **Step 11.1:** Fresh launch (kill the app, relaunch). Banner is hidden. FAB is the regular gold `+`.

- [ ] **Step 11.2:** Settings tab → Developer → toggle "Force AI unavailable" ON. Within ~1 frame:
  - Top banner appears: "On-device AI is currently unavailable / Enable Apple Intelligence in Settings to log activities. Open Settings →"
  - On Character tab, the FAB is muted (40% opacity) and tapping it opens the iOS Settings app for Questum.

- [ ] **Step 11.3:** Toggle OFF. Banner clears within ~1 frame. FAB returns to gold; tapping opens Log Entry.

- [ ] **Step 11.4:** With toggle ON, force-quit and relaunch — banner still shows on cold start. Toggle OFF, kill, relaunch — banner stays hidden.

- [ ] **Step 11.5:** With toggle ON, navigate to /onboarding (use the dev `Reset character` once it lands, or wipe app data) — `AIConfirmScreen` shows "Apple Intelligence unavailable" headline; Continue is disabled with "Resolve to continue" label.

- [ ] **Step 11.6:** Background the app, flip the toggle off via SQLite directly (or kill + relaunch) is not required — the AppState re-probe path will naturally clear the banner once the override flips. Sufficient confirmation: toggling in Settings clears the banner without leaving the screen.

---

## Acceptance criteria (mirrors the spec)

- [ ] `getAIService()` returns a `MockAIService` instance and is the only place the rest of the app constructs an AI service. (Verify with `grep -n "new MockAIService" src/` — only `aiServiceFactory.ts` should match outside of tests.)
- [ ] `aiAvailabilityStore` reflects the most recent probe; `lastProbedAt` increments per probe.
- [ ] Banner appears on every screen (onboarding included) when `available === false` and disappears within one frame when it flips back to `true`.
- [ ] FAB is visually disabled and routes to `Linking.openSettings()` when unavailable.
- [ ] `AIConfirmScreen` Continue is disabled with "Resolve to continue" copy when unavailable.
- [ ] Settings → Developer toggle flips availability immediately on the device.
- [ ] All Jest and RNTL tests pass; coverage on `src/ai/aiServiceFactory.ts` is 100%.
- [ ] `npm run lint && npm run typecheck` pass with zero warnings.
