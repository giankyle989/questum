# Architecture

## Module structure

```
src/
  ai/
    AIService.ts          # Interface — what the rest of the app depends on
    MockAIService.ts      # Keyword classifier, used Phases 1-4
    AppleAIService.ts     # Apple Foundation Models, Phase 5
    GeminiNanoService.ts  # Gemini Nano via AICore, Phase 5
    aiServiceFactory.ts   # Picks the right implementation based on platform/availability
    schema.ts             # Zod schema for AI output validation
    prompts.ts            # System prompts and few-shot examples

  game/
    xp.ts                 # XP curves, level calculations
    decay.ts              # Decay calculation (pure)
    streak.ts             # Streak tracking and multiplier
    missions.ts           # Mission generation, matching, completion
    validation.ts         # Post-AI clamping (caps XP, attribute gains)
    constants.ts          # All tunable game constants in one place
    __tests__/            # Unit tests for every game function

  storage/
    db.ts                 # SQLite connection, migrations
    repositories/
      characterRepo.ts
      logRepo.ts
      missionRepo.ts
      settingsRepo.ts
    migrations/
      001_initial.sql
      ...

  state/
    characterStore.ts     # Zustand store for current character state
    logsStore.ts
    missionsStore.ts
    settingsStore.ts

  ui/
    screens/
      OnboardingScreen.tsx
      CharacterSheetScreen.tsx
      LogEntryScreen.tsx
      MissionsScreen.tsx
      HistoryScreen.tsx
      SettingsScreen.tsx
    components/
      AttributeBar.tsx
      LevelUpModal.tsx
      XPGainReveal.tsx
      MissionCard.tsx
      StreakIndicator.tsx
      ...

  notifications/
    notifications.ts       # Push notification setup and scheduling

  app/                     # Expo Router routes
    _layout.tsx
    index.tsx              # Routes to onboarding or main
    (main)/
      character.tsx
      log.tsx
      missions.tsx
      history.tsx
      settings.tsx
```

## Dependency rules

These rules are non-negotiable. Violating them will cause technical debt that compounds quickly.

1. **`game/` depends on nothing at runtime.** Pure functions only. No React, no storage, no state management, no AI service. Game logic must be testable with `node --test` if needed.
2. **`ai/` depends on nothing else in the app at runtime.** Returns parsed JSON via the AIService interface. Cannot import runtime values from `game/`, `storage/`, `ui/`, or `state/`.
3. **`storage/` depends on nothing else.** Repositories return plain data; they don't apply game rules.
4. **`state/` depends on `storage/` and `game/`.** Stores call repositories and apply game functions.
5. **`ui/` depends on `state/`.** Screens and components read from stores and call store actions. UI never imports from `game/`, `storage/`, or `ai/` directly.
6. **`notifications/` depends on `state/`.** Reads schedule data from settings store.

### Type-only import exception

Rules 1 and 2 are about **runtime** dependencies. Type-only imports (`import type ...`) between `game/` and `ai/` are allowed because they erase at compile time and cannot affect runtime behavior or test isolation. Specifically:

- `game/validation.ts` may `import type { LogResult } from '@/ai/AIService'` to clamp the AI's output.
- `ai/schema.ts` may `import type { Attribute } from '@/game/constants'` to keep the Zod enum aligned with the canonical attribute list.

Any non-type import between these layers is a violation. Lint rule (Phase 1): `@typescript-eslint/consistent-type-imports` enforces explicit `import type` syntax so violations are visible in code review.

If a feature requires breaking the runtime rules, that's a signal the architecture needs revision — propose the change explicitly, don't slip it in.

## Data flow: a log submission

This is the canonical flow. Every feature follows the same pattern.

