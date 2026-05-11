# Phase 4 — Sub-project 3: Local Notifications

**Date:** 2026-05-11
**Phase:** 4 (Polish)
**Scope:** Third of five Phase 4 sub-projects. Sub-projects 1 (AI factory + availability banner) and 2 (animations + haptics) are already merged.

## Goal

Wire local notifications into the app:

- Daily morning notification at a user-set time, repeating.
- One-shot inactivity nudge fires at `lastLogDay + 3 days` at morning time.
- Settings UI: existing master toggle plus a morning-time picker and a separate "Inactivity nudge" toggle.
- iOS notification permission requested when the user enables notifications.
- All scheduling driven by a single `reconcileNotifications()` function so the OS-side schedule always matches the current settings/state.

## Non-goals

- **Voice input** — deferred to Phase 5. `expo-speech-recognition` needs an EAS Build dev client; we're staying on Expo Go for the rest of Phase 4 sub-projects.
- **Push notifications via APNs/FCM** — local notifications only, no server, no push tokens, no Apple Developer push setup.
- **Streak-loss notification, level-up reminder, mission deadline alerts** — not in this sub-project.
- **Android-specific notification channels** — only relevant for Android distribution (Phase 6). The iOS path doesn't need channels.
- **In-app banners or toasts driven by notifications** — local notifications appear in the OS notification center / on lock screen only.

## Architecture

### Module layout

```
src/
  notifications/
    notifications.ts                          NEW — schedule/cancel/permission API
    reconcileNotifications.ts                 NEW — pure-ish state→schedule reconciler
    notificationCopy.ts                       NEW — pure: titles/bodies + parseHHMM
    __tests__/
      notificationCopy.test.ts                NEW — 100% coverage
      reconcileNotifications.test.ts          NEW — mocked-API tests
  state/
    settingsStore.ts                          EDIT — add inactivityNudgeEnabled + setter
    hooks/
      useNotificationSync.ts                  NEW — runs reconciler on mount + relevant changes
      __tests__/
        useNotificationSync.test.tsx          NEW
  storage/repositories/
    settingsRepo.ts                           EDIT — widen SettingKey union
  ui/screens/
    SettingsScreen.tsx                        EDIT — morning-time picker + nudge toggle + dev tests
    __tests__/
      SettingsScreen.test.tsx                 EDIT — new test cases
app/_layout.tsx                               EDIT — mount useNotificationSync
package.json                                  EDIT — add expo-notifications, @react-native-community/datetimepicker
app.config.ts                                 EDIT — add expo-notifications plugin entry
jest.config.js                                EDIT — add notificationCopy.ts 100% threshold
```

### Dependency rules

Preserves `docs/ARCHITECTURE.md` §"Dependency rules":

- `notifications/` depends on `expo-notifications`, the React Native `Platform` API, and type-only imports from `state/settingsStore` (for the `inactivityNudgeEnabled`/`notificationsEnabled` field types). It does NOT import from `ui/`, `game/`, or `storage/`.
- `reconcileNotifications.ts` is a pure-ish function: takes inputs, calls `notifications.ts` APIs (which mock cleanly), no React.
- `notificationCopy.ts` is pure — no imports beyond TypeScript types.
- `useNotificationSync.ts` depends on `notifications/`, `settingsStore`, `logsStore`, and `AppState`. Standard hook layer.
- `SettingsScreen.tsx` imports `notifications/` only for the dev test buttons (in `__DEV__`). Regular toggle handlers go through `settingsStore` setters, which are the only path that calls `reconcileNotifications` via the hook.

### Two new dependencies

- **`expo-notifications`** (Expo SDK package). Local-only flow on iOS works in Expo Go without a custom dev build.
- **`@react-native-community/datetimepicker`** for the morning time picker. Native iOS spinner. No Mac required.

Both are added to `package.json`. `app.config.ts` gets an `expo-notifications` plugin entry (recommended by Expo to handle iOS scheduling permissions cleanly).

## Scheduling model

Two notifications, both local, with stable identifiers:

| Identifier | Trigger | Lifetime |
|---|---|---|
| `daily-morning` | Calendar trigger at `morningTime`, repeating | Persistent — survives kills |
| `inactivity-nudge` | Date trigger at `lastLogDay + 3 days @ morningTime` | One-shot — re-created on every relevant change |

iOS allows up to ~64 pending local notifications per app. Using 2 stable identifiers and re-using them means we never approach that ceiling.

