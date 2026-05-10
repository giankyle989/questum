# Phase 4 — Sub-project 1: AI factory, availability probe, and unavailable banner

**Date:** 2026-05-10
**Phase:** 4 (Polish)
**Scope:** First of five Phase 4 sub-projects. Subsequent sub-projects (animations, notifications/voice, first-decay explainer + mission polish, assets/store metadata) are tracked separately.

## Goal

Wire the on-device AI availability check into the app:

- A single `aiServiceFactory` that the rest of the app calls when it needs the AI service.
- A runtime probe that asks "is on-device AI usable right now?" on every app foreground.
- A top-of-screen banner + disabled FAB + disabled onboarding Continue button when the answer is no.
- A developer-only Settings toggle to simulate the unavailable state without needing a real failure.

This sub-project is the structural prerequisite for Phase 5: in Phase 5, swapping `MockAIService` for `AppleAIService` is a one-line change inside the factory, and the banner/probe behavior is already shipping.

## Non-goals

- No real AI integration. The only `AIService` implementation in this sub-project is the existing `MockAIService`; `AppleAIService` and `GeminiNanoService` are deferred to Phases 5 and 6 per `docs/PHASES.md`.
- No animation polish. The banner is a static component; bar fills, level-up bursts, and decay shimmer are tracked in Phase 4 sub-project 2.
- No background-task probing. The probe runs only on mount and on `AppState === 'active'` transitions, matching the decay model documented in `docs/ARCHITECTURE.md` §"Decay timing".
- No persisted runtime availability. The probe result lives in memory (Zustand) for the session only.

## Architecture

### Module layout

```
src/ai/
  AIService.ts                     EXISTS — interface unchanged
  MockAIService.ts                 EXISTS — `isAvailable()` continues returning true
  aiServiceFactory.ts              NEW
src/state/
  aiAvailabilityStore.ts           NEW
  hooks/useAIAvailabilityProbe.ts  NEW
  settingsStore.ts                 EXTEND — add devForceAIUnavailable + setter
src/storage/repositories/
  settingsRepo.ts                  NO MIGRATION — key/value table already accepts new keys
src/ui/components/
  AIUnavailableBanner.tsx          NEW
src/ui/screens/
  CharacterSheetScreen.tsx         EDIT — FAB disabled state + onPress override
  SettingsScreen.tsx               EDIT — Developer section toggle (__DEV__ only)
  onboarding/AIConfirmScreen.tsx   EDIT — Continue disabled + copy swap
src/app/_layout.tsx                EDIT — mount probe hook + render banner
```

### Dependency rules

All dependency rules in `docs/ARCHITECTURE.md` §"Dependency rules" are preserved:

- `aiServiceFactory.ts` depends only on `MockAIService`, `AIService` types, and `settingsStore` (for the dev override). It does not import from `ui/`, `game/`, or `storage/`.
- `aiAvailabilityStore.ts` depends on `aiServiceFactory.ts` only. It does not depend on `storage/` (state is runtime-only).
- `useAIAvailabilityProbe.ts` depends on `aiAvailabilityStore` and React Native `AppState`. No screen-level imports.
- `AIUnavailableBanner.tsx` depends on `aiAvailabilityStore` and `expo-linking` for `openSettings()`. Pure presentational otherwise.

### Why a separate `aiAvailabilityStore`

Availability is **runtime/session state**, not a persisted setting. Mixing it into `settingsStore` would muddle SQLite-backed prefs with ephemeral probe results and would force a write on every probe re-run. A small, in-memory Zustand store matches the rest of the codebase's "one store per concern" pattern.

The dev override (`devForceAIUnavailable`) does live in `settingsStore` because it must persist across reloads — otherwise every dev-build refresh loses the toggle state.

## Contracts

### `aiServiceFactory.ts`

```typescript
import type { AIService } from './AIService';
import { MockAIService } from './MockAIService';
import { useSettingsStore } from '@/state/settingsStore';

let cached: AIService | null = null;

export function getAIService(): AIService {
  if (cached) return cached;
  // Phase 4: only Mock exists. Phase 5 branches here on Platform.OS to return
  // AppleAIService/GeminiNanoService; the cache layer below is unchanged.
  cached = new MockAIService();
  return cached;
}

export interface ProbeResult {
  available: boolean;
  displayName: string;
}

export async function probeAIAvailability(): Promise<ProbeResult> {
  const service = getAIService();
  if (__DEV__ && useSettingsStore.getState().devForceAIUnavailable) {
    return { available: false, displayName: service.displayName };
  }
  try {
    const available = await service.isAvailable();
    return { available, displayName: service.displayName };
  } catch {
    // Phase 5: AppleAIService.isAvailable can throw if the OS API is missing
    // entirely. Treat any throw as "unavailable" — it's a known runtime state,
    // not a bug. Mock cannot throw, so this branch is dead in Phase 4.
    return { available: false, displayName: service.displayName };
  }
}

/** Test-only: clears the cached service. Not exported in production builds. */
export function __resetFactoryForTests(): void {
  cached = null;
}
```

