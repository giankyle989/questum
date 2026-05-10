# Phase 4 — Sub-project 2: Animations & Haptics

**Date:** 2026-05-10
**Phase:** 4 (Polish)
**Scope:** Second of five Phase 4 sub-projects. Sub-project 1 (AI factory + availability banner) is already merged.

## Goal

Bring the app to "ship-quality feel": animate XP gains, level-ups, decay, and streak milestones; add haptics on all key interactions. All animations respect the system reduce-motion setting and fall back to instant transitions.

This sub-project covers all five animations called out in `docs/PHASES.md` Phase 4 + the haptics requirement from the Phase 4 acceptance criteria ("every interaction has appropriate feedback").

## Non-goals

- No notifications, voice input, or expo-speech-recognition — Phase 4 sub-project 3.
- No first-decay explainer modal or mission-generation polish — Phase 4 sub-project 4.
- No app icon, splash, or store metadata — Phase 4 sub-project 5.
- No real AI integration — Phase 5.
- No new animation library. Reanimated 4 is already installed; no Moti, no Lottie. The original Phase plan said "Reanimated 3 + Moti" but Reanimated 4's declarative `LayoutAnimations` + `withSequence` cover Moti's ergonomics without the extra dependency.
- No global Settings toggle for haptics. System defaults apply for now; a Settings toggle can be added later if users complain.

## Architecture

### Module layout

```
src/
  lib/
    haptics.ts                                NEW — thin expo-haptics wrapper
  state/
    hooks/useReducedMotion.ts                 NEW — AccessibilityInfo wrapper
    logsStore.ts                              EDIT — add lastSubmitResult + clearLastSubmitResult
    submitLog.ts                              EDIT — return per-attribute gains + prev/new streak
  game/
    streakMilestone.ts                        NEW — pure function: crossedStreakMilestone(prev, next)
  ui/components/
    AttributeBar.tsx                          EDIT — animate fill (Reanimated 4); shimmer when decayedToday
    StreakIndicator.tsx                       EDIT — subtle pulse on streakDays change
    XPGainReveal.tsx                          NEW — floating "+N" numbers per affected bar
    LevelUpOverlay.tsx                        NEW — full-screen burst, ~1.5s, auto-dismiss
    MissionCompletionToast.tsx                NEW — top toast, ~1.2s
    StreakMilestoneOverlay.tsx                NEW — 🔥 + "N-day streak!" overlay
    AnimationOrchestrator.tsx                 NEW — sequences the queue from lastSubmitResult
  app/_layout.tsx                             EDIT — mount AnimationOrchestrator alongside banner
```

### Dependency rules

- `lib/haptics.ts` depends only on `expo-haptics` and `react-native` (Platform).
- `state/hooks/useReducedMotion.ts` depends only on React + `react-native` (AccessibilityInfo).
- `game/streakMilestone.ts` is a pure function — no React, no storage, no I/O. Runtime-tested in node-env.
- Animation components depend on `react-native-reanimated`, `expo-haptics` (via the wrapper), the relevant Zustand stores or props, and `useReducedMotion`.
- `AnimationOrchestrator.tsx` depends on `useLogsStore`, `useMissionsStore` (to look up mission details by id), and the four overlay components.

All existing dependency rules (`docs/ARCHITECTURE.md` §"Dependency rules") are preserved: animation code lives entirely under `src/ui/`, with the only state-layer touchpoint being `lastSubmitResult` on `logsStore`.

## Data flow

A successful log submission flows like this:

```
LogEntryScreen
   ↓ user taps Submit (haptics.tap on press)
logsStore.submitLog(text)
   ↓
submitLog(text, deps)
   ↓ runs AI, validates, applies XP, missions, streak, persists in a transaction
   ↓ returns { ok: true, gains, levelUps, missionCompletions, prevStreak, newStreak }
   ↓
logsStore writes lastSubmitResult, hydrates other stores, sets submitting:false, fires haptics.submit
   ↓
LogEntryScreen sees submitting: false → router.back() (returns to CharacterSheet)
   ↓
AnimationOrchestrator (mounted at root, always alive) reacts to lastSubmitResult change
   ↓ enqueues animations:
       1. <XPGainReveal> over CharacterSheet bars (~1.0s; bars themselves animate fill in parallel)
       2. for each levelUp in order: <LevelUpOverlay> (~1.5s each; haptics.levelUp on mount)
       3. for each missionCompletion: <MissionCompletionToast> (~1.2s each; haptics.success on mount)
       4. if newStreak crosses 3/7/30: <StreakMilestoneOverlay> (~1.5s; haptics.success on mount)
       5. clearLastSubmitResult()
```

