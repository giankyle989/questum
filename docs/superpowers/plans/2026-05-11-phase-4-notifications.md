# Phase 4 — Local Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship local notifications — a repeating daily morning reminder at a user-set time and a one-shot day-3 inactivity nudge — driven by a single reconciliation function that keeps the OS schedule aligned with the current settings/state.

**Architecture:** `src/notifications/` houses three files: a pure `notificationCopy.ts` (titles/bodies, `parseHHMM`), a thin `notifications.ts` wrapper around `expo-notifications`, and a `reconcileNotifications.ts` that reads settings + `lastLogDay` and cancels/schedules to match. A `useNotificationSync` hook mounted at the root subscribes to the relevant state and re-runs the reconciler. Settings UI gets a morning-time picker, an inactivity-nudge toggle, and `__DEV__` test buttons.

**Tech Stack:** TypeScript (strict), `expo-notifications`, `@react-native-community/datetimepicker`, Zustand, React Native `AppState` + `Linking`. Jest (node env) for pure logic and the mocked reconciler tests; RNTL (`jest-expo` preset) for hooks and the Settings screen.

**Spec:** `docs/superpowers/specs/2026-05-11-phase-4-notifications-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `expo-notifications` and `@react-native-community/datetimepicker` |
| `app.config.ts` | Modify | Add `expo-notifications` to `plugins` array |
| `src/notifications/notificationCopy.ts` | New | Pure: titles, bodies, `parseHHMM` |
| `src/notifications/__tests__/notificationCopy.test.ts` | New | 100% coverage |
| `jest.config.js` | Modify | Add `notificationCopy.ts` 100% coverage threshold |
| `src/notifications/notifications.ts` | New | `expo-notifications` wrapper: schedule/cancel/permission |
| `src/storage/repositories/settingsRepo.ts` | Modify | Widen `SettingKey` with `'inactivity_nudge_enabled'` |
| `src/state/settingsStore.ts` | Modify | Add `inactivityNudgeEnabled` + setter; change `setNotificationsEnabled` return to `{ permissionDenied: boolean }` |
| `src/state/__tests__/submitLog.test.ts` | (none) | Unaffected — existing tests don't touch settings store flags |
| `src/notifications/reconcileNotifications.ts` | New | Pure-ish reconciler reading state into OS schedule |
| `src/notifications/__tests__/reconcileNotifications.test.ts` | New | Mocked-API tests |
| `src/state/hooks/useNotificationSync.ts` | New | Subscribe to relevant state + AppState; run reconciler |
| `src/state/hooks/__tests__/useNotificationSync.test.tsx` | New | RNTL hook test |
| `src/ui/screens/SettingsScreen.tsx` | Modify | Morning-time picker row, nudge toggle, permission-denied label, dev test buttons |
| `src/ui/screens/__tests__/SettingsScreen.test.tsx` | Modify | New test cases |
| `app/_layout.tsx` | Modify | Mount `useNotificationSync` in `PostBootShell` |

---

## Task 1: Install dependencies and wire the Expo plugin

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.config.ts`

- [ ] **Step 1.1: Install dependencies via Expo's compatible-version installer**

Run:
```
npx expo install expo-notifications @react-native-community/datetimepicker
```

`npx expo install` resolves the SDK-compatible versions of each package and updates `package.json` + `package-lock.json`. This is preferred over `npm install` for Expo-managed packages.

Expected: both packages added to `dependencies` with version ranges compatible with the installed Expo SDK.

- [ ] **Step 1.2: Add the `expo-notifications` plugin to `app.config.ts`**

Edit `app.config.ts`. Replace the existing `plugins` line:

```typescript
plugins: ['expo-router', 'expo-font', 'expo-sqlite'],
```

with:

```typescript
plugins: ['expo-router', 'expo-font', 'expo-sqlite', 'expo-notifications'],
```

- [ ] **Step 1.3: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 1.4: Verify all existing tests still pass**

Run: `npm test && npm run test:ui`
Expected: all suites pass — no behavior changed.

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json app.config.ts
git commit -m "build(deps): add expo-notifications and datetimepicker"
```

The pre-commit hook re-runs lint + typecheck.

---

## Task 2: Pure `notificationCopy.ts` (titles, bodies, parseHHMM)

**Files:**
- Create: `src/notifications/notificationCopy.ts`
- Create: `src/notifications/__tests__/notificationCopy.test.ts`
- Modify: `jest.config.js` — add 100% coverage threshold

- [ ] **Step 2.1: Write failing tests**

Create `src/notifications/__tests__/notificationCopy.test.ts`:

```typescript
import {
  dailyMorningCopy,
  inactivityNudgeCopy,
  parseHHMM,
} from '@/notifications/notificationCopy';