### `aiAvailabilityStore.ts`

```typescript
import { create } from 'zustand';
import { probeAIAvailability } from '@/ai/aiServiceFactory';

export interface AIAvailabilityState {
  available: boolean;
  displayName: string;
  lastProbedAt: number | null; // epoch ms; null until first probe completes
  probing: boolean;

  runProbe: () => Promise<void>;
  /** Test seam — set state directly without running the factory. */
  setAvailability: (next: { available: boolean; displayName: string }) => void;
}

export const useAIAvailabilityStore = create<AIAvailabilityState>((set) => ({
  available: true, // optimistic until first probe completes; banner stays hidden
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

  setAvailability: (next) => set({ ...next, lastProbedAt: Date.now() }),
}));
```

**Initial-state choice:** `available: true` is the optimistic default. The banner reads `available === false` to render — so during the brief window before the first probe completes (typically a few hundred ms), the banner is hidden and the FAB enabled. This avoids a flash-of-banner on cold start. A failed first probe will flip the flag a moment later and the banner appears.

### `useAIAvailabilityProbe.ts`

```typescript
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

export function useAIAvailabilityProbe(): void {
  useEffect(() => {
    const store = useAIAvailabilityStore.getState();
    void store.runProbe();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void useAIAvailabilityStore.getState().runProbe();
      }
    });

    return () => sub.remove();
  }, []);
}
```

Mounted once in `src/app/_layout.tsx` alongside the existing `useAppForegroundDecay()` call.

### `settingsStore.ts` extensions

Add to existing `SettingsStoreState`:

```typescript
devForceAIUnavailable: boolean;
setDevForceAIUnavailable: (value: boolean) => Promise<void>;
```

`hydrate` reads `dev_force_ai_unavailable` from the key-value settings table (default `false`). The setter persists via `settingsRepo.setSetting` and triggers `useAIAvailabilityStore.getState().runProbe()` so the banner reacts immediately.

The setting is honored at the factory level only when `__DEV__` is true. In production builds the override is read but ignored — defense in depth in case a debug build ever ships accidentally.

### `AIUnavailableBanner.tsx`

Pure presentational component:

```typescript
interface AIUnavailableBannerProps {} // reads from store directly
```

- Reads `available`, `displayName` from `useAIAvailabilityStore`.
- Returns `null` when `available === true`.
- Renders a top-anchored bar with:
  - Bold title: `"On-device AI is currently unavailable"`
  - Body: `"Enable Apple Intelligence in Settings to log activities."` (Phase 4 hardcodes Apple Intelligence copy; Phase 6 generalizes when Android ships.)
  - Right-side affordance: `"Open Settings →"` calling `Linking.openSettings()` from `expo-linking`.
- Top inset: respects `useSafeAreaInsets().top` so it sits below the status bar.
- Visual: warm amber/gold tones matching the existing `accent` palette (see `tailwind.config.js`).
- Accessibility: `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`. Tap target ≥ 44pt for the Open Settings affordance.

## UI integration points

### `src/app/_layout.tsx`

```typescript
useAIAvailabilityProbe();
useAppForegroundDecay();

return (
  <SafeAreaProvider>
    <AIUnavailableBanner />
    <Stack /* existing routes */ />
  </SafeAreaProvider>
);
```

The banner is rendered above the route stack so it floats over both onboarding and `(main)` route groups. No per-screen wiring.

### `CharacterSheetScreen.tsx` — FAB

- FAB reads `available` from `useAIAvailabilityStore`.
- When `available === true`: existing behavior — navigate to `/log`.
- When `available === false`:
  - Visual: 40% opacity, neutral surface color, no haptic on press.
  - `accessibilityState={{ disabled: true }}`.
  - `onPress`: calls `Linking.openSettings()` directly. No toast. The banner above already states the same message, so a duplicated toast would add noise.

### `onboarding/AIConfirmScreen.tsx` — Continue gate

- Reads `available` from `useAIAvailabilityStore`.
- When `available === true`: shows existing confirmation copy ("Apple Intelligence detected") and an enabled Continue button.
- When `available === false`:
  - Headline switches to "Apple Intelligence unavailable."
  - Continue button label switches to `"Resolve to continue"`, `disabled`, neutral palette.
  - Pitch slides 1–3 still allow Skip — the gate is only at this confirmation beat.

### `SettingsScreen.tsx` — Developer toggle

In the existing `__DEV__`-only Developer section, add a single switch:

- Label: `"Force AI unavailable"`
- Bound to `devForceAIUnavailable` from `settingsStore`.
- `onValueChange` calls `setDevForceAIUnavailable(next)` which persists and immediately re-probes.

## Testing strategy

### Unit (Jest, `node` environment)

