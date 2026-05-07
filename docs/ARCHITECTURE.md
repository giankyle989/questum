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
      WaitlistScreen.tsx       # Soft gate
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
    index.tsx              # Routes to onboarding, main, or waitlist
    (main)/
      character.tsx
      log.tsx
      missions.tsx
      history.tsx
      settings.tsx
```

## Dependency rules

These rules are non-negotiable. Violating them will cause technical debt that compounds quickly.

1. **`game/` depends on nothing.** Pure functions only. No React, no storage, no state management, no AI service. Game logic must be testable with `node --test` if needed.
2. **`ai/` depends on nothing else in the app.** Returns parsed JSON via the AIService interface. Cannot import from `game/`, `storage/`, `ui/`, or `state/`.
3. **`storage/` depends on nothing else.** Repositories return plain data; they don't apply game rules.
4. **`state/` depends on `storage/` and `game/`.** Stores call repositories and apply game functions.
5. **`ui/` depends on `state/`.** Screens and components read from stores and call store actions. UI never imports from `game/`, `storage/`, or `ai/` directly.
6. **`notifications/` depends on `state/`.** Reads schedule data from settings store.

If a feature requires breaking these rules, that's a signal the architecture needs revision — propose the change explicitly, don't slip it in.

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

```
1. App launches
2. Load settings from storage
3. Probe on-device AI availability → cache result
4. If no character exists → route to OnboardingScreen
5. If on-device AI not available AND user is post-onboarding → route to WaitlistScreen
6. Otherwise → load character, run decay calculation for elapsed days, route to CharacterSheetScreen
7. Schedule daily morning notification (if enabled)
8. Generate today's daily missions if not already generated
```

## AIService interface

The contract every implementation must satisfy.

```typescript
// src/ai/AIService.ts

export interface AIService {
  /** Returns true if this implementation can run on the current device. */
  isAvailable(): Promise<boolean>;

  /** Classifies a log into structured XP/attribute data. */
  classifyLog(input: ClassifyLogInput): Promise<LogResult>;

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

Decay is calculated **on app open**, not via background tasks. Reasons:

- Background task reliability is poor on both platforms
- Battery impact concerns
- The user only cares about decay when they see the character

On app open:
1. Calculate days elapsed since last log (or last app open if longer)
2. For each elapsed day, run decay function
3. Persist updated XP values
4. If first decay ever for this user, queue the explainer modal

## Persistence strategy

- Every state change writes to SQLite immediately (synchronous-feeling via Zustand actions)
- No optimistic UI — the AI call is the only async step the user waits on
- App can be killed at any time without data loss after the AI call completes