describe('notificationCopy', () => {
  describe('dailyMorningCopy', () => {
    it('returns the daily-morning title and body', () => {
      expect(dailyMorningCopy()).toEqual({
        title: 'Time to log your day',
        body: 'What did you do? A quick log keeps your character growing.',
      });
    });
  });

  describe('inactivityNudgeCopy', () => {
    it('returns the inactivity-nudge title and body', () => {
      expect(inactivityNudgeCopy()).toEqual({
        title: 'Your character is waiting',
        body: "It's been a few days. Got something to log?",
      });
    });
  });

  describe('parseHHMM', () => {
    it('parses standard times', () => {
      expect(parseHHMM('07:30')).toEqual({ hour: 7, minute: 30 });
    });

    it('parses midnight', () => {
      expect(parseHHMM('00:00')).toEqual({ hour: 0, minute: 0 });
    });

    it('parses end of day', () => {
      expect(parseHHMM('23:59')).toEqual({ hour: 23, minute: 59 });
    });

    it('throws on malformed input', () => {
      expect(() => parseHHMM('not-a-time')).toThrow();
      expect(() => parseHHMM('25:00')).toThrow();
      expect(() => parseHHMM('07:60')).toThrow();
      expect(() => parseHHMM('7:30')).toThrow(); // requires zero-padding
      expect(() => parseHHMM('')).toThrow();
    });
  });
});
```

- [ ] **Step 2.2: Run tests, verify failure**

Run: `npm test -- --testPathPattern=notificationCopy`
Expected: FAIL with `Cannot find module '@/notifications/notificationCopy'`.

- [ ] **Step 2.3: Implement**

Create `src/notifications/notificationCopy.ts`:

```typescript
/**
 * Pure copy strings + a small parser for the "HH:MM" time format used in the
 * settings store. Kept separate from `notifications.ts` so the strings can be
 * unit-tested without pulling in `expo-notifications` (which doesn't load in
 * the node-env jest runner).
 */

export const dailyMorningCopy = (): { title: string; body: string } => ({
  title: 'Time to log your day',
  body: 'What did you do? A quick log keeps your character growing.',
});

export const inactivityNudgeCopy = (): { title: string; body: string } => ({
  title: 'Your character is waiting',
  body: "It's been a few days. Got something to log?",
});

const HHMM_RE = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