### `reconcileNotifications()` contract

```typescript
export interface ReconcileInput {
  notificationsEnabled: boolean;
  inactivityNudgeEnabled: boolean;
  morningTime: string;            // "HH:MM"
  lastLogDay: ISODate | null;
  permissionGranted: boolean;
}

export async function reconcileNotifications(input: ReconcileInput): Promise<void>;
```

Behavior:

1. If `!permissionGranted` OR `!notificationsEnabled`: cancel both `daily-morning` and `inactivity-nudge`, return.
2. Else: ensure `daily-morning` is scheduled at `morningTime` (cancel + reschedule unconditionally — iOS doesn't expose "trigger time" of an already-scheduled notification cheaply, so the simplest safe option is always cancel-and-reschedule).
3. If `inactivityNudgeEnabled` AND `lastLogDay !== null`:
   - Compute target Date = `lastLogDay + 3 calendar days` at `morningTime` in device local TZ.
   - If target is in the past, cancel and skip (don't fire stale nudges).
   - Otherwise, cancel any existing `inactivity-nudge` and reschedule with the new target.
4. Else: cancel any existing `inactivity-nudge`.

Idempotent: calling `reconcileNotifications` twice in a row with the same inputs results in the same schedule (the second call cancels and reschedules with identical parameters).

### When `reconcileNotifications` runs

All from `useNotificationSync` mounted in `app/_layout.tsx`:

- App mount after `settingsStore.hydrate()` completes (`useEffect` watches `settingsStore.loading`).
- On `AppState` `'active'` transition (`AppState.addEventListener('change', ...)`). Catches OS-level permission revocation.
- When `notificationsEnabled`, `notificationMorningTime`, `inactivityNudgeEnabled`, or `lastLogDay` changes (subscribed via `useSettingsStore`/`useLogsStore` selectors).

`lastLogDay` is sourced from `useLogsStore` — already available as a field on `LogsStoreState` (set in Sub-project 2). If not, the hook reads from `logRepo.getLastLogDay(db)` after each `submitLog` success.

### Permission flow

- Initial state: `notificationsEnabled: false` (existing default).
- User flips toggle ON:
  1. `setNotificationsEnabled(true)` first calls `Notifications.requestPermissionsAsync()`.
  2. If granted: persist `notificationsEnabled = true`; reconcile fires; toggle shows ON.
  3. If denied: persist `notificationsEnabled = false`; toggle flips back OFF; set local UI state `permissionDenied: true` so the inline label renders.
- After the first denial, iOS won't show the system dialog again on subsequent toggles. The inline label persists until either (a) the user goes to iOS Settings and grants permission, or (b) the user successfully toggles ON (meaning permission was granted while the app was backgrounded).
- The toggle handler always checks `Notifications.getPermissionsAsync()` before attempting `requestPermissionsAsync()` — avoids no-op dialogs.

### Inactivity nudge timing

- Computes against the device local date — same as decay.
- `lastLogDay + 3` is in calendar days. If `lastLogDay` is `2026-05-08`, nudge fires on `2026-05-11` at `morningTime`.
- If `lastLogDay` is `null` (no logs ever), no inactivity nudge is scheduled — there's nothing to be inactive about.
- Decay pause does NOT affect the nudge schedule for MVP — pause is for XP, not for "we miss you." Acceptable to revisit if it confuses users.

### Notification copy

In `notificationCopy.ts` (pure):

```typescript
export const dailyMorningCopy = (): { title: string; body: string } => ({
  title: 'Time to log your day',
  body: 'What did you do? A quick log keeps your character growing.',
});

export const inactivityNudgeCopy = (): { title: string; body: string } => ({
  title: 'Your character is waiting',
  body: "It's been a few days. Got something to log?",
});

export function parseHHMM(s: string): { hour: number; minute: number };
```

`parseHHMM` validates `HH:MM` shape with `[0-23]:[0-59]`. Throws on malformed input. Pure and testable.

## Settings UI

Existing Notifications section gets two new rows:

```
NOTIFICATIONS
  Daily missions reminder         [ ●——— ] toggle    (existing)
  Morning time                    8:00 AM    >       NEW — opens time picker
  Inactivity nudge (day 3+)       [ ●——— ] toggle    NEW
  (permission-denied inline label, when applicable)
```

**Morning time row.**
- `Pressable` with `accessibilityState.disabled === !notificationsEnabled`.
- Tap opens `@react-native-community/datetimepicker` in `mode="time"` on iOS.
- Selecting a time calls `setNotificationMorningTime("HH:MM")`.
- Visually muted when disabled (lower opacity, neutral text color).

**Inactivity nudge row.**
- `Switch` with `disabled === !notificationsEnabled` and a corresponding visual muting.
- `onValueChange` calls `setInactivityNudgeEnabled(...)`.

**Permission-denied inline label.**
- Renders only when local component state `permissionDenied === true`.
- Copy: `"Enable in iOS Settings → Notifications → Questum to receive reminders."`
- No "Open Settings" button — the copy is self-explanatory and the AI-availability banner already establishes the "go to iOS Settings" pattern in this app.
- Cleared when a `setNotificationsEnabled(true)` succeeds.

**Developer section (in `__DEV__` only):**
- New row: `Send test daily notification (5s)` — calls `notifications.fireTestDaily()`.
- New row: `Send test inactivity nudge (5s)` — calls `notifications.fireTestNudge()`.
- Both schedule a one-shot notification with the appropriate copy at `now + 5 seconds`. Useful for verifying the flow without changing system clock or waiting for 8 AM.

## Contracts

### `notifications.ts` exports

```typescript
export async function requestPermission(): Promise<boolean>;
export async function getPermissionStatus(): Promise<boolean>;
export async function scheduleDailyMorning(morningTime: string): Promise<void>;
export async function cancelDailyMorning(): Promise<void>;
export async function scheduleInactivityNudge(target: Date): Promise<void>;
export async function cancelInactivityNudge(): Promise<void>;
export async function cancelAll(): Promise<void>;
export async function fireTestDaily(): Promise<void>;
export async function fireTestNudge(): Promise<void>;
```

Each function wraps a single `expo-notifications` call. The wrappers normalize identifiers, encode the copy via `notificationCopy.ts`, and absorb the iOS-vs-Android shape differences (only iOS matters for v1, but the wrappers stay Android-safe so Phase 6 doesn't have to rewrite them).

### `settingsStore` extensions

```typescript
interface SettingsStoreState {
  // ... existing fields ...
  inactivityNudgeEnabled: boolean;
  setInactivityNudgeEnabled: (value: boolean) => Promise<void>;
}
```

Hydrate reads `inactivity_nudge_enabled` (default `false`). Setter persists and updates state.

The existing `setNotificationsEnabled` is enhanced:

```typescript
setNotificationsEnabled: async (value: boolean): Promise<{ permissionDenied: boolean }> => {
  if (value) {
    const granted = await notifications.requestPermission();
    if (!granted) {
      // Don't persist — stay OFF.
      return { permissionDenied: true };
    }
  }
  const db = await getDb();
  await settingsRepo.setSetting(db, 'notifications_enabled', value ? 'true' : 'false');
  set({ notificationsEnabled: value });
  return { permissionDenied: false };
},
```

The return value lets the calling component (`SettingsScreen`) know whether to show the inline label. The store doesn't carry transient UI state.

### `useNotificationSync` hook

```typescript
export function useNotificationSync(): void {
  // Subscribes to:
  //   - settingsStore.notificationsEnabled
  //   - settingsStore.notificationMorningTime
  //   - settingsStore.inactivityNudgeEnabled
  //   - logsStore.lastSubmitResult (proxy for "log just landed")
  // On any change, runs reconcileNotifications().
  // Also subscribes to AppState 'active' transitions and re-runs.
}
```

Mounted once in `PostBootShell` in `app/_layout.tsx`, alongside `useAppForegroundDecay`, `useAIAvailabilityProbe`, and the existing root-level components.

## Testing

### Pure-function tests (Jest, node-env)

- `src/notifications/__tests__/notificationCopy.test.ts` — see Section 4 spec list. 100% coverage on `notificationCopy.ts`, added to `jest.config.js`.
- `src/notifications/__tests__/reconcileNotifications.test.ts` — mocks `expo-notifications`. Covers:
  - No-permission cancels everything.
  - Master-off cancels everything.
  - Master-on, nudge-off, first time: schedules `daily-morning` at the right hour/minute, no `inactivity-nudge`.
  - Master-on, nudge-on, `lastLogDay` set: schedules both with correct trigger times.
  - Master-on, nudge-on, `lastLogDay` null: schedules `daily-morning` only.
  - Time change re-schedules `daily-morning`.
  - Idempotency: repeated calls produce repeated schedules but no errors.
  - Past-target nudge: when `lastLogDay + 3 days` is in the past, no nudge is scheduled.

### Component tests (RNTL, jest-expo)

- `src/state/hooks/__tests__/useNotificationSync.test.tsx`
  - Calls `reconcileNotifications` on mount with current settings.
  - Re-calls when mocked settings store updates.
  - Re-calls on `AppState` `'active'` transition.
- Extend `src/ui/screens/__tests__/SettingsScreen.test.tsx`
  - Morning time row disabled (`accessibilityState.disabled === true`) when notifications off; tap is a no-op.
  - Morning time row tap opens picker when notifications on; selection calls setter.
  - Inactivity nudge toggle disabled when notifications off.
  - Inactivity nudge toggle calls `setInactivityNudgeEnabled`.
  - When `requestPermissionsAsync` returns `denied`, the inline label appears.
  - Inline label clears after a successful toggle ON.
  - `__DEV__` dev test buttons call `notifications.fireTestDaily` / `fireTestNudge`.

### Mocking conventions

Mock `expo-notifications` at the top of any test file that imports through to it. Standard shape:

```typescript
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar', DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));
```

### Coverage targets

- 100% on `src/notifications/notificationCopy.ts` (added to `jest.config.js` threshold).
- No specific threshold on `notifications.ts` or `reconcileNotifications.ts` — exercised structurally via the mocked tests above.

## Manual device verification

1. Fresh install → notifications toggle is OFF, no permission prompt.
2. Toggle ON → iOS permission dialog appears. Grant → toggle stays ON, no inline label.
3. Toggle ON → deny permission → toggle flips back OFF, inline label shows.
4. With toggle ON, dev "Send test daily notification (5s)" → notification fires within 5 seconds.
5. Set morning time to e.g. 5 minutes from now → wait → daily notification fires at that time.
6. With nudge toggle ON, dev "Send test inactivity nudge (5s)" → nudge notification fires.
7. Toggle nudge ON, submit a log, then change device clock 3 days forward → inactivity nudge fires at morning time on day 3.
8. With notifications ON, kill the app, revoke permission in iOS Settings, reopen → toggle reflects revoked state (reconcile cancels schedules).

## Acceptance criteria

This sub-project is complete when:

1. `expo-notifications` and `@react-native-community/datetimepicker` are installed and `app.config.ts` has the plugin entry.
2. `notificationCopy.ts` is at 100% coverage with the threshold enforced.
3. `reconcileNotifications` honors all eight cases listed in the test plan.
4. `useNotificationSync` re-runs on every subscribed change (mocked-test verified) and on `AppState` `'active'`.
5. Settings UI exposes the new morning-time row and inactivity-nudge toggle, properly disabled when notifications are off.
6. Permission denial shows the inline label; granting clears it.
7. `__DEV__` dev test buttons fire one-shot notifications within ~5 seconds on a real device.
8. All Jest and RNTL tests pass; lint and typecheck clean.

## Risks and open questions

- **`expo-notifications` Expo-Go support boundary.** Expo Go supports local notifications, but some lower-level features (custom notification categories, attachments) require a dev build. The features in this sub-project (calendar trigger, date trigger, simple title/body) work in Expo Go. If a tested feature behaves unexpectedly, fall back to the documented Expo Go-supported subset.
- **Device clock changes affecting tests.** Manual test #7 requires changing device clock, which can interact with other parts of the app (decay, streak). Acceptable for a one-time verification; document and revert after.
- **iOS notification permission UX.** iOS only shows the system dialog once. If the user denies and then taps the toggle again, no dialog appears — the inline label is the only signal. This is the standard iOS pattern; users with notification literacy will recognize "go to Settings" as the next step.
- **Time picker UX inconsistency between iOS and Android.** Native pickers differ. Only iOS matters for v1, so this risk doesn't materialize until Phase 6 — but write the Settings UI such that the modal layer is replaceable.

## Out of scope (tracked elsewhere)

- Voice input — Phase 5 (`expo-speech-recognition` on a dev client built alongside Apple AI).
- First-decay explainer modal + mission-gen polish + decay-shimmer wiring to live state — Phase 4 sub-project 4.
- App icon / splash / store metadata — Phase 4 sub-project 5.
- Real `AppleAIService` — Phase 5.
- Android distribution and channels — Phase 6.