```
1. User types log text in LogEntryScreen
2. UI calls logsStore.submitLog(text)
3. logsStore calls aiService.classifyLog(text, activeMissions)
4. aiService returns LogResult (validated against Zod schema)
5. logsStore calls game.validation.clampLogResult(result) → cleaned result
6. logsStore calls game.xp.applyXPToCharacter(character, cleanedResult) → new character state
7. logsStore calls game.streak.updateStreak(character, today) → updated streak
8. logsStore calls game.missions.checkCompletions(missions, cleanedResult) → completed missions
9. logsStore persists updated character, log entry, mission state via storage repositories
10. logsStore updates Zustand state
11. UI subscribes to store, renders new state, plays XP gain animation
```

Notice: AI is one step. Game logic is several pure-function steps. UI never sees AI output directly.

## App startup sequence

Store-level filtering (PRD §5.2) ensures the app only installs on supported devices, so the routing assumes AI is available. The runtime AI probe is a sanity check that drives an inline banner (UI_SPEC §"Runtime AI unavailability") when it fails, but it does not change the route.

```
1. App launches
2. Load settings from storage
3. Probe on-device AI availability → cache result for the session
4. If onboarding_complete = false:
   a. Route to OnboardingScreen (pitch slides → AI confirmation → character creation → first log)
5. If onboarding_complete = true:
   a. Load character, run decay calculation for elapsed days
   b. Route to CharacterSheetScreen
6. Schedule daily morning notification (if enabled)
7. Run mission generation tick (expire stale, generate today's daily set and this week's quest if not already present — see `GAME_RULES.md`)
8. If the AI probe in step 3 returned false, the screens render with an inline AI-unavailable banner per UI_SPEC; log entry is disabled until the next foreground probe succeeds
```

## AIService interface

The contract every implementation must satisfy.

```typescript
// src/ai/AIService.ts

export interface AIService {
  /** Returns true if this implementation can run on the current device. */
  isAvailable(): Promise<boolean>;

  /**
   * Classifies a log into structured XP/attribute data.
   * Implementations must respect `signal` — if aborted, throw a DOMException
   * with name "AbortError" rather than resolving. Implementations should also
   * apply an internal timeout (default 10s) and abort themselves if exceeded.
   */
  classifyLog(input: ClassifyLogInput, signal?: AbortSignal): Promise<LogResult>;

  /** Human-readable name for settings screen ("Apple Intelligence", "Gemini Nano", "Mock"). */
  readonly displayName: string;
}

export interface ClassifyLogInput {
  text: string;
  activeMissions: ActiveMissionSummary[];
  currentStreak: number;
  timeOfDay?: string;
}

export interface LogResult {
  summary: string;
  primaryAttribute: Attribute;
  attributeXP: Record<Attribute, number>;
  totalXP: number;
  matchedMissions: string[];
  confidence: number;
  improvementDetected?: boolean;
}
```

The mock and real implementations both satisfy this. The factory selects which to use.

## Decay timing

Decay is calculated **on app foreground**, not via background tasks. Reasons:

- Background task reliability is poor on both platforms
- Battery impact concerns
- The user only cares about decay when they see the character

### Triggers

Subscribe to React Native's `AppState` and recalculate decay on every transition to `active`. This covers:

- Cold start
- Resume from background after any duration (including across midnight)

The recalc is idempotent: it reads `lastLogDay` and the current local date and applies the same compound formula. Re-running it within the same day is a no-op.

**Known edge case** (not solved in MVP): if the app remains foregrounded continuously across local midnight, no `active` transition fires and decay won't recalculate until the next foreground transition. Acceptable — the user is engaged with the app, decay is the wrong concern, and the next log will refresh state anyway.

### Steps on each foreground

1. Read `lastLogDay` from `logRepo.getLastLogDay()`
2. Compute `daysSinceLastLog` against today (device local date)
3. Run the decay function over `daysSinceLastLog` (with grace and pause adjustments — see `GAME_RULES.md`)
4. If any attribute's `inProgressXP` changed, persist updated values
5. If first decay ever for this user (any non-zero reduction with `firstDecayShown=false`), set the explainer modal flag for the UI to pick up

## Persistence strategy

- Every state change writes to SQLite immediately (synchronous-feeling via Zustand actions)
- No optimistic UI — the AI call is the only async step the user waits on
- App can be killed at any time without data loss after the AI call completes