export function parseHHMM(s: string): { hour: number; minute: number } {
  const match = HHMM_RE.exec(s);
  if (!match) {
    throw new Error(`parseHHMM: invalid HH:MM string ${JSON.stringify(s)}`);
  }
  // Regex groups are guaranteed by the match above.
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
```

- [ ] **Step 2.4: Run tests, verify pass**

Run: `npm test -- --testPathPattern=notificationCopy`
Expected: 8 tests pass total.

- [ ] **Step 2.5: Add 100% coverage threshold**

Edit `jest.config.js`. Find the existing `coverageThreshold` block. Add this entry alongside the existing 100% targets:

```javascript
'./src/notifications/notificationCopy.ts': {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
},
```

Use Edit tool with a unique anchor (e.g., the existing `'./src/game/streakMilestone.ts'` block).

- [ ] **Step 2.6: Verify 100% coverage**

Run: `npm test -- --coverage --collectCoverageFrom='src/notifications/notificationCopy.ts'`
Expected: `notificationCopy.ts | 100 | 100 | 100 | 100 |`.

- [ ] **Step 2.7: Commit**

```bash
git add src/notifications/notificationCopy.ts src/notifications/__tests__/notificationCopy.test.ts jest.config.js
git commit -m "feat(notifications): add pure notificationCopy + parseHHMM"
```

---

## Task 3: `notifications.ts` wrapper around `expo-notifications`

**Files:**
- Create: `src/notifications/notifications.ts`

No dedicated test file. The wrapper is exercised by `reconcileNotifications.test.ts` (Task 6) and `SettingsScreen.test.tsx` (Task 9), both of which mock `expo-notifications` directly. The wrapper's job is just to normalize identifiers and copy.

- [ ] **Step 3.1: Implement**

Create `src/notifications/notifications.ts`:

```typescript
import * as Notifications from 'expo-notifications';

import {
  dailyMorningCopy,
  inactivityNudgeCopy,
  parseHHMM,
} from '@/notifications/notificationCopy';

const ID_DAILY_MORNING = 'daily-morning';
const ID_INACTIVITY_NUDGE = 'inactivity-nudge';

export async function requestPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function getPermissionStatus(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function scheduleDailyMorning(morningTime: string): Promise<void> {
  const { hour, minute } = parseHHMM(morningTime);
  const { title, body } = dailyMorningCopy();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_DAILY_MORNING,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyMorning(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID_DAILY_MORNING);
}

export async function scheduleInactivityNudge(target: Date): Promise<void> {
  const { title, body } = inactivityNudgeCopy();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_INACTIVITY_NUDGE,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

export async function cancelInactivityNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID_INACTIVITY_NUDGE);
}

export async function cancelAll(): Promise<void> {
  await cancelDailyMorning();
  await cancelInactivityNudge();
}

/**
 * Dev-only: fires a daily-morning-style notification 5 seconds from now so the
 * developer can verify the flow without changing the system clock.
 */
export async function fireTestDaily(): Promise<void> {
  const { title, body } = dailyMorningCopy();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}

/** Dev-only: fires an inactivity-nudge-style notification 5 seconds from now. */
export async function fireTestNudge(): Promise<void> {
  const { title, body } = inactivityNudgeCopy();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}
```

- [ ] **Step 3.2: Verify typecheck**

Run: `npm run typecheck`
Expected: zero errors.

If TypeScript complains about `SchedulableTriggerInputTypes`, check the installed `expo-notifications` version's exported types. The `CALENDAR` and `DATE` enum values are part of the SDK 50+ API. If a version mismatch shows up, the fix is to install the SDK-compatible version (already done via `npx expo install` in Task 1). Report any error verbatim.

- [ ] **Step 3.3: Commit**

```bash
git add src/notifications/notifications.ts
git commit -m "feat(notifications): add expo-notifications wrapper"
```

The pre-commit hook re-runs lint + typecheck.

---

## Task 4: Widen `SettingKey` union with `inactivity_nudge_enabled`

**Files:**
- Modify: `src/storage/repositories/settingsRepo.ts:3-14`

- [ ] **Step 4.1: Add the new key to the union**

Replace the existing `SettingKey` union:

```typescript
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
  | 'dev_force_ai_unavailable'
  | 'inactivity_nudge_enabled';
```

- [ ] **Step 4.2: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/storage/repositories/settingsRepo.ts
git commit -m "feat(storage): allow inactivity_nudge_enabled setting key"
```

---

## Task 5: Extend `settingsStore` with `inactivityNudgeEnabled` + change `setNotificationsEnabled` return

**Files:**
- Modify: `src/state/settingsStore.ts`

This is a breaking signature change to `setNotificationsEnabled` — it now returns `Promise<{ permissionDenied: boolean }>` instead of `Promise<void>`. The only existing call site (`SettingsScreen.tsx`) will be updated in Task 9.

- [ ] **Step 5.1: Read the current `settingsStore.ts`**

Use Read first to confirm the current shape — the prior sub-projects extended this file, so the exact line numbers may have drifted from the spec.

- [ ] **Step 5.2: Update the interface**

In `src/state/settingsStore.ts`, modify the `SettingsStoreState` interface:

1. Change the `setNotificationsEnabled` signature:

```typescript
// OLD:
setNotificationsEnabled: (value: boolean) => Promise<void>;
// NEW:
setNotificationsEnabled: (value: boolean) => Promise<{ permissionDenied: boolean }>;
```

2. Add two new fields at appropriate locations in the interface:

```typescript
inactivityNudgeEnabled: boolean;
setInactivityNudgeEnabled: (value: boolean) => Promise<void>;
```

- [ ] **Step 5.3: Update the initial state and hydrate**

In the `create<SettingsStoreState>(...)` initial state object, add:

```typescript
inactivityNudgeEnabled: false,
```

In `hydrate()`, add to the `set({...})` payload:

```typescript
inactivityNudgeEnabled: all['inactivity_nudge_enabled'] === 'true',
```

- [ ] **Step 5.4: Add the new import for the notifications wrapper**

Near the existing imports in `src/state/settingsStore.ts`, add:

```typescript
import { requestPermission } from '@/notifications/notifications';
```

- [ ] **Step 5.5: Replace `setNotificationsEnabled` implementation**

Replace the existing setter:

```typescript
setNotificationsEnabled: async (value) => {
  if (value) {
    const granted = await requestPermission();
    if (!granted) {
      // Stay OFF — don't persist a "true" state we can't honor.
      return { permissionDenied: true };
    }
  }
  const db = await getDb();
  await settingsRepo.setSetting(db, 'notifications_enabled', value ? 'true' : 'false');
  set({ notificationsEnabled: value });
  return { permissionDenied: false };
},
```

- [ ] **Step 5.6: Add `setInactivityNudgeEnabled` setter**

Append to the store object (near the other setters):

```typescript
setInactivityNudgeEnabled: async (value) => {
  const db = await getDb();
  await settingsRepo.setSetting(db, 'inactivity_nudge_enabled', value ? 'true' : 'false');
  set({ inactivityNudgeEnabled: value });
},
```

- [ ] **Step 5.7: Verify typecheck**

Run: `npm run typecheck`
Expected: ONE error in `src/ui/screens/SettingsScreen.tsx` because the existing `onValueChange` for `setNotificationsEnabled` discards the returned promise without using it. We'll fix that in Task 9. For now, an explicit `void` cast or `// @ts-expect-error` line is NOT the right approach — we need a clean intermediate state. The fix: change the existing SettingsScreen call site temporarily to `void setNotificationsEnabled(v);` which still works because the new signature returns a Promise (any Promise discardable via `void`).

Confirm the actual change in `SettingsScreen.tsx` is already `void setNotificationsEnabled(v);` (no destructure). If yes, typecheck should be clean. If not, this task may need a 5.7b sub-step to keep the discard explicit.

Actually read `src/ui/screens/SettingsScreen.tsx:105-107` — the current line is:

```typescript
onValueChange={(v) => {
  void setNotificationsEnabled(v);
}}
```

The `void` operator works on any promise, including one resolving to an object. So typecheck stays clean — the `void` consumes the new return type.

- [ ] **Step 5.8: Run all node tests**

Run: `npm test`
Expected: all suites pass. The existing `submitLog.test.ts` mocks the settings store, so the signature change doesn't propagate.

- [ ] **Step 5.9: Run all UI tests**

Run: `npm run test:ui`
Expected: all suites pass — the existing `SettingsScreen.test.tsx` calls `setNotificationsEnabled` via the toggle and `mockSetNotificationsEnabled` is a jest.fn that returns `undefined` (which is a valid resolved value for any Promise return type).

- [ ] **Step 5.10: Commit**

```bash
git add src/state/settingsStore.ts
git commit -m "feat(state): add inactivityNudgeEnabled + permission-aware setNotificationsEnabled"
```

The pre-commit hook re-runs lint + typecheck.

---

## Task 6: `reconcileNotifications.ts` reconciler (TDD)

**Files:**
- Create: `src/notifications/reconcileNotifications.ts`
- Create: `src/notifications/__tests__/reconcileNotifications.test.ts`

- [ ] **Step 6.1: Write failing tests**

Create `src/notifications/__tests__/reconcileNotifications.test.ts`:

```typescript
const mockScheduleDailyMorning = jest.fn().mockResolvedValue(undefined);
const mockCancelDailyMorning = jest.fn().mockResolvedValue(undefined);
const mockScheduleInactivityNudge = jest.fn().mockResolvedValue(undefined);
const mockCancelInactivityNudge = jest.fn().mockResolvedValue(undefined);

jest.mock('@/notifications/notifications', () => ({
  scheduleDailyMorning: (...args: unknown[]) => mockScheduleDailyMorning(...args),
  cancelDailyMorning: (...args: unknown[]) => mockCancelDailyMorning(...args),
  scheduleInactivityNudge: (...args: unknown[]) => mockScheduleInactivityNudge(...args),
  cancelInactivityNudge: (...args: unknown[]) => mockCancelInactivityNudge(...args),
}));

import { reconcileNotifications } from '@/notifications/reconcileNotifications';

const FIXED_NOW = new Date('2026-05-11T12:00:00').getTime();

describe('reconcileNotifications', () => {
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    mockScheduleDailyMorning.mockClear();
    mockCancelDailyMorning.mockClear();
    mockScheduleInactivityNudge.mockClear();
    mockCancelInactivityNudge.mockClear();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('cancels everything when permission is not granted', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-09',
      permissionGranted: false,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).not.toHaveBeenCalled();
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('cancels everything when master toggle is off', async () => {
    await reconcileNotifications({
      notificationsEnabled: false,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-09',
      permissionGranted: true,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).not.toHaveBeenCalled();
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('schedules daily-morning only when nudge is off', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '07:30',
      lastLogDay: '2026-05-09',
      permissionGranted: true,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('07:30');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('schedules both when nudge is on and lastLogDay is set', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockScheduleInactivityNudge).toHaveBeenCalledTimes(1);
    const target: Date = mockScheduleInactivityNudge.mock.calls[0]![0];
    expect(target).toBeInstanceOf(Date);
    expect(target.getFullYear()).toBe(2026);
    expect(target.getMonth()).toBe(4); // May (0-indexed)
    expect(target.getDate()).toBe(13); // 2026-05-10 + 3
    expect(target.getHours()).toBe(8);
    expect(target.getMinutes()).toBe(0);
  });

  it('schedules daily-morning but skips nudge when lastLogDay is null', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: null,
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('skips inactivity nudge when computed target is in the past', async () => {
    // FIXED_NOW is 2026-05-11. lastLogDay 2026-05-01 + 3 days = 2026-05-04 → past.
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-01',
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('idempotency: calling twice with same inputs schedules twice (cancel + reschedule)', async () => {
    const input = {
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    };
    await reconcileNotifications(input);
    await reconcileNotifications(input);
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockScheduleDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(2);
    expect(mockScheduleInactivityNudge).toHaveBeenCalledTimes(2);
  });

  it('time change reschedules daily-morning with the new time', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '08:00',
      lastLogDay: null,
      permissionGranted: true,
    });
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '09:15',
      lastLogDay: null,
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockScheduleDailyMorning.mock.calls[0]![0]).toBe('08:00');
    expect(mockScheduleDailyMorning.mock.calls[1]![0]).toBe('09:15');
  });
});
```

- [ ] **Step 6.2: Run tests, verify failure**

Run: `npm test -- --testPathPattern=reconcileNotifications`
Expected: FAIL — `Cannot find module '@/notifications/reconcileNotifications'`.

- [ ] **Step 6.3: Implement**

Create `src/notifications/reconcileNotifications.ts`:

```typescript
import type { ISODate } from '@/game/calendar';
import { parseHHMM } from '@/notifications/notificationCopy';
import {
  cancelDailyMorning,
  cancelInactivityNudge,
  scheduleDailyMorning,
  scheduleInactivityNudge,
} from '@/notifications/notifications';

export interface ReconcileInput {
  notificationsEnabled: boolean;
  inactivityNudgeEnabled: boolean;
  /** "HH:MM" format. */
  morningTime: string;
  lastLogDay: ISODate | null;
  permissionGranted: boolean;
}

/**
 * Brings the OS notification schedule into alignment with the current settings.
 *
 * Always cancels both notifications first, then re-schedules whichever should
 * exist. This is wasteful in the no-change case (one extra cancel each), but
 * the simplicity is worth it — there's no cheap way to inspect existing
 * scheduled triggers, so we treat each call as authoritative.
 *
 * Pure-ish: every external effect is mocked at the `notifications` boundary.
 */
export async function reconcileNotifications(input: ReconcileInput): Promise<void> {
  // No permission OR master toggle off → cancel everything.
  if (!input.permissionGranted || !input.notificationsEnabled) {
    await cancelDailyMorning();
    await cancelInactivityNudge();
    return;
  }

  // Daily morning: always cancel + reschedule.
  await cancelDailyMorning();
  await scheduleDailyMorning(input.morningTime);

  // Inactivity nudge: only when enabled AND we have a lastLogDay.
  await cancelInactivityNudge();
  if (!input.inactivityNudgeEnabled || input.lastLogDay === null) {
    return;
  }

  const target = computeInactivityTarget(input.lastLogDay, input.morningTime);
  if (target.getTime() <= Date.now()) {
    // Stale target — don't fire a notification for a date already past.
    return;
  }

  await scheduleInactivityNudge(target);
}

/**
 * Computes the Date at which the inactivity nudge should fire:
 * `lastLogDay + 3 calendar days` at `morningTime` in device local TZ.
 */
function computeInactivityTarget(lastLogDay: ISODate, morningTime: string): Date {
  const { hour, minute } = parseHHMM(morningTime);
  const [yStr, mStr, dStr] = lastLogDay.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1; // 0-indexed
  const day = Number(dStr);
  return new Date(year, month, day + 3, hour, minute, 0, 0);
}
```

- [ ] **Step 6.4: Run tests, verify pass**

Run: `npm test -- --testPathPattern=reconcileNotifications`
Expected: 8 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add src/notifications/reconcileNotifications.ts src/notifications/__tests__/reconcileNotifications.test.ts
git commit -m "feat(notifications): add reconcileNotifications reconciler"
```

---

## Task 7: `useNotificationSync` hook (TDD)

**Files:**
- Create: `src/state/hooks/useNotificationSync.ts`
- Create: `src/state/hooks/__tests__/useNotificationSync.test.tsx`

- [ ] **Step 7.1: Write failing test**

Create `src/state/hooks/__tests__/useNotificationSync.test.tsx`:

```typescript
import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Text } from 'react-native';