**Why orchestrator at the root** (not in `LogEntryScreen`): the modal closes immediately after submit, but the bars to animate live on `CharacterSheetScreen`. Mounting at root means animations float over whichever screen is visible after dismissal.

**Streak milestone detection:** `crossedStreakMilestone(prev, next): 3 | 7 | 30 | null` — returns the highest threshold crossed. Going `6 → 7` fires "7-day". Going `2 → 4` fires "3-day". Going `7 → 8` (already past) fires nothing. Going `2 → 8` returns 7 (the highest crossed).

**Tap-to-skip:** tapping anywhere on an active overlay fires its `onComplete` early, advancing the queue.

## Contracts

### `submitLog` return extension

```typescript
export type SubmitLogResult =
  | {
      ok: true;
      gains: Partial<Record<Attribute, number>>;   // only attributes with delta > 0
      levelUps: LevelUp[];
      missionCompletions: string[];                  // mission instance IDs
      prevStreak: number;
      newStreak: number;
    }
  | { ok: false; reason: ...; detail?: string };
```

`actuallyApplied` from the engine becomes `gains` (filtered to non-zero entries). `prevStreak` is `streak.currentLength` before the streak update; `newStreak` is the persisted value after.

### `LogsStoreState` extension

```typescript
export interface LastSubmitResult {
  gains: Partial<Record<Attribute, number>>;
  levelUps: LevelUp[];
  missionCompletions: string[];
  prevStreak: number;
  newStreak: number;
}

interface LogsStoreState {
  // ... existing fields ...
  lastSubmitResult: LastSubmitResult | null;
  clearLastSubmitResult: () => void;
}
```

The store sets `lastSubmitResult` on success. The orchestrator clears it after enqueueing — that prevents the same animation from re-firing on screen re-mount.

### `crossedStreakMilestone(prev, next)` (pure)

```typescript
export type StreakMilestone = 3 | 7 | 30;

export function crossedStreakMilestone(
  prev: number,
  next: number,
): StreakMilestone | null {
  for (const threshold of [30, 7, 3] as const) {
    if (prev < threshold && next >= threshold) return threshold;
  }
  return null;
}
```

### `useReducedMotion()` hook

```typescript
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

### `lib/haptics.ts`

```typescript
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<void>): void {
  if (!isHapticPlatform) return;
  void fn().catch(() => {}); // never throw — haptics failures are silent
}

export const haptics = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  submit: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  levelUp: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
```

### `<AnimationOrchestrator>`

Single sequencer at the root. Maintains a local `queue: QueueItem[]` and `current: QueueItem | null`. Subscribes to `lastSubmitResult`; on change, builds the queue, calls `clearLastSubmitResult()`. A second effect advances `current` when it becomes null.

```typescript
type QueueItem =
  | { kind: 'xp-reveal'; gains: Partial<Record<Attribute, number>> }
  | { kind: 'level-up'; attribute: Attribute; newLevel: number }
  | { kind: 'mission'; missionDescription: string; bonusXP: number; attribute: Attribute }
  | { kind: 'streak'; threshold: 3 | 7 | 30; multiplier: number };