- `src/ai/__tests__/aiServiceFactory.test.ts`
  - `getAIService` returns a `MockAIService` instance.
  - `getAIService` returns the same instance on repeated calls.
  - `__resetFactoryForTests` clears the cache.
  - `probeAIAvailability` returns `{ available: true, displayName: 'Mock (development)' }` when the dev override is off (matches `MockAIService.displayName`).
  - `probeAIAvailability` returns `{ available: false, ... }` when `__DEV__` and `devForceAIUnavailable` are both true.
  - `probeAIAvailability` returns `{ available: false, ... }` when `service.isAvailable()` throws (simulate by spying on Mock).
- `src/state/__tests__/aiAvailabilityStore.test.ts`
  - `runProbe` sets `probing` true → false, writes `available` and `lastProbedAt`.
  - `setAvailability` sets fields without calling the factory.

### Component (RNTL, `jsdom` via `jest.ui.config.js`)

- `src/ui/components/__tests__/AIUnavailableBanner.test.tsx`
  - Renders nothing when store reports `available: true`.
  - Renders title, body, and Open Settings affordance when `available: false`.
  - Tapping Open Settings calls `Linking.openSettings`.
- `src/state/hooks/__tests__/useAIAvailabilityProbe.test.tsx`
  - Calls `runProbe` on mount.
  - Re-runs `runProbe` on `AppState` `'active'` transitions.
  - Removes the listener on unmount.
- Extend `CharacterSheetScreen.test.tsx`
  - FAB exposes `accessibilityState.disabled === true` when store reports `available: false`.
  - Pressing the disabled FAB calls `Linking.openSettings`, not router navigation.
- Extend `OnboardingScreens.test.tsx`
  - `AIConfirmScreen` Continue button disabled and labeled "Resolve to continue" when unavailable.
  - Banner copy renders "Apple Intelligence unavailable" headline branch.
- Extend `SettingsScreen.test.tsx`
  - Developer section is hidden when `__DEV__` is false.
  - Toggle flips `settingsStore.devForceAIUnavailable` and triggers a probe re-run.

### Manual / device verification

Documented as acceptance steps for the implementation plan, not as tests:

1. Fresh install, force-quit, relaunch → no banner, FAB enabled.
2. Settings → Developer → Force AI unavailable → banner appears top of screen, FAB muted, "Open Settings" tap opens iOS Settings.
3. Toggle off in Developer → banner clears within ~1 frame, FAB re-enables.
4. Toggle on → background app → flip Apple Intelligence in iOS Settings → return to app → banner state matches the latest probe (manual sanity for the `AppState` re-probe path).

## Acceptance criteria

This sub-project is complete when:

1. `getAIService()` returns a `MockAIService` instance and is the only place the rest of the app constructs an AI service.
2. `aiAvailabilityStore` reflects the most recent probe result; `lastProbedAt` updates on every successful probe.
3. The banner appears on every screen (onboarding included) when `available === false` and disappears within one frame when it flips back to `true`.
4. The FAB on `CharacterSheetScreen` is visually disabled and routes to `Linking.openSettings()` when unavailable.
5. The `AIConfirmScreen` Continue button is disabled with the resolve copy when unavailable.
6. The Developer Settings toggle flips availability immediately on the device.
7. All Jest and RNTL tests listed above pass; coverage on `aiServiceFactory.ts` is 100% (the file is small and pure).
8. Lint and `tsc --noEmit` pass with zero warnings.

## Risks and open questions

- **`AppState` flake on iOS Simulator.** Simulator can drop `'active'` events on quick app-switches. Acceptable for MVP — real device behavior is reliable. Documented in the test plan.
- **Production behavior of `devForceAIUnavailable`.** The factory ignores it when `__DEV__` is false, but the field still exists in the settings table. No data leakage; just a dead key in production. Acceptable.
- **Banner during Pitch slides.** The banner renders at the root layout, so it appears on Pitch slides 1–3 too. This is fine — slides are skippable, no XP is at stake. UI_SPEC §"Runtime AI unavailability" doesn't carve them out.
- **Phase 5 Apple integration.** The `try/catch` in `probeAIAvailability` is the integration seam. When `AppleAIService.isAvailable()` lands, no other file changes for this sub-project's behavior to keep working.

## Out of scope (tracked elsewhere)

- All animation work (XP reveal, bar fill, level-up burst, decay shimmer, streak milestones) — Phase 4 sub-project 2.
- `expo-notifications` setup, daily morning notification, day-3 inactivity nudge — Phase 4 sub-project 3.
- `expo-speech-recognition` voice input — Phase 4 sub-project 3.
- First-decay explainer modal and mission generation polish — Phase 4 sub-project 4.
- App icon, splash screen, store metadata — Phase 4 sub-project 5.
- Real `AppleAIService` — Phase 5.
- `GeminiNanoService` and Android distribution — Phase 6.