const mockReconcile = jest.fn().mockResolvedValue(undefined);
jest.mock('@/notifications/reconcileNotifications', () => ({
  reconcileNotifications: (...args: unknown[]) => mockReconcile(...args),
}));

const mockGetPermissionStatus = jest.fn().mockResolvedValue(true);
jest.mock('@/notifications/notifications', () => ({
  getPermissionStatus: () => mockGetPermissionStatus(),
}));

interface MockSettingsState {
  notificationsEnabled: boolean;
  inactivityNudgeEnabled: boolean;
  notificationMorningTime: string;
}

interface MockLogsState {
  lastSubmitResult: unknown;
}

let mockSettingsState: MockSettingsState = {
  notificationsEnabled: true,
  inactivityNudgeEnabled: false,
  notificationMorningTime: '08:00',
};
let mockLogsState: MockLogsState = { lastSubmitResult: null };

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockSettingsState)),
}));
jest.mock('@/state/logsStore', () => ({
  useLogsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
}));

const mockRemove = jest.fn();
const mockAddEventListener = jest
  .spyOn(AppState, 'addEventListener')
  .mockReturnValue({ remove: mockRemove } as unknown as ReturnType<typeof AppState.addEventListener>);

import * as logRepo from '@/storage/repositories/logRepo';
import { useNotificationSync } from '@/state/hooks/useNotificationSync';