```

**Multi-submit guard.** If `queue.length > 0 || current !== null` when a new `lastSubmitResult` arrives, append to the existing queue instead of replacing — so a user submitting two logs back-to-back gets both celebrations.

### Animation components

All four overlay components share a common shape:

```typescript
interface OverlayProps {
  /* per-component data */
  onComplete: () => void;
}
```

Each fires `haptics.*` on mount. Each respects `useReducedMotion()` — when reduced, renders a static end-state for ~800ms, then calls `onComplete`. Tap anywhere → `onComplete` early.

**`<AttributeBar>` edits:**
- `inProgressXp` prop drives a `useSharedValue` ratio. The fill width animates over ~600ms with `withTiming({ duration: 600, easing: Easing.out(Easing.cubic) })`.
- When `decayedToday: true`, overlay a `<DecayShimmer>` child (a 30%-white linear gradient that loops a 2.5s left-to-right slide via `withRepeat(withTiming, -1)`). Replaces the current static `opacity: 0.6`.
- When `useReducedMotion()` is true: bar fill is static (no `withTiming`), shimmer is off (back to `opacity: 0.6`).

**`<XPGainReveal>`:** mounted absolutely on top of CharacterSheet's bar list during the reveal phase. For each `(attribute, +N)` entry in `gains`, renders text positioned over the matching bar. `translateY: 0 → -24` and `opacity: 1 → 0` over ~900ms via `withTiming`. All affected bars animate in parallel.

**`<LevelUpOverlay>`:** absolute, full-screen, semi-transparent dark backdrop. Centered: large attribute icon (using `ATTRIBUTE_COLORS`) scaling 0.5 → 1.1 → 1.0 with a spring; `Lv N` numeric text; six radial gold particles flying outward via `withSequence`. Total ~1.5s.

**`<MissionCompletionToast>`:** top-anchored toast, slides in from above (`translateY: -80 → 0`) with mission description + "+N XP" badge. Lives ~1.2s, slides back up.

**`<StreakMilestoneOverlay>`:** smaller centered card (~70% width). 🔥 icon scaling, "N-day streak!" title, "Streak multiplier now M.MM×" subtitle. ~1.5s.

**`<StreakIndicator>` edit:** when `streakDays` changes (any change, not just milestone), the flame emoji does a 180ms `scale: 1 → 1.2 → 1` pulse via `withSequence(withTiming, withTiming)`.

### Where haptics fire

- `CharacterSheetScreen` FAB press → `haptics.tap()` (only when AI available; the disabled-state path still calls `Linking.openSettings` and skips haptics).
- `LogEntryScreen` submit button press → `haptics.tap()`.
- `logsStore.submitLog` success path → `haptics.submit()` once.
- `<LevelUpOverlay>` mount → `haptics.levelUp()`.
- `<MissionCompletionToast>` mount → `haptics.success()`.
- `<StreakMilestoneOverlay>` mount → `haptics.success()`.

The orchestrator plays items sequentially, so haptics fire one at a time even on a multi-level-up log.

## Reduce-motion behavior

- `<AttributeBar>`: bar fill jumps instantly; shimmer disabled; static `opacity: 0.6` for decayedToday.
- `<XPGainReveal>`: skips render entirely; calls `onComplete` next frame.
- `<LevelUpOverlay>` / `<MissionCompletionToast>` / `<StreakMilestoneOverlay>`: shows static end-state for 800ms, then dismisses.
- `<StreakIndicator>`: skips the pulse.

The orchestrator queue advances the same way — reduced-motion users still see *what* happened, just without the animation.

## Testing

### Pure-function unit tests (Jest, node-env)

- `src/game/__tests__/streakMilestone.test.ts`
  - `crossedStreakMilestone(0, 1)` → null
  - `crossedStreakMilestone(2, 3)` → 3
  - `crossedStreakMilestone(2, 4)` → 3
  - `crossedStreakMilestone(2, 7)` → 7
  - `crossedStreakMilestone(2, 8)` → 7
  - `crossedStreakMilestone(2, 30)` → 30
  - `crossedStreakMilestone(2, 100)` → 30
  - `crossedStreakMilestone(7, 8)` → null
  - `crossedStreakMilestone(7, 7)` → null
  - `crossedStreakMilestone(30, 31)` → null
  - `crossedStreakMilestone(0, 0)` → null
  - 100% coverage required.
- `src/state/__tests__/submitLog.test.ts` (extend existing)
  - Existing assertions preserved.
  - Add: success result includes `gains`, `prevStreak`, `newStreak`. Spot-check values across at least one no-level-up log and one with-level-up log.

### Component tests (RNTL, jest-expo)

- `src/ui/components/__tests__/AnimationOrchestrator.test.tsx`
  - Idle when `lastSubmitResult` is null.
  - On result with no items (empty gains, no level-ups, no missions, no streak crossing) → still calls `clearLastSubmitResult()` and stays idle.
  - On result with all four item kinds → mocks fire `onComplete` immediately; orchestrator advances queue in order: xp-reveal → level-ups (in attribute order) → missions → streak.
  - Multi-submit guard: a second `lastSubmitResult` arriving mid-queue appends instead of replacing.
- `src/state/hooks/__tests__/useReducedMotion.test.tsx`
  - Initial value follows `AccessibilityInfo.isReduceMotionEnabled()` resolution.
  - Subscribes to `'reduceMotionChanged'`; updates on change.
  - Removes the listener on unmount.
- `src/ui/components/__tests__/XPGainReveal.test.tsx`
  - Empty gains → returns null (orchestrator should not enqueue this case anyway, but defensive).
  - Renders one "+N" element per gain entry.
  - Calls `onComplete` after the animation window (fake timers).
  - Reduced-motion variant: returns null + calls `onComplete` next frame.
- `src/ui/components/__tests__/LevelUpOverlay.test.tsx`
  - Renders the attribute name + level.
  - Calls `haptics.levelUp` once on mount.
  - Calls `onComplete` after the animation window.
  - Tap-to-skip fires `onComplete` early.
  - Reduced-motion variant: static end-state, fires `onComplete` after 800ms.
- `src/ui/components/__tests__/MissionCompletionToast.test.tsx`
  - Renders mission description + "+N XP" badge.
  - Calls `haptics.success` on mount.
  - Auto-dismisses; tap-to-skip path.
  - Reduced-motion variant.
- `src/ui/components/__tests__/StreakMilestoneOverlay.test.tsx`
  - Renders threshold + multiplier text.
  - Calls `haptics.success` on mount.
  - Auto-dismisses; tap-to-skip path.
  - Reduced-motion variant.
- `src/ui/components/__tests__/AttributeBar.test.tsx` (NEW — no existing tests)
  - Renders attribute label, level, and progress bar with the right width ratio.
  - `decayedToday: true` renders the shimmer overlay element (test by `testID`).
  - `decayedToday: false` does not render the shimmer.
- `src/ui/components/__tests__/StreakIndicator.test.tsx` (NEW — no existing tests)
  - Renders nothing when `streakDays === 0`.
  - Renders flame + label when `streakDays > 0`.
  - Pulse triggers when `streakDays` prop changes from N → N+1 (verify the underlying shared value transitions; use the standard RNTL pattern of asserting on the rendered transform).

### Mocking conventions

- `expo-haptics` mocked at the top of each test that imports a component or module that calls into it. Assert on `Haptics.impactAsync` / `Haptics.notificationAsync` with the right intensity.
- `useReducedMotion` mocked per test (rather than swapping `AccessibilityInfo` globally) when testing reduced-motion variants.

### Coverage targets

- 100% on `src/game/streakMilestone.ts`. Add it to `jest.config.js` `coverageThreshold` alongside the existing 100% targets.
- No specific threshold on animation components; structural test coverage above is sufficient.

## Manual device verification

1. Submit a log with no level-up → bars fill smoothly, no overlay.
2. Submit a log that triggers a level-up → overlay shows ~1.5s, auto-dismisses; haptic on mount.
3. Submit a log that triggers 2+ level-ups → overlays sequence in attribute order; one haptic per overlay.
4. Submit a log that completes a daily mission → toast slides in after the level-up overlay.
5. Cross from 6 → 7-day streak → streak milestone overlay shows multiplier text.
6. Toggle iOS Settings → Accessibility → Reduce Motion ON. Re-submit → animations are instant; overlays still display content but don't animate.
7. FAB tap, log submit, level-up, mission completion all produce distinct haptics.

## Acceptance criteria

This sub-project is complete when:

1. `submitLog` returns `gains`, `prevStreak`, `newStreak` in addition to existing fields.
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
12. Lint and typecheck pass with zero warnings.

## Risks and open questions

- **Reanimated 4 + jest-expo edge cases.** Some Reanimated APIs need `react-native-reanimated/mock` or specific jest setup. If component tests trip on worklet evaluation, add `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` to `jest.setup.ui.js`.
- **AccessibilityInfo on simulator.** `isReduceMotionEnabled` may resolve `false` on simulator regardless of system setting. Manual device verification covers the actual reduce-motion path; tests mock the hook.
- **Multi-submit clearing.** The orchestrator clears `lastSubmitResult` on enqueue. If the user submits twice in quick succession (`logsStore.submitLog` writes the second result before the orchestrator's effect runs), only the second is enqueued — a known minor race acceptable for MVP.
- **Particle effect performance.** Six SVG particles per level-up overlay is light; if multi-level-up logs feel janky on older A-series chips, switch to a single sprite-sheet animation. Defer until measured.
- **Decay shimmer + bar fill simultaneously.** On a log that brings a decayed bar back over its decay threshold, the shimmer and the fill animation run together for one frame. Acceptable — once decay is no longer applicable, the next `decayedToday` recompute on app foreground turns the shimmer off.

## Out of scope (tracked elsewhere)

- Notifications + voice input — Phase 4 sub-project 3.
- First-decay explainer modal + mission-gen polish — Phase 4 sub-project 4.
- App icon / splash / store metadata — Phase 4 sub-project 5.
- Real `AppleAIService` — Phase 5.
- Android distribution — Phase 6.