jest.spyOn(logRepo, 'getLastLogDay').mockResolvedValue('2026-05-10');
jest.mock('@/storage/db', () => ({
  getDb: () => Promise.resolve({}),
}));

function Probe() {
  useNotificationSync();
  return <Text testID="probe">ok</Text>;
}

describe('useNotificationSync', () => {
  beforeEach(() => {
    mockReconcile.mockClear();
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
    mockGetPermissionStatus.mockClear();
    mockGetPermissionStatus.mockResolvedValue(true);
    mockAddEventListener.mockReturnValue({
      remove: mockRemove,
    } as unknown as ReturnType<typeof AppState.addEventListener>);
    mockSettingsState = {
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      notificationMorningTime: '08:00',
    };
    mockLogsState = { lastSubmitResult: null };
  });

  it('runs reconcileNotifications on mount with current state', async () => {
    render(<Probe />);
    await act(async () => {});
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile.mock.calls[0]![0]).toMatchObject({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    });
  });

  it('subscribes to AppState change events', () => {
    render(<Probe />);
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('re-runs reconcileNotifications on AppState "active"', async () => {
    render(<Probe />);
    await act(async () => {});
    mockReconcile.mockClear();
    const handler = mockAddEventListener.mock.calls[0]![1] as (s: string) => void;
    await act(async () => {
      handler('active');
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-run on AppState "background"', async () => {
    render(<Probe />);
    await act(async () => {});
    mockReconcile.mockClear();
    const handler = mockAddEventListener.mock.calls[0]![1] as (s: string) => void;
    await act(async () => {
      handler('background');
    });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('removes the AppState listener on unmount', () => {
    const view = render(<Probe />);
    view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7.2: Run test, verify failure**

Run: `npm run test:ui -- --testPathPattern=useNotificationSync`
Expected: FAIL with `Cannot find module '@/state/hooks/useNotificationSync'`.

- [ ] **Step 7.3: Implement the hook**

Create `src/state/hooks/useNotificationSync.ts`:

```typescript
import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getPermissionStatus } from '@/notifications/notifications';
import { reconcileNotifications } from '@/notifications/reconcileNotifications';
import { useLogsStore } from '@/state/logsStore';
import { useSettingsStore } from '@/state/settingsStore';
import { getDb } from '@/storage/db';
import * as logRepo from '@/storage/repositories/logRepo';

/**
 * Mounted once in the root layout. Keeps the OS notification schedule aligned
 * with the current settings store + last-log-day state. Re-runs on:
 *   - mount (after settings hydrate)
 *   - any change to the four settings fields the reconciler cares about
 *   - logsStore.lastSubmitResult change (proxy for "log just landed")
 *   - AppState transition to 'active' (catches OS-level permission revocation)
 *
 * The hook never throws — reconcileNotifications absorbs notification errors
 * silently via the wrapper layer.
 */
export function useNotificationSync(): void {
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const inactivityNudgeEnabled = useSettingsStore((s) => s.inactivityNudgeEnabled);
  const morningTime = useSettingsStore((s) => s.notificationMorningTime);
  const lastSubmitResult = useLogsStore((s) => s.lastSubmitResult);

  const sync = useCallback(async () => {
    const db = await getDb();
    const lastLogDay = await logRepo.getLastLogDay(db);
    const permissionGranted = await getPermissionStatus();
    await reconcileNotifications({
      notificationsEnabled,
      inactivityNudgeEnabled,
      morningTime,
      lastLogDay,
      permissionGranted,
    });
  }, [notificationsEnabled, inactivityNudgeEnabled, morningTime]);

  useEffect(() => {
    void sync();
  }, [sync, lastSubmitResult]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void sync();
      }
    });
    return () => subscription.remove();
  }, [sync]);
}
```

- [ ] **Step 7.4: Run test, verify pass**

Run: `npm run test:ui -- --testPathPattern=useNotificationSync`
Expected: 5 tests pass.

If the AppState mock from earlier sub-projects collides, double-check that the spy is initialized BEFORE the import of `useNotificationSync`. The test above places `jest.spyOn(AppState, 'addEventListener')` between the `jest.mock(...)` calls and the import — same pattern as `useAIAvailabilityProbe.test.tsx`. If failures persist, mirror that file's structure exactly.

- [ ] **Step 7.5: Commit**

```bash
git add src/state/hooks/useNotificationSync.ts src/state/hooks/__tests__/useNotificationSync.test.tsx
git commit -m "feat(state): add useNotificationSync hook"
```

The pre-commit hook re-runs lint + typecheck.

---

## Task 8: Mount `useNotificationSync` in root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 8.1: Add the import**

In `app/_layout.tsx`, add alongside existing `@/` imports:

```typescript
import { useNotificationSync } from '@/state/hooks/useNotificationSync';
```

- [ ] **Step 8.2: Call the hook in `PostBootShell`**

In the `PostBootShell` function, add the hook call below the existing ones:

```tsx
function PostBootShell(): React.JSX.Element {
  useAppForegroundDecay();
  useAIAvailabilityProbe();
  useNotificationSync();
  return (
    <>
      <AIUnavailableBanner />
      <Slot />
      <AnimationOrchestrator />
    </>
  );
}
```

- [ ] **Step 8.3: Verify typecheck + lint**

Run:
```
npm run typecheck
npm run lint
```
Both must succeed.

- [ ] **Step 8.4: Run all tests as a smoke pass**

Run:
```
npm test
npm run test:ui
```
All must pass.

- [ ] **Step 8.5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): mount useNotificationSync in root layout"
```

---

## Task 9: SettingsScreen — morning-time picker, nudge toggle, dev test buttons, permission-denied label (TDD)

**Files:**
- Modify: `src/ui/screens/SettingsScreen.tsx`
- Modify: `src/ui/screens/__tests__/SettingsScreen.test.tsx`

### Step 9.1: Extend `SettingsScreen.test.tsx` with new mocks and tests

Read the file first. Then add the following mocks at the top, alongside the existing `jest.mock(...)` calls (variable names MUST start with `mock` per jest hoisting):

```typescript
const mockFireTestDaily = jest.fn().mockResolvedValue(undefined);
const mockFireTestNudge = jest.fn().mockResolvedValue(undefined);
jest.mock('@/notifications/notifications', () => ({
  fireTestDaily: () => mockFireTestDaily(),
  fireTestNudge: () => mockFireTestNudge(),
  // The real exports requestPermission/getPermissionStatus are not called by
  // SettingsScreen directly — they go through settingsStore.setNotificationsEnabled.
}));

const mockDateTimePicker = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockDateTimePicker(props);
      return React.createElement('DateTimePickerMock', { testID: 'datetimepicker' });
    },
  };
});
```

Update the existing `MockSettingsState` interface to include the new fields and the changed setter signature:

```typescript
interface MockSettingsState {
  // ... existing fields ...
  notificationMorningTime: string;
  inactivityNudgeEnabled: boolean;
  setNotificationMorningTime: (value: string) => Promise<void>;
  setInactivityNudgeEnabled: (value: boolean) => Promise<void>;
}
```

Update the jest.fn pool near the top of the file (alongside `mockSetNotificationsEnabled` / `mockSetDecayPaused`):

```typescript
const mockSetNotificationMorningTime = jest.fn().mockResolvedValue(undefined);
const mockSetInactivityNudgeEnabled = jest.fn().mockResolvedValue(undefined);
```

Change `mockSetNotificationsEnabled` to return `{ permissionDenied: false }` by default, since the setter's new signature returns an object:

```typescript
const mockSetNotificationsEnabled = jest.fn().mockResolvedValue({ permissionDenied: false });
```

Update `defaultSettingsState`:

```typescript
const defaultSettingsState: MockSettingsState = {
  // ... existing fields ...
  notificationMorningTime: '08:00',
  inactivityNudgeEnabled: false,
  setNotificationMorningTime: mockSetNotificationMorningTime,
  setInactivityNudgeEnabled: mockSetInactivityNudgeEnabled,
};
```

Update `beforeEach` to clear the new jest.fns and restore default state.

Add this new `describe` block at the bottom of the existing outer `describe('SettingsScreen', ...)`:

```typescript
describe('Notifications — morning time and nudge', () => {
  beforeEach(() => {
    mockFireTestDaily.mockClear();
    mockFireTestNudge.mockClear();
    mockDateTimePicker.mockClear();
    mockSetNotificationMorningTime.mockClear();
    mockSetInactivityNudgeEnabled.mockClear();
    mockSetNotificationsEnabled.mockClear();
  });

  it('renders the morning time row in disabled state when notifications are off', () => {
    const { getByTestId } = render(<SettingsScreen />);
    const row = getByTestId('settings-morning-time-row');
    expect(row.props.accessibilityState?.disabled).toBe(true);
  });

  it('renders the morning time row enabled when notifications are on', () => {
    mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
    const { getByTestId } = render(<SettingsScreen />);
    const row = getByTestId('settings-morning-time-row');
    expect(row.props.accessibilityState?.disabled).toBe(false);
  });

  it('tapping the enabled morning time row opens the picker', () => {
    mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
    const { getByTestId, queryByTestId } = render(<SettingsScreen />);
    expect(queryByTestId('datetimepicker')).toBeNull();
    fireEvent.press(getByTestId('settings-morning-time-row'));
    expect(getByTestId('datetimepicker')).toBeTruthy();
  });

  it('renders the inactivity nudge toggle disabled when notifications are off', () => {
    const { getByTestId } = render(<SettingsScreen />);
    const switchEl = getByTestId('settings-inactivity-nudge-switch');
    expect(switchEl.props.disabled).toBe(true);
  });

  it('flipping the inactivity nudge toggle calls setInactivityNudgeEnabled', () => {
    mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent(getByTestId('settings-inactivity-nudge-switch'), 'valueChange', true);
    expect(mockSetInactivityNudgeEnabled).toHaveBeenCalledWith(true);
  });

  it('shows the permission-denied label when setNotificationsEnabled returns permissionDenied: true', async () => {
    mockSetNotificationsEnabled.mockResolvedValueOnce({ permissionDenied: true });
    const { getByTestId, queryByTestId } = render(<SettingsScreen />);
    expect(queryByTestId('settings-notifications-permission-denied')).toBeNull();
    await act(async () => {
      fireEvent(getByTestId('settings-notifications-switch'), 'valueChange', true);
    });
    // Wait one microtask for the async handler.
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByTestId('settings-notifications-permission-denied')).toBeTruthy();
  });
});

describe('Developer — notification test buttons', () => {
  beforeEach(() => {
    mockFireTestDaily.mockClear();
    mockFireTestNudge.mockClear();
  });

  it('fires the test daily notification', () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId('settings-dev-test-daily'));
    expect(mockFireTestDaily).toHaveBeenCalledTimes(1);
  });

  it('fires the test inactivity nudge', () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId('settings-dev-test-nudge'));
    expect(mockFireTestNudge).toHaveBeenCalledTimes(1);
  });
});
```

Note: `act` needs to be imported from `@testing-library/react-native` — if it's not already in the test file's imports, add it.

### Step 9.2: Run tests, verify failure

Run: `npm run test:ui -- --testPathPattern=SettingsScreen`
Expected: FAIL — the new testIDs don't exist yet, and the picker mock isn't reached.

### Step 9.3: Update `SettingsScreen.tsx`

In `src/ui/screens/SettingsScreen.tsx`:

1. Add imports near the top, alongside existing imports:

```typescript
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { fireTestDaily, fireTestNudge } from '@/notifications/notifications';
```

2. Inside the component body, alongside existing selectors, add:

```typescript
const notificationMorningTime = useSettingsStore((s) => s.notificationMorningTime);
const setNotificationMorningTime = useSettingsStore((s) => s.setNotificationMorningTime);
const inactivityNudgeEnabled = useSettingsStore((s) => s.inactivityNudgeEnabled);
const setInactivityNudgeEnabled = useSettingsStore((s) => s.setInactivityNudgeEnabled);

const [pickerOpen, setPickerOpen] = useState(false);
const [permissionDenied, setPermissionDenied] = useState(false);
```

3. Replace the existing notifications toggle's `onValueChange` to handle the new return type:

```typescript
onValueChange={(v) => {
  void (async () => {
    const result = await setNotificationsEnabled(v);
    setPermissionDenied(result.permissionDenied);
  })();
}}
```

4. Add a helper for the morning-time label inside the component:

```typescript
const formatMorningTime = (hhmm: string): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
};
```

5. Replace the existing Notifications `<Section>` block. The Notifications Section currently has just the master toggle. Replace it with:

```tsx
<Section title="Notifications">
  <Row
    label="Daily missions reminder"
    testID="settings-notifications-row"
    value={
      <Switch
        testID="settings-notifications-switch"
        value={notificationsEnabled}
        onValueChange={(v) => {
          void (async () => {
            const result = await setNotificationsEnabled(v);
            setPermissionDenied(result.permissionDenied);
          })();
        }}
      />
    }
  />
  <Pressable
    testID="settings-morning-time-row"
    accessibilityRole="button"
    accessibilityState={{ disabled: !notificationsEnabled }}
    disabled={!notificationsEnabled}
    onPress={() => setPickerOpen(true)}
    className="flex-row items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
  >
    <Text
      className={`font-manrope ${notificationsEnabled ? 'text-text' : 'text-text-mute'}`}
      style={{ fontSize: 15 }}
    >
      Morning time
    </Text>
    <Text
      className={`font-manrope ${notificationsEnabled ? 'text-text-mute' : 'text-text-dim'}`}
      style={{ fontSize: 15 }}
    >
      {formatMorningTime(notificationMorningTime)}
    </Text>
  </Pressable>
  <Row
    label="Inactivity nudge (day 3+)"
    testID="settings-inactivity-nudge-row"
    value={
      <Switch
        testID="settings-inactivity-nudge-switch"
        value={inactivityNudgeEnabled}
        disabled={!notificationsEnabled}
        onValueChange={(v) => {
          void setInactivityNudgeEnabled(v);
        }}
      />
    }
  />
  {permissionDenied ? (
    <Text
      testID="settings-notifications-permission-denied"
      className="px-4 pb-3 pt-1 font-manrope text-text-mute"
      style={{ fontSize: 13, lineHeight: 18 }}
    >
      Enable in iOS Settings → Notifications → Questum to receive reminders.
    </Text>
  ) : null}
  {pickerOpen ? (
    <DateTimePicker
      testID="datetimepicker"
      mode="time"
      display="spinner"
      value={(() => {
        const [hStr, mStr] = notificationMorningTime.split(':');
        const d = new Date();
        d.setHours(Number(hStr), Number(mStr), 0, 0);
        return d;
      })()}
      onChange={(event, selected) => {
        setPickerOpen(false);
        if (event.type === 'set' && selected) {
          const hh = String(selected.getHours()).padStart(2, '0');
          const mm = String(selected.getMinutes()).padStart(2, '0');
          void setNotificationMorningTime(`${hh}:${mm}`);
        }
      }}
    />
  ) : null}
</Section>
```

6. Inside the `__DEV__` Developer Section, append two new buttons:

```tsx
<Pressable
  testID="settings-dev-test-daily"
  accessibilityRole="button"
  onPress={() => {
    void fireTestDaily();
  }}
  className="px-4 py-3"
>
  <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
    Send test daily notification (5s)
  </Text>
</Pressable>
<Pressable
  testID="settings-dev-test-nudge"
  accessibilityRole="button"
  onPress={() => {
    void fireTestNudge();
  }}
  className="px-4 py-3"
>
  <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
    Send test inactivity nudge (5s)
  </Text>
</Pressable>
```

### Step 9.4: Run tests, verify pass

Run: `npm run test:ui -- --testPathPattern=SettingsScreen`
Expected: all tests pass.

### Step 9.5: Run all UI tests

Run: `npm run test:ui`
Expected: all suites pass.

### Step 9.6: Commit

```bash
git add src/ui/screens/SettingsScreen.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx
git commit -m "feat(ui): notification time picker, nudge toggle, permission label, dev test buttons"
```

The pre-commit hook re-runs lint + typecheck.

---

## Task 10: Manual device verification

Not a code task — perform on the user's iPhone via Expo Go after Tasks 1-9 land.

- [ ] **Step 10.1:** Fresh install (or kill app + clear permissions). Notifications toggle is OFF; no permission prompt was shown.

- [ ] **Step 10.2:** Flip Notifications toggle ON. iOS system permission dialog appears. Grant → toggle stays ON, no inline label.

- [ ] **Step 10.3:** Flip Notifications toggle OFF, then ON again. iOS does NOT re-show the dialog (already granted). Toggle goes ON cleanly.

- [ ] **Step 10.4:** Fresh install. Flip Notifications toggle ON, deny in the dialog → toggle flips back OFF, inline label appears: "Enable in iOS Settings → Notifications → Questum to receive reminders."

- [ ] **Step 10.5:** With Notifications ON, tap Morning time row. Native iOS time picker opens. Pick a different time (e.g., 9:15 AM). Picker closes, row shows "9:15 AM."

- [ ] **Step 10.6:** With Notifications OFF, tap Morning time row → nothing happens (no picker). Visually muted.

- [ ] **Step 10.7:** With Notifications ON, dev "Send test daily notification (5s)" → notification fires in ~5 seconds. Title: "Time to log your day."

- [ ] **Step 10.8:** With Notifications ON, dev "Send test inactivity nudge (5s)" → nudge fires in ~5 seconds. Title: "Your character is waiting."

- [ ] **Step 10.9:** Set morning time to 5 minutes from now. Wait. Daily notification fires at the chosen time.

- [ ] **Step 10.10:** Toggle Inactivity nudge ON. Submit a log. Change device clock 3 days forward to morning time. Notification fires.

- [ ] **Step 10.11:** With Notifications ON, kill the app, revoke permission in iOS Settings, reopen → `useNotificationSync` runs `getPermissionStatus`, sees revoked, reconciles to cancel everything. Toggle visually reflects the revoked state (off + greyed out — current UX shows persisted "on" but reconcile won't actually fire notifications; manual verify that flipping it OFF then ON re-prompts).

---

## Acceptance criteria

This sub-project is complete when:

1. `expo-notifications` and `@react-native-community/datetimepicker` are installed; `app.config.ts` lists `expo-notifications` in `plugins`.
2. `notificationCopy.ts` is at 100% coverage with the threshold enforced.
3. `reconcileNotifications` honors all eight test cases.
4. `useNotificationSync` re-runs on settings change, `lastSubmitResult` change, and `AppState 'active'`.
5. Settings UI exposes the morning-time row and inactivity-nudge toggle, both properly disabled when notifications are off.
6. Permission denial shows the inline label; granting clears it.
7. `__DEV__` test buttons fire one-shot notifications within ~5 seconds on a real device.
8. All Jest and RNTL tests pass; lint and typecheck clean.
