# Phase 3 — UI with Mock AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional Questum app on iPhone via Expo Go using `MockAIService` as the AI layer. After this phase, a user can complete onboarding, submit logs, see XP applied to attributes, level up, view missions, scroll history, and change settings. The app wires the complete data-flow pipeline: Log Entry → MockAI → game engine → SQLite → Zustand → UI. Every slice ends with the app in a runnable state on the device.

**Architecture:** Five vertical slices, each deployable to Expo Go in isolation. Slice 1 is the spine (submit-log flow end-to-end); Slices 2–5 layer on top. MockAIService is instantiated directly — no factory file (Phase 5). The Phase 5 AI swap point is submitLog's deps.aiService parameter.

**Tech stack:** Same as Phase 1/2. No new libraries. NativeWind for styling, Expo Router for navigation, Zustand for state, expo-sqlite for persistence, Jest + RNTL for tests.

**Spec sources (re-read before each section):**
- `docs/UI_SPEC.md` — screen layout and component contracts
- `docs/MOCK_AI.md` — keyword classifier spec
- `docs/AI_CONTRACT.md` — LogResult shape and validation
- `docs/SCHEMA.md` — SQLite tables (migration 001 baseline; migration 002 added in Phase 3 — see Task 1.2.5)
- `docs/GAME_RULES.md` — XP, decay, streak, mission rules
- `docs/CONVENTIONS.md` — naming, testing, commit format

**Out of scope for Phase 3:**
- Animations beyond basic press states (Phase 4)
- Push notifications (Phase 4)
- Voice input (Phase 4)
- AI-unavailable banner and runtime AI probe (Phase 4)
- First-decay explainer modal UI (Phase 4 — Phase 3 sets the flag only)
- Mission generation weighted toward weak attributes (Phase 3 wires existing engine functions as-is; Phase 4 refines the algorithm)
- AI factory file (aiServiceFactory.ts) — Phase 5
- Real AI implementations (Phase 5)
- Android / Gemini Nano (Phase 6)

---

## Timezone and date construction rule

All **calendar-day** (`YYYY-MM-DD`) date constructions in app code go through `src/lib/clock.ts`. Full ISO 8601 datetimes (`YYYY-MM-DDTHH:mm:ss.sssZ`) — used for `created_at`/`completed_at` audit fields — may use `new Date().toISOString()` directly. The rule applies to anything compared with a calendar day in the engine.

No raw `.toISOString().slice(0, 10)` or `.toISOString().substring(0, 10)` calls anywhere outside `src/lib/clock.ts`. Full `.toISOString()` calls for absolute timestamps (`created_at`, `completed_at`) are fine. submitLog, the decay hook, and mission generation tick all call `todayLocalISODate()` from clock.ts for calendar days. This is enforced by code review; any deviation is a bug.

The game engine functions in src/game/ take ISODate strings as parameters — they do not call Date.now() themselves. clock.ts is the single crossing point from wall-clock time into the game engine's string-based date world.

**Timezone drift prevention:** `todayLocalISODate()` uses `getFullYear()`/`getMonth()`/`getDate()` (local-time getters), not `toISOString()` (which is UTC-based and will give the wrong date near midnight for users west of UTC). This is the only correct implementation.

---

## File structure for Phase 3

End-state additions/modifications under the repo:

```
src/
  ai/
    MockAIService.ts              # NEW: keyword classifier per MOCK_AI.md
    __tests__/
      MockAIService.test.ts       # NEW: 100% coverage required
  lib/
    clock.ts                      # NEW: todayLocalISODate(now?: Date): ISODate
    __tests__/
      clock.test.ts               # NEW: 100% coverage required
  state/
    submitLog.ts                  # NEW: dep-injected composition function
    hooks/
      useAppForegroundDecay.ts    # NEW: AppState decay hook
    __tests__/
      submitLog.test.ts           # NEW: integration tests with better-sqlite3
    characterStore.ts             # FILL IN: hydrate(), createCharacter()
    logsStore.ts                  # FILL IN: submitLog(), cancelSubmit(), hydrate()
    missionsStore.ts              # FILL IN: hydrate(), generateForToday()
    settingsStore.ts              # FILL IN: hydrate(), all setters
  storage/
    repositories/
      characterRepo.ts            # FILL IN: replace all NOT_IMPL stubs
      logRepo.ts                  # FILL IN: replace all NOT_IMPL stubs
      missionRepo.ts              # FILL IN: replace all NOT_IMPL stubs
      settingsRepo.ts             # FILL IN: replace all NOT_IMPL stubs
      __tests__/
        characterRepo.test.ts     # NEW
        logRepo.test.ts           # NEW
        missionRepo.test.ts       # NEW
        settingsRepo.test.ts      # NEW
  ui/
    components/
      AttributeBar.tsx            # NEW
      StreakIndicator.tsx         # NEW
      MissionCard.tsx             # NEW
      LogRow.tsx                  # NEW
    screens/
      CharacterSheetScreen.tsx    # NEW
      LogEntryScreen.tsx          # NEW
      MissionsScreen.tsx          # NEW
      HistoryScreen.tsx           # NEW
      SettingsScreen.tsx          # NEW
      onboarding/
        PitchSlides.tsx           # NEW
        AIConfirmScreen.tsx       # NEW
        CharacterCreationScreen.tsx  # NEW
        FirstLogScreen.tsx        # NEW
      __tests__/
        CharacterSheetScreen.test.tsx  # NEW
        LogEntryScreen.test.tsx        # NEW
        MissionsScreen.test.tsx        # NEW
        HistoryScreen.test.tsx         # NEW
        SettingsScreen.test.tsx        # NEW
        OnboardingScreens.test.tsx     # NEW
app/
  _layout.tsx                     # MODIFY: settingsHydrated gate + decay hook + mission tick
  index.tsx                       # MODIFY: settingsHydrated guard before redirect
  (main)/
    _layout.tsx                   # MODIFY: add presentation:modal to log route
    character.tsx                 # MODIFY: wire CharacterSheetScreen
    log.tsx                       # MODIFY: wire LogEntryScreen
    missions.tsx                  # MODIFY: wire MissionsScreen
    history.tsx                   # MODIFY: wire HistoryScreen
    settings.tsx                  # MODIFY: wire SettingsScreen
  onboarding/
    _layout.tsx                   # NEW: Stack layout, headerShown: false
    index.tsx                     # NEW: Redirect to /onboarding/pitch
    pitch.tsx                     # NEW: renders PitchSlides
    ai-confirm.tsx                # NEW: renders AIConfirmScreen
    creation.tsx                  # NEW: renders CharacterCreationScreen
    first-log.tsx                 # NEW: renders FirstLogScreen
```

**Mission activity design decision:** Mission activity is determined by `generated_for === todayLocalISODate()` (daily) or `generated_for === mondayOf(todayLocalISODate())` (weekly), not by a stored `expires_at`. The DB column `expires_at TEXT NOT NULL` exists in `001_initial.ts` and is populated on insert for schema compliance, but its value is never read by the engine or queries. This sidesteps timezone math on stored datetime strings entirely and matches GAME_RULES.md without divergence. The `Mission` interface keeps `expiresAt: string` for now (the column exists); it is marked `@deprecated` — a Phase 4+ migration could drop the column.

**Existing files that must NOT be modified in Phase 3:**
- All files under src/game/ (Phase 2 complete, 100% coverage maintained)
- src/ai/AIService.ts (modified in Task 1.0.5 only — see below; frozen after that)
- src/ai/schema.ts (Zod schema frozen)
- src/storage/db.ts (DbDriver interface frozen)
- src/storage/migrationRunner.ts (frozen)
- src/storage/migrations/001_initial.ts (deployed migration, immutable)

**Repository injection pattern:** All repo functions gain a `db: DbDriver` first parameter in Phase 3. The production call sites pass `await getDb()`. Tests inject a `better-sqlite3` driver. This is a breaking signature change from the Phase 1 stubs (which had no parameters). Update all call sites in stores accordingly — the compiler will catch missed sites.

---

## intra-layer dependency rules (enforced in review)

These apply in addition to the rules in ARCHITECTURE.md:

1. `src/ui/` files may NOT import from `src/storage/repositories/` directly. They read state from Zustand stores only.
2. `src/ui/` files may NOT import from `src/ai/` directly. The AI call goes through `logsStore.submitLog`.
3. `src/state/submitLog.ts` receives its deps (aiService, db) as parameters — it does not call `getDb()` or `new MockAIService()` directly. Stores call it and pass deps.
4. `src/state/hooks/` hooks may call `getDb()` directly (they are production composition code, not testable units).
5. No imports from `react`, `react-native`, or `expo-*` in `src/state/submitLog.ts` — it is pure composition logic.


---

## Task 0 — Verify on-device assumptions

Do these before writing any Slice 1 code. They are gates, not suggestions.

### Task 0.1 — Verify SQLite persistence across Expo Go Reload

**Files:** None. Observation only.

- [ ] **Step 1:** Launch the app in Expo Go on iPhone. Shake device, tap Reload. Observe whether the migration runner re-runs or skips the already-applied migration 001.

Expected: schema_version row already exists — runner skips. The SQLite file persists across JS bundle reloads.

- [ ] **Step 2:** If migration runs fresh on every reload: add comment at top of `src/storage/db.ts`: `// KNOWN: Expo Go SQLite reload behavior — DB resets on JS reload`. Note this in dev iteration notes (manual testing will need re-seeding after each Reload).

- [ ] **Acceptance:** Confirmed one of: (a) SQLite persists, or (b) resets on reload — noted in db.ts.

### Task 0.2 — Verify Reanimated 4 + React 19 warnings

**Files:** Conditional change to `babel.config.js` only if needed.

- [ ] **Step 1:** With app running in Expo Go, inspect terminal for `[Reanimated]` warnings.

- [ ] **Step 2:** If present: ensure `react-native-reanimated/plugin` is LAST in the Babel plugins array. Run `npx expo start --clear`. Confirm warnings are gone.

- [ ] **Step 3:** Verify React 19 strict-mode double-invoke does not cause DB init errors. The `cancelled` guard already in `app/_layout.tsx`'s `useEffect` handles this. If not: add a `useRef` initialized-flag guard.

- [ ] **Acceptance:** Zero `[Reanimated]` warnings on app launch. DB migration succeeds exactly once per cold start.

```
git add babel.config.js
git commit -m "chore: fix Reanimated 4 babel plugin ordering for React 19 strict mode"
```
Skip this commit if no changes were needed.

---

## Slice 1 — Submit-log spine

**Goal:** Wire the full pipeline end-to-end. MockAIService + submitLog composition + repositories + stores + Character Sheet screen + Log Entry modal. After Task 1.11, a user can type a log on iPhone and see XP applied.

**Tasks in this slice:** 1.0, 1.0.5 (new), 1.1, 1.2, 1.2.5 (new), 1.3–1.11 = 14 tasks. Total plan task count: 26 (24 original + 2 new for Tasks 1.0.5 and 1.2.5).

**After this slice ships:** User opens the app, sees Character Sheet with six attribute bars. Taps the "+" FAB, types "ran 5km this morning", submits. After a brief loading state, the CON bar updates with XP gain. Streak shows "1 day".

---

### Task 1.0.5 — Add `sourceId` to AIService interface

**Files:**
- Modify: `src/ai/AIService.ts`
- Modify: `src/ai/__tests__/MockAIService.test.ts` (or wherever AIService interface compliance is exercised — add a compile-time assertion)

**Why:** `submitLog` writes `aiSource` to the DB. Hardcoding `"mock"` means the Phase 5 swap requires hunting for a string literal. Putting the source identifier on the interface makes the swap zero-touch: the real implementation sets `sourceId = 'apple'` and `submitLog` picks it up automatically.

- [ ] **Step 1: Modify `src/ai/AIService.ts`.**

Add one readonly property to the `AIService` interface:

```typescript
export interface AIService {
  readonly sourceId: 'apple' | 'gemini' | 'mock';
  readonly displayName: string;
  isAvailable(): Promise<boolean>;
  classifyLog(input: ClassifyLogInput, signal?: AbortSignal): Promise<LogResult>;
}
```

If `displayName` already exists in the interface, only `sourceId` is new.

- [ ] **Step 2: Add a compile-time assertion test.**

In the AIService test file, add a TypeScript-level check that any object satisfying `AIService` must have `sourceId` typed as `'apple' | 'gemini' | 'mock'`. A simple assignment to a typed variable is sufficient — this is a compile check, not a runtime assertion.

- [ ] **Step 3:** Run `npx tsc --noEmit`. Zero errors. (`MockAIService` in Task 1.1 will satisfy the new property; until Task 1.1 is done, TypeScript will flag the incomplete implementation — that is expected.)

- [ ] **Step 4: Commit.**
```
git add src/ai/AIService.ts
git commit -m "feat(ai): add sourceId readonly property to AIService interface"
```

---

### Task 1.1 — Implement MockAIService

**Files:**
- Create: `src/ai/MockAIService.ts`
- Create: `src/ai/__tests__/MockAIService.test.ts`
- Modify: `jest.config.js` (add to coverageThreshold)

**Coverage requirement:** 100% statements/branches/functions/lines.

- [ ] **Step 1: Write the failing tests.**

Tests must cover: schema validity for any input (normal, empty, long, unicode); determinism (same input → same output); STR/CON/INT keyword attribution; duration XP formulas (km, pages, chapters, hours); multi-attribute (lunch earns CON+CHA); totalXP cap at 100; improvement detection keywords (pr, personal best, longest, record); no-match fallback (confidence 0.2, totalXP 5, primaryAttribute STR); confidence formula (0.5 + 0.2 if matched>0 + 0.1 if matched>1 + 0.15 if has duration, capped 0.95); mission matching (>=2 content words → match); abort signal throws AbortError.

Key fixture values to verify (from MOCK_AI.md spec):

| Input | Expected attributeXP |
|---|---|
| "went to the gym" | STR: 15 (no duration) |
| "ran 5km" | CON: 15 (5*6=30min, 30/2=15) |
| "read 40 pages" | INT: 40 (40*2=80min, 80/2=40) |
| "read 3 chapters" | INT: 30 (3*20=60min, 60/2=30) |
| "studied for 2 hours" | INT: 50 (2*60=120min, 120/2=60, capped at 50) |
| "did the thing" | confidence: 0.2, totalXP: 5 |

- [ ] **Step 2:** Run `npm test -- MockAIService`. Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement `src/ai/MockAIService.ts`.**

Follow MOCK_AI.md exactly. Implementation checklist:
- Class `MockAIService implements AIService`
- `readonly sourceId = 'mock' as const`
- `readonly displayName = 'Mock (development)'`
- `async isAvailable(): Promise<boolean> { return true; }`
- In `classifyLog`: check `signal?.aborted` first → throw `new DOMException('Aborted', 'AbortError')`
- Tokenize with `text.toLowerCase().split(/[s,.!?;:'"()]+/).filter(Boolean)`
- Match ATTRIBUTE_KEYWORDS map (exact list from MOCK_AI.md — all 6 attributes)
- Duration patterns: hours (num*60), minutes (num*1), km (num*6), pages (num*2), chapters (num*20). First match wins.
- Per-attribute XP: 0 if no keyword match; 15 if match + no duration; `Math.min(50, Math.max(10, Math.floor(durationMinutes / 2)))` if match + duration
- totalXP: `Math.min(100, sumOfNonZeroAttributeXP)`
- primaryAttribute: highest-XP attribute; ATTRIBUTES order breaks ties; STR if no matches
- improvementDetected: `/(longest|farthest|heaviest|pr|personal best|record|more than|harder than|pushed)/i.test(text)`
- Mission matching: filter active missions, for each tokenize description, find intersection with content tokens (length > 3); if >=2 overlap → match
- No-match: return confidence 0.2, totalXP 5, all attributeXP zeros, primaryAttribute STR
- summary: `text.slice(0, 60) || 'Log'` (guard against empty string failing the min:1 schema)
- Return type must satisfy `LogResult` with ALL six keys in attributeXP (use `ATTRIBUTES.reduce` to initialize to zero)

- [ ] **Step 4:** Run `npm test -- MockAIService`. All tests pass.

- [ ] **Step 5:** Add to `jest.config.js` coverageThreshold:
```javascript
'./src/ai/MockAIService.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
```
Run `npm run test:coverage` — confirm 100%.

- [ ] **Step 6: Commit.**
```
git add src/ai/MockAIService.ts src/ai/__tests__/MockAIService.test.ts jest.config.js
git commit -m "feat(ai): implement MockAIService keyword classifier with 100% coverage"
```

---

### Task 1.2 — Implement src/lib/clock.ts

**Files:**
- Create: `src/lib/clock.ts`
- Create: `src/lib/__tests__/clock.test.ts`
- Modify: `jest.config.js` (add to coverageThreshold)

**Coverage requirement:** 100%.

- [ ] **Step 1: Write the failing tests.**

Filename: `src/lib/__tests__/clock.test.ts`

Import `todayLocalISODate` and `daysAgoLocalISODate` from `@/lib/clock`. Tests:

`todayLocalISODate`:
- returns YYYY-MM-DD format (regex match on default call)
- uses provided Date: `new Date(2026, 4, 8)` → `'2026-05-08'`
- zero-pads months: `new Date(2026, 0, 5)` → `'2026-01-05'`
- handles December 31: `new Date(2026, 11, 31)` → `'2026-12-31'`
- defaults to new Date() when no argument (regex match only — cannot freeze time)

`daysAgoLocalISODate`:
- `daysAgoLocalISODate(0, new Date(2026, 4, 8))` → `'2026-05-08'` (0 days ago = today)
- `daysAgoLocalISODate(30, new Date(2026, 4, 8))` → `'2026-04-08'` (30 days ago)
- `daysAgoLocalISODate(1, new Date(2026, 0, 1))` → `'2025-12-31'` (year boundary)

- [ ] **Step 2:** Run `npm test -- clock`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/clock.ts`.**

```typescript
import type { ISODate } from '@/game/calendar';

/**
 * Returns the device-local calendar date as YYYY-MM-DD.
 * ALL calendar-day Date->ISODate conversions in app code go through this function.
 * Uses local-time getters (getFullYear/getMonth/getDate), NOT toISOString()
 * which returns UTC and gives the wrong date near midnight west of UTC.
 */
export function todayLocalISODate(now: Date = new Date()): ISODate {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the local calendar date N days before `now` as YYYY-MM-DD.
 * Use this instead of raw `new Date(Date.now() - n * 86_400_000).toISOString().slice(0,10)`.
 * Correctly handles DST and year boundaries.
 *
 * DST note: subtracting n * 86_400_000 ms is approximate around DST transitions
 * (a 23h or 25h day is possible). For the only current consumer — missionsStore's
 * 30-day `recentlyCompleted` window — a one-day drift is harmless. If a future
 * caller needs an exact day-count, construct the date in local time directly
 * instead of relying on this function.
 */
export function daysAgoLocalISODate(n: number, now: Date = new Date()): ISODate {
  const past = new Date(now.getTime() - n * 86_400_000);
  return todayLocalISODate(past);
}
```

- [ ] **Step 4:** Run `npm test -- clock`. All tests pass.

- [ ] **Step 5:** Add to coverageThreshold in `jest.config.js`:

```javascript
'./src/lib/clock.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
```

- [ ] **Step 6: Commit.**
```
git add src/lib/clock.ts src/lib/__tests__/clock.test.ts jest.config.js
git commit -m "feat(lib): add clock.ts — single Date-to-ISODate crossing point"
```

---

---

### Task 1.2.5 — Add migration 002: `generated_for` column on missions

**Files:**
- Create: `src/storage/migrations/002_missions_generated_for.ts`
- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrationRunner.test.ts` (or its sibling test file)
- Modify: `docs/SCHEMA.md`

**Why:** The `missionRepo` queries filter by `generated_for`, but that column is absent from `001_initial.ts`. This task adds the column and index via a new migration before Task 1.3 is implemented.

- [ ] **Step 1: Create `src/storage/migrations/002_missions_generated_for.ts`.**

```typescript
export const MIGRATION_002 = `
ALTER TABLE missions ADD COLUMN generated_for TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_missions_generated_for ON missions(type, generated_for, completed_at);
`;
```

The empty-string default satisfies the NOT NULL constraint for any missions rows inserted before this migration ran. The compound index `(type, generated_for, completed_at)` supports the `getActiveDailyMissions` and `getActiveWeeklyMissions` queries.

- [ ] **Step 2: Register MIGRATION_002 in `src/storage/migrations/index.ts`.**

Add an import and append to the MIGRATIONS array:

```typescript
import { MIGRATION_001 } from './001_initial';
import { MIGRATION_002 } from './002_missions_generated_for';

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, sql: MIGRATION_002 },
];
```

The migration runner applies migrations in version order; any DB already at version 1 will receive migration 002 on next cold start.

- [ ] **Step 3: Add migration 002 tests to `src/storage/migrationRunner.test.ts`** (or the sibling test file that already covers migration 001).

Add three new test cases:
- Migration 002 applies cleanly on top of migration 001 (no error thrown)
- After migration 002, the `generated_for` column exists on the `missions` table with a NOT NULL constraint (verify via `PRAGMA table_info(missions)`)
- After migration 002, the index `idx_missions_generated_for` exists (verify via `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_missions_generated_for'`)

- [ ] **Step 4: Update `docs/SCHEMA.md` — `## Missions` section.**

Add `generated_for` to the canonical CREATE TABLE definition:

```sql
CREATE TABLE missions (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL,
  description     TEXT NOT NULL,
  attribute       TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  type            TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  bonus_xp        INTEGER NOT NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  target          INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK (status IN ('active', 'completed', 'expired')),
  generated_at    TEXT NOT NULL,
  generated_for   TEXT NOT NULL DEFAULT '',  -- Phase 3 addition (migration 002)
  expires_at      TEXT NOT NULL,
  completed_at    TEXT
);
```

Add the new index to the index list in SCHEMA.md:
- `idx_missions_generated_for` on `(type, generated_for, completed_at)` — supports active-mission lookup queries

Add a note: "The `generated_for` column was added in Phase 3 via migration 002. It records the calendar day (daily) or Monday of the week (weekly) for which a mission was generated. Mission active/inactive state is determined by comparing this column to the current day — `expires_at` is populated for schema compliance only."

- [ ] **Step 5:** Run `npm test -- migrationRunner`. All migration tests (001 and 002) pass.

- [ ] **Step 6: Commit.**
```
git add src/storage/migrations/002_missions_generated_for.ts src/storage/migrations/index.ts src/storage/migrationRunner.test.ts docs/SCHEMA.md
git commit -m "feat(storage): add migration 002 for missions.generated_for"
```

---

### Task 1.3 — Implement all four repositories

**Files:**
- Modify: `src/storage/repositories/characterRepo.ts`
- Modify: `src/storage/repositories/logRepo.ts`
- Modify: `src/storage/repositories/missionRepo.ts`
- Modify: `src/storage/repositories/settingsRepo.ts`
- Create: `src/storage/repositories/__tests__/characterRepo.test.ts`
- Create: `src/storage/repositories/__tests__/logRepo.test.ts`
- Create: `src/storage/repositories/__tests__/missionRepo.test.ts`
- Create: `src/storage/repositories/__tests__/settingsRepo.test.ts`

**Breaking signature change:** All repo functions gain `db: DbDriver` as their first parameter. The Phase 1 stubs had no parameters. TypeScript will report call-site errors in stores — fix all in Task 1.5.

**Test setup pattern (all four test files):** Import `Database from "better-sqlite3"`, `createNodeSqliteDriver` from `@/storage/testHelpers`, `MIGRATION_001` from `@/storage/migrations/001_initial`, and `MIGRATION_002` from `@/storage/migrations/002_missions_generated_for`. In `beforeEach`: create in-memory DB with `:memory:`, run `db.exec(MIGRATION_001)` then `db.exec(MIGRATION_002)` (apply both migrations in order to reach the correct schema), wrap in `createNodeSqliteDriver`. In `afterEach`: call `db.close()`.

**Prerequisites:** Task 1.2.5 must be complete before implementing Task 1.3 — the `generated_for` column must exist in the schema for the missionRepo queries to compile and run correctly.

- [ ] **Step 1: Write failing tests — characterRepo**

File: `src/storage/repositories/__tests__/characterRepo.test.ts`

Tests:
- `getCharacter(driver)` returns `null` on empty DB
- `createCharacter(driver, "Zara", "avatar_1")` inserts row; `getCharacter` returns `{ id: 1, name: "Zara", avatarId: "avatar_1", createdAt: <string> }`
- `createCharacter` called twice throws (unique constraint — id = 1)
- `getAttributeStates(driver)` returns empty array on fresh DB
- `updateAttributeStates(driver, [{ attribute: "CON", level: 2, inProgressXp: 300 }])` then `getAttributeStates` returns that row
- `updateAttributeStates` with all 6 attributes: `getAttributeStates` returns all 6 in ATTRIBUTES order (STR, DEX, CON, INT, WIS, CHA)
- `getStreak(driver)` on fresh DB returns `{ currentLength: 0, longestLength: 0 }` (seeded by getStreak itself via INSERT OR IGNORE)
- `updateStreak(driver, { currentLength: 5, longestLength: 10 })` then `getStreak` returns updated values

- [ ] **Step 2: Write failing tests — logRepo**

File: `src/storage/repositories/__tests__/logRepo.test.ts`

Fixture:
```typescript
const fixture = {
  text: "went for a run",
  createdAt: "2026-05-08T07:00:00.000Z",
  day: "2026-05-08",
  aiSummary: "Morning run",
  primaryAttribute: "CON" as const,
  totalXp: 25,
  confidence: 0.8,
  improvement: false,
  aiSource: deps.aiService.sourceId as const,
  attributeXp: { CON: 25 },
};
```

Tests:
- `getLastLogDay(driver)` returns `null` on empty DB
- `insertLog(driver, fixture)` returns `LogEntry` with assigned `id`, all fields correct, `improvement: false`
- `insertLog` with `improvement: true` — reads back as `true` (stored as integer 1, returned as boolean)
- `getRecentLogs(driver, 10, 0)` on empty DB returns `[]`
- `getRecentLogs(driver, 10, 0)` after 3 inserts returns most-recent-first (ordered by `created_at DESC`)
- `getLastLogDay` after inserts on two different days returns the more recent day
- `getDailyXpEarned(driver, "2026-05-08")` on empty DB returns `{}`
- `incrementDailyXpEarned(driver, "2026-05-08", { CON: 30, INT: 20 })` then `getDailyXpEarned` returns `{ CON: 30, INT: 20 }`
- `incrementDailyXpEarned` called twice accumulates: CON 30 + CON 20 = CON 50
- `attributeXp` on returned LogEntry includes only attributes with xp > 0 (sparse — no zero keys)

- [ ] **Step 3: Write failing tests — missionRepo**

File: `src/storage/repositories/__tests__/missionRepo.test.ts`

Fixture:
```typescript
const missionFixture = {
  id: "daily_con_cardio_2026-05-08",
  templateId: "daily_con_cardio",
  description: "Move your body for 20 minutes",
  attribute: "CON" as const,
  type: "daily" as const,
  bonusXp: 50,
  progress: 0,
  target: 1,
  status: "active" as const,
  generatedAt: "2026-05-08T00:00:00Z",
  generatedFor: "2026-05-08",
  // expiresAt is populated on insert but never read by queries — see mission activity design note
  expiresAt: "2026-05-09T00:00:00Z",
  completedAt: null,
};
```

Tests:
- `getActiveDailyMissions(driver, "2026-05-08")` returns `[]` on empty DB
- `getActiveWeeklyMissions(driver, "2026-04-27")` returns `[]` on empty DB (pass Monday of test week)
- `insertMissions(driver, [missionFixture])` then `getActiveDailyMissions(driver, "2026-05-08")` returns it (mission has `generatedFor: "2026-05-08"`)
- `getActiveDailyMissions(driver, "2026-05-09")` returns `[]` for the same mission (different day — not active)
- `insertMissions` with same id twice (INSERT OR IGNORE) returns single row, no error
- `markCompleted(driver, id, completedAt)`: status changes to `"completed"`, `completedAt` is set
- `getRecentlyCompleted(driver, "2026-05-01")`: returns missions with status = "completed" and `completedAt >= "2026-05-01"`

- [ ] **Step 4: Write failing tests — settingsRepo**

File: `src/storage/repositories/__tests__/settingsRepo.test.ts`

Tests:
- `getSetting(driver, "onboarding_complete")` returns `null` on empty DB
- `setSetting(driver, "onboarding_complete", "true")` then `getSetting` returns `"true"`
- `setSetting` called twice overwrites: final value wins
- `getAllSettings(driver)` on empty DB returns `{}`
- `getAllSettings` after two `setSetting` calls returns both keys
- `getSetting(driver, "last_decay_run_day")` compiles without error (verifies SettingKey union includes this key)

- [ ] **Step 5:** Run `npm test -- characterRepo logRepo missionRepo settingsRepo`. Expected: FAIL (module not found or NOT_IMPL throws).

- [ ] **Step 6: Implement characterRepo.ts.**

Add `db: DbDriver` first parameter to all exported functions. Remove NOT_IMPL stubs.

Implementation notes:
- `getCharacter(db)`: `SELECT id, name, avatar_id, created_at FROM character WHERE id = 1`. Map `avatar_id -> avatarId`, `created_at -> createdAt`.
- `createCharacter(db, name, avatarId)`: INSERT with `createdAt = new Date().toISOString()`. SELECT the inserted row to return it.
- `getAttributeStates(db)`: `SELECT attribute, level, in_progress_xp FROM attribute_state ORDER BY CASE attribute WHEN "STR" THEN 1 WHEN "DEX" THEN 2 WHEN "CON" THEN 3 WHEN "INT" THEN 4 WHEN "WIS" THEN 5 WHEN "CHA" THEN 6 END`. Map `in_progress_xp -> inProgressXp`.
- `updateAttributeStates(db, states)`: Use `withTransactionAsync`; for each state: `INSERT OR REPLACE INTO attribute_state (attribute, level, in_progress_xp) VALUES (?, ?, ?)`.
- `getStreak(db)`: `SELECT current_length, longest_length FROM streak WHERE id = 1`. If row is null: run `INSERT OR IGNORE INTO streak (id, current_length, longest_length) VALUES (1, 0, 0)` then return `{ currentLength: 0, longestLength: 0 }`. Map `current_length -> currentLength`, `longest_length -> longestLength`.
- `updateStreak(db, streak)`: `INSERT OR REPLACE INTO streak (id, current_length, longest_length) VALUES (1, ?, ?)`.

- [ ] **Step 7: Implement logRepo.ts.**

Add `db: DbDriver` first parameter to all exported functions.

Implementation notes:
- `insertLog(db, input)`: Two-step in a `withTransactionAsync`. (1) INSERT into `logs` with all scalar fields (`improvement` as integer: `input.improvement ? 1 : 0`), get `lastInsertRowId`. (2) For each key in `input.attributeXp` with value > 0: `INSERT INTO log_attribute_xp (log_id, attribute, xp) VALUES (?, ?, ?)`. Return assembled `LogEntry`.
- When reading back: `improvement` stored as integer 0/1, convert to boolean: `Boolean(row.improvement)`.
- `getRecentLogs(db, limit, offset)`: SELECT from `logs` with `ORDER BY created_at DESC LIMIT ? OFFSET ?`. For each log, fetch `attributeXp` via `SELECT attribute, xp FROM log_attribute_xp WHERE log_id = ?` and build sparse `Partial<Record<Attribute, number>>`.
- `getLastLogDay(db)`: `SELECT day FROM logs ORDER BY created_at DESC LIMIT 1`. Returns `string | null`.
- `getDailyXpEarned(db, day)`: `SELECT attribute, xp_earned FROM daily_xp_earned WHERE day = ?`. Reduce to sparse object (omit zeros).
- `incrementDailyXpEarned(db, day, gains)`: For each attribute with gain > 0: `INSERT INTO daily_xp_earned (day, attribute, xp_earned) VALUES (?, ?, ?) ON CONFLICT(day, attribute) DO UPDATE SET xp_earned = xp_earned + excluded.xp_earned`.
- `pruneDailyXpOlderThanDays(db, days)`: `DELETE FROM daily_xp_earned WHERE day < date("now", "-" || ? || " days")`.

- [ ] **Step 8: Implement missionRepo.ts.**

Add `db: DbDriver` first parameter to all exported functions. Map snake_case columns to camelCase in return objects (`template_id -> templateId`, `bonus_xp -> bonusXp`, `generated_at -> generatedAt`, `expires_at -> expiresAt`, `completed_at -> completedAt`).

Implementation notes:
- `getActiveDailyMissions(db, today: ISODate)`: `SELECT * FROM missions WHERE type = "daily" AND generated_for = ? AND completed_at IS NULL ORDER BY generated_at`. Active = generated today and not yet completed. `expires_at` is never read.
- `getActiveWeeklyMissions(db, mondayOfWeek: ISODate)`: `SELECT * FROM missions WHERE type = "weekly" AND generated_for = ? AND completed_at IS NULL ORDER BY generated_at`. Caller passes `mondayOf(today)`.
- `insertMissions(db, missions)`: `INSERT OR IGNORE` for each mission (idempotent — safe to call multiple times per day). When inserting, populate `expires_at` with a benign non-null value to satisfy the schema `NOT NULL` constraint: daily → `${addDays(m.generatedFor, 1)}T00:00:00Z`, weekly → `${addDays(m.generatedFor, 7)}T00:00:00Z`. This value is never read by any query.

  **Dependency note:** `missionRepo` imports `addDays` from `@/game/calendar`. This `storage → game/calendar` direction is intentional and permitted — `game/` is a pure utility layer with no reverse imports from `storage/`. Verify `game/calendar` has no import of anything from `storage/` (it must not) before merging.
- `markCompleted(db, id, completedAt)`: `UPDATE missions SET status = "completed", completed_at = ? WHERE id = ?`.
- `getRecentlyCompleted(db, sinceDay)`: `SELECT * FROM missions WHERE status = "completed" AND completed_at >= ? ORDER BY completed_at DESC`.

**Note:** The `expireBefore()` method is intentionally NOT implemented. Mission active state is determined by `generated_for` matching the current day, not by a stored `expires_at` timestamp. This eliminates timezone-sensitive datetime comparisons in SQL.

The `Mission` interface: add JSDoc `@deprecated Use `generatedFor` to determine activity. The `expiresAt` column is populated for schema compliance only.` to the `expiresAt` field.

- [ ] **Step 9: Implement settingsRepo.ts.**

Add `last_decay_run_day` to `SettingKey` union (missing from Phase 1 stub — required for Task 1.6 decay hook). Add `db: DbDriver` first parameter to all exported functions.

Implementation notes:
- `getSetting(db, key)`: `SELECT value FROM settings WHERE key = ?`. Returns `string | null`.
- `setSetting(db, key, value)`: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`.
- `getAllSettings(db)`: `SELECT key, value FROM settings`. Reduce into `Record<string, string>`.

- [ ] **Step 10:** Run `npm test -- characterRepo logRepo missionRepo settingsRepo`. All tests pass.

- [ ] **Step 10.5: Update `jest.config.js` coverage thresholds.**

Add the repository threshold entry to `coverageThreshold` in `jest.config.js`:
```javascript
coverageThreshold: {
  './src/game/': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './src/ai/MockAIService.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './src/lib/clock.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './src/storage/repositories/': { statements: 85, branches: 85, functions: 85, lines: 85 },
},
```

Run `npm run test:coverage -- --testPathPattern="characterRepo|logRepo|missionRepo|settingsRepo"` to confirm the 85% threshold passes.

- [ ] **Step 11:** Run `npx tsc --noEmit`. Expect type errors at store call sites (stores pass no `db` argument). This is expected — do not fix yet. Confirm errors appear only in store files, not in repo or test files.

- [ ] **Step 12: Commit.**
```
git add src/storage/repositories/characterRepo.ts src/storage/repositories/logRepo.ts src/storage/repositories/missionRepo.ts src/storage/repositories/settingsRepo.ts src/storage/repositories/__tests__/characterRepo.test.ts src/storage/repositories/__tests__/logRepo.test.ts src/storage/repositories/__tests__/missionRepo.test.ts src/storage/repositories/__tests__/settingsRepo.test.ts
git commit -m "feat(storage): implement all four repositories with better-sqlite3 integration tests"
```

---

### Task 1.4 — Implement src/state/submitLog.ts

**Files:**
- Create: `src/state/submitLog.ts`
- Create: `src/state/__tests__/submitLog.test.ts`

**No React imports allowed in this file.** Pure async composition — no Zustand, no RN, no Expo.

- [ ] **Step 1: Write failing tests.**

File: `src/state/__tests__/submitLog.test.ts`

Setup: better-sqlite3 in-memory DB with MIGRATION_001, real `MockAIService`, real repos.

Define `SubmitLogResult` return type in `submitLog.ts` before writing tests:
```typescript
export type SubmitLogResult =
  | { ok: true; levelUps: LevelUp[]; missionCompletions: string[] }
  | { ok: false; reason: "low-confidence" | "invalid-primary" | "aborted" | "storage-error" | "unknown" };
```

Tests:
- Happy path: submit "ran 5km", returns `{ ok: true }`, DB has 1 log row, `attribute_state` updated for CON, `streak.current_length = 1`
- Low-confidence input ("xyz abc" — MockAIService returns confidence 0.2): returns `{ ok: false, reason: "low-confidence" }`, DB has 0 log rows
- Invalid-primary: use a `jest.fn()` implementation of `AIService.classifyLog` returning a result with `primaryAttribute: 'INVALID' as Attribute` — an intentionally out-of-union value. All `attributeXP` values must be zero so that `validateLogResult` cannot fall back to a highest-XP attribute (it finds none and returns `{ ok: false, reason: 'invalid-primary' }`). Full fixture:
  ```typescript
  const stub = jest.fn().mockResolvedValue({
    summary: 'test log',
    primaryAttribute: 'INVALID' as Attribute, // intentionally invalid
    attributeXP: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    totalXP: 0,
    matchedMissions: [],
    confidence: 0.9,
    improvementDetected: false,
  });
  ```
  `validateLogResult` sees `primaryAttribute` is not a valid Attribute, tries to derive a fallback by finding the highest-XP attribute, finds all zero, and returns `{ ok: false, reason: 'invalid-primary' }`. Returns `{ ok: false, reason: "invalid-primary" }`, DB has 0 log rows
- Abort before AI: pass an already-aborted `AbortSignal` — returns `{ ok: false, reason: "aborted" }`
- Mission matching: seed DB with one active mission with description "Move your body for 20 minutes", submit "ran 5km cardio session" — returned `missionCompletions` is non-empty, mission status = "completed" in DB
- XP cap: seed `daily_xp_earned` with CON already at 200, submit another CON log — `daily_xp_earned` CON stays at 200
- Streak same day: call submitLog twice with same `today` value — `streak.current_length = 1` after both (not 2)
- Level-up: seed `attribute_state` with CON `in_progress_xp = 990` (level 1 threshold = 100 in game engine — check `xp.ts` for actual threshold), submit a CON log — `levelUps` in result includes CON entry
- `ai_source_last_used` written: after a successful submit, `settingsRepo.getSetting(db, 'ai_source_last_used')` returns `deps.aiService.sourceId` (verifies C-NEW-5 write inside the transaction)
- First-ever log (lastLogDay is null): `streak.current_length = 1` after submit — verifies that `submitLog` correctly passes `null` through to `updatePersistedStreak` and the engine initializes the streak to 1

- [ ] **Step 2:** Run `npm test -- submitLog`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/state/submitLog.ts`.**

Function signature:
```typescript
export interface SubmitLogDeps {
  aiService: AIService;
  db: DbDriver;
  today: ISODate;
  signal?: AbortSignal;
}

export async function submitLog(text: string, deps: SubmitLogDeps): Promise<SubmitLogResult>
```

Execution sequence:

1. Check `deps.signal?.aborted` -> return `{ ok: false, reason: "aborted" }`
2. Fetch active missions split by type — these two calls are parallel and must run before the AI call. Compute `mondayOfToday = mondayOf(deps.today)` first (exported from `@/game/missions`), then:
   ```typescript
   const [activeDailies, activeWeeklies] = await Promise.all([
     missionRepo.getActiveDailyMissions(deps.db, deps.today),
     missionRepo.getActiveWeeklyMissions(deps.db, mondayOf(deps.today)),
   ]);
   const activeMissions = [...activeDailies, ...activeWeeklies];
   ```
   `submitLog` must import `mondayOf` from `@/game/missions`.
3. In a single `Promise.all`, fetch in parallel: completed mission IDs for today via `missionRepo.getRecentlyCompleted(deps.db, deps.today)` (build a `Set<string>` of their ids), `streak` via `characterRepo.getStreak(deps.db)`, and `lastLogDay` via `logRepo.getLastLogDay(deps.db)`. These three are independent.
4. Build `ClassifyLogInput`: `{ text, activeMissions: activeMissions.map(missionRowToInstance), currentStreak: streak.currentLength }`. **Intentionally omit `timeOfDay`** — optional per AI_CONTRACT.md, MockAIService does not use it. Add in Phase 4 if proven useful.
5. Call `await deps.aiService.classifyLog(input, deps.signal)`. Catch `DOMException` with name "AbortError" -> return `{ ok: false, reason: "aborted" }`. Catch other errors -> return `{ ok: false, reason: "unknown" }`
6. `validateLogResult(aiResult)` -> if not ok, return `{ ok: false, reason: result.reason }`
7. Fetch `attributeStateRows = await characterRepo.getAttributeStates(deps.db)`. Convert to `Record<Attribute, AttributeStateLike>` keyed by attribute. For attributes not in the array, default to `{ level: 1, inProgressXp: 0 }`.
8. Fetch `alreadyEarnedToday = await logRepo.getDailyXpEarned(deps.db, deps.today)`
9. Compute `streakMultiplier = getStreakMultiplier(streak.currentLength)` (streak fetched in step 3)
10. Compute `requestedGains`: for each attribute in ATTRIBUTES, call `applyXPMultipliers(validated.attributeXP[attr] ?? 0, validated.improvementDetected, streakMultiplier)` — result is the requested XP for that attribute
11. `applyLogXP({ states: attributeStates, requestedGains, alreadyEarnedToday })` -> `{ newStates, actuallyApplied, levelUps }`
12. `validateMatchedMissions({ matchedIds: validated.matchedMissions, activeMissions: activeMissions.map(missionRowToInstance), completedIds: todayCompletedSet })` -> `{ completedIds, bonusByAttribute }`. **Note:** `missionRowToInstance` maps `Mission` (repo type) to `MissionInstance` (engine type) — see mapper note below.
13. `applyMissionBonus(newStates, bonusByAttribute)` -> `{ newStates: finalStates, levelUps: bonusLevelUps }`
14. `updatePersistedStreak({ currentStreak: streak.currentLength, currentLongestStreak: streak.longestLength, lastLogDay, today: deps.today, pauseWindows: [] })` -> `{ newStreak, newLongestStreak, newLastLogDay }` (both `streak` and `lastLogDay` from step 3)

    **Null-safety:** `updatePersistedStreak` accepts `lastLogDay: ISODate | null` (first-ever log case). The engine handles null internally — it initializes the streak to 1 for a first-ever log. No coercion is needed in `submitLog`. See `src/game/streak.ts` line 55: `if (lastLogDay === null) return finalize(1, today)`.
15. Write all results to DB inside `withTransactionAsync`. If transaction throws, return `{ ok: false, reason: "storage-error" }`:
    - `logRepo.insertLog(deps.db, { text, createdAt: new Date().toISOString(), day: deps.today, aiSummary: validated.summary, primaryAttribute: validated.primaryAttribute, totalXp: validated.totalXP, confidence: validated.confidence, improvement: validated.improvementDetected, aiSource: deps.aiService.sourceId, attributeXp: validated.attributeXP })`
    - `logRepo.incrementDailyXpEarned(deps.db, deps.today, actuallyApplied)`
    - `characterRepo.updateAttributeStates(deps.db, ATTRIBUTES.map(attr => ({ attribute: attr, level: finalStates[attr].level, inProgressXp: finalStates[attr].inProgressXp })))`
    - `characterRepo.updateStreak(deps.db, { currentLength: newStreak, longestLength: newLongestStreak })`
    - For each id in `completedIds`: `missionRepo.markCompleted(deps.db, id, new Date().toISOString())`
    - `settingsRepo.setSetting(deps.db, 'ai_source_last_used', deps.aiService.sourceId)` — records which AI source was used. After the transaction commits, the Settings screen will reflect the correct source without an extra round-trip.
16. Return `{ ok: true, levelUps: [...levelUps, ...bonusLevelUps], missionCompletions: completedIds }`

**`missionRowToInstance` mapper** (B2 fix — exported from `src/state/submitLog.ts` for tests):

```typescript
export function missionRowToInstance(m: Mission): MissionInstance {
  return {
    id: m.id,
    templateId: m.templateId,
    description: m.description,
    attribute: m.attribute,
    type: m.type,
    bonusXP: m.bonusXp,
    generatedFor: m.generatedFor,
  };
}
```

Add one unit test to `submitLog.test.ts` for the mapper: `missionRowToInstance` with a full `Mission` row returns a `MissionInstance` where `bonusXP` (engine camelCase) equals `bonusXp` (repo camelCase) and all other fields pass through unchanged.

**Storage-error test note (B1):** The storage-error test case injects a mock `withTransactionAsync` (via a custom `DbDriver` wrapper around the testHelpers driver) that throws on commit. This verifies that `submitLog` returns `{ ok: false, reason: "storage-error" }` and does NOT call any follow-up writes (`markCompleted`, `updateAttributeStates`). **This test does NOT verify atomicity at the DB level** — only that the error-return path is surfaced correctly. True DB atomicity is verified on-device with real `expo-sqlite`.

- [ ] **Step 4:** Run `npm test -- submitLog`. All tests pass.

- [ ] **Step 5: Commit.**
```
git add src/state/submitLog.ts src/state/__tests__/submitLog.test.ts
git commit -m "feat(state): implement submitLog composition function with full integration tests"
```

---

### Task 1.5 — Fill in Zustand stores

**Files:**
- Modify: `src/state/characterStore.ts`
- Modify: `src/state/logsStore.ts`
- Modify: `src/state/missionsStore.ts`
- Modify: `src/state/settingsStore.ts`

These stores are production wiring — they call `getDb()`, call repos, and call `submitLog`. No unit tests (integration covered by Task 1.4 tests and device verification in Task 1.11).

- [ ] **Step 1: Implement characterStore.ts.**

`hydrate()`:
1. `set({ loading: true })`
2. `const db = await getDb()`
3. `const [character, attributeStates, streak] = await Promise.all([characterRepo.getCharacter(db), characterRepo.getAttributeStates(db), characterRepo.getStreak(db)])`
4. `set({ character, attributeStates, streak, loading: false })`
5. Catch errors: `set({ error: e instanceof Error ? e.message : String(e), loading: false })`

`createCharacter(name, avatarId)`:
1. `const db = await getDb()`
2. `await characterRepo.createCharacter(db, name, avatarId)`
3. Call `get().hydrate()` to refresh state

- [ ] **Step 2: Implement logsStore.ts.**

Add these fields to `LogsStoreState`:
```typescript
lowConfidence: boolean;  // true when last submit rejected as low-confidence
error: "storage-error" | "unknown" | null;  // narrowed from string | null
```

Add internal `_abortController: AbortController | null` to the store state (not part of `LogsStoreState` interface — add in the `create()` initial value only).

`hydrate()`:
1. `const db = await getDb()`
2. `const logs = await logRepo.getRecentLogs(db, 50, 0)`
3. `set({ logs })`

`submitLog(text)`:
1. Create `const controller = new AbortController()`. Store: `set({ _abortController: controller, submitting: true, error: null, lowConfidence: false })`
2. `const db = await getDb()`
3. `const today = todayLocalISODate()`
4. `const aiService = new MockAIService()`
5. `const result = await submitLogFn(text, { aiService, db, today, signal: controller.signal })`
6. If `result.ok`:
   - `await useCharacterStore.getState().hydrate()`
   - `await useMissionsStore.getState().generateForToday()`
   - `await get().hydrate()` (refresh logs list)
   - `set({ submitting: false, lastResultSummary: null, _abortController: null })`
7. If `!result.ok`:
   - `"low-confidence"`: `set({ submitting: false, lowConfidence: true, _abortController: null })`
   - `"aborted"`: `set({ submitting: false, _abortController: null })` (silent)
   - `"storage-error"`: `set({ submitting: false, error: "storage-error", _abortController: null })`
   - `"unknown"` or `"invalid-primary"`: `set({ submitting: false, error: "unknown", _abortController: null })`

`cancelSubmit()`: `get()._abortController?.abort()`

- [ ] **Step 3: Implement missionsStore.ts.**

`hydrate()`:
1. `const db = await getDb()`
2. `const today = todayLocalISODate()`
3. `const mondayOfToday = mondayOf(today)`
4. `const [activeDailies, activeWeeklies, recentlyCompleted] = await Promise.all([missionRepo.getActiveDailyMissions(db, today), missionRepo.getActiveWeeklyMissions(db, mondayOfToday), missionRepo.getRecentlyCompleted(db, daysAgoLocalISODate(30))])`
5. `set({ active: [...activeDailies, ...activeWeeklies], recentlyCompleted, loading: false })`

Import `daysAgoLocalISODate` and `todayLocalISODate` from `@/lib/clock` (added in Task 1.2). Import `mondayOf` from `@/game/calendar`. No inline helper needed.

`generateForToday()`:
1. `const db = await getDb()`
2. `const today = todayLocalISODate()`
3. `const mondayOfToday = mondayOf(today)`
4. `const attributeStates = useCharacterStore.getState().attributeStates`
5. Build `attributeLevels: Record<Attribute, number>` from attributeStates array. If an attribute is missing (fresh install with no rows yet), default to level 1.
6. `const lastLogDay = await logRepo.getLastLogDay(db)`
7. `const hasEverLogged = lastLogDay !== null`
8. `const dailyInstances = generateDailyMissions({ attributeLevels, today, hasEverLogged })`
9. `const weeklyInstances = generateWeeklyQuest({ attributeLevels, today })`
10. Convert instances to `Mission` repo shape via `instanceToMission(instance, today)` helper:
    - `id: instance.id`
    - `templateId: instance.templateId`
    - `description: instance.description`
    - `attribute: instance.attribute`
    - `type: instance.type`
    - `bonusXp: instance.bonusXP`
    - `generatedFor: instance.type === "daily" ? today : mondayOfToday`
    - `progress: 0`, `target: 1`, `status: "active"`
    - `generatedAt: new Date().toISOString()`
    - `expiresAt`: populated by `missionRepo.insertMissions` internally (benign non-null value, never read by queries)
    - `completedAt: null`
11. `await missionRepo.insertMissions(db, [...dailyMissions, ...weeklyMissions])` — INSERT OR IGNORE; existence is naturally deduplicated by id (which encodes the date)
12. Call `get().hydrate()` to refresh active missions in state

**No `expireBefore` call here.** Mission activity is determined by `generated_for === today` (or `mondayOfToday` for weeklies) in the query, not by expiring old rows.

- [ ] **Step 4: Implement settingsStore.ts.**

Add missing fields to `SettingsStoreState`:
```typescript
lastDecayRunDay: string | null;
decayPausedDaysThisYear: number;
decayPauseStartedAt: string | null;
```

`hydrate()`:
1. `set({ loading: true })`
2. `const db = await getDb()`
3. `const all = await settingsRepo.getAllSettings(db)`
4. Parse all known keys from `all` with safe defaults:
   - `onboardingComplete: all["onboarding_complete"] === "true"`
   - `notificationsEnabled: all["notifications_enabled"] === "true"`
   - `notificationMorningTime: all["notification_morning_time"] ?? "08:00"`
   - `decayPaused: all["decay_paused"] === "true"`
   - `firstDecayShown: all["first_decay_shown"] === "true"`
   - `aiSourceLastUsed: (all["ai_source_last_used"] as "apple" | "gemini" | "mock") ?? "none"`
   - `lastDecayRunDay: all["last_decay_run_day"] ?? null`
   - `decayPausedDaysThisYear: parseInt(all["decay_paused_days_this_year"] ?? "0", 10)`
   - `decayPauseStartedAt: all["decay_pause_started_at"] ?? null`
5. `set({ ...parsedValues, loading: false })`

Add setters:
- `setOnboardingComplete(value)`: write `"onboarding_complete"`, setState
- `setDecayPaused(value)`: write `"decay_paused"`, setState
- `setFirstDecayShown(value)`: write `"first_decay_shown"`, setState
- `setLastDecayRunDay(day)`: write `"last_decay_run_day"`, setState
- `setNotificationsEnabled(value)`: write `"notifications_enabled"`, setState
- `setNotificationMorningTime(value)`: write `"notification_morning_time"`, setState

- [ ] **Step 5:** Run `npx tsc --noEmit`. Zero errors expected.

- [ ] **Step 6: Commit.**
```
git add src/state/characterStore.ts src/state/logsStore.ts src/state/missionsStore.ts src/state/settingsStore.ts
git commit -m "feat(state): wire Zustand stores to repositories and submitLog"
```

---

### Task 1.6 — Implement useAppForegroundDecay hook

**Files:**
- Create: `src/state/hooks/useAppForegroundDecay.ts`

No unit test for this hook — it depends on `AppState` (native). Tested manually in Task 1.11.

- [ ] **Step 1: Implement `src/state/hooks/useAppForegroundDecay.ts`.**

Behavior:
- Subscribe to `AppState` changes
- On each `"active"` transition and on mount (cold start), run decay if the calendar date has changed since `lastDecayRunDay`
- Decay is idempotent within the same calendar day (guarded by `lastDecayRunDay` in settingsStore)
- After applying decay: update attribute states in DB, call `characterStore.hydrate()`
- If this is the first-ever decay: set `first_decay_shown = "true"` in settings (Phase 4 uses this to trigger the explainer modal; Phase 3 only sets the flag)

Implementation:

```typescript
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getDb } from "@/storage/db";
import { todayLocalISODate } from "@/lib/clock";
import { useSettingsStore } from "@/state/settingsStore";
import { useCharacterStore } from "@/state/characterStore";
import { effectiveInactiveDays, applyDecay } from "@/game/decay";
import * as characterRepo from "@/storage/repositories/characterRepo";
import * as settingsRepo from "@/storage/repositories/settingsRepo";
import * as logRepo from "@/storage/repositories/logRepo";
import type { ISODate } from "@/game/calendar";

export function useAppForegroundDecay(): void
```

Logic inside `runDecay` (async, called on mount and on each `"active"` AppState event):
1. `const today = todayLocalISODate()`
2. `if (lastDecayRunDayRef.current === today) return` — already ran today, skip
3. `const db = await getDb()`
4. `const lastLogDay = await logRepo.getLastLogDay(db)`
5. If `lastLogDay === null`: write `last_decay_run_day = today` to settings, update store ref, return early (nothing to decay)
6. Compute `daysSince`: inline helper `Math.round((new Date(today).getTime() - new Date(lastLogDay).getTime()) / 86400000)`. Do NOT import this from `@/game/calendar` (calendar.ts is frozen and may not export this). Do NOT export the helper from useAppForegroundDecay either.
7. `const eff = effectiveInactiveDays(daysSince, 0)` — `pauseWindows` is Phase 4; pass 0 paused days
8. If `eff > 0`:
   a. `const states = await characterRepo.getAttributeStates(db)`
   b. `const decayed = states.map(s => ({ ...s, inProgressXp: applyDecay({ level: s.level, inProgressXp: s.inProgressXp }, eff).inProgressXp }))`
   c. `await characterRepo.updateAttributeStates(db, decayed)`
   d. `await useCharacterStore.getState().hydrate()`
   e. If `!useSettingsStore.getState().firstDecayShown`: `await settingsRepo.setSetting(db, "first_decay_shown", "true")` and `useSettingsStore.getState().setFirstDecayShown(true)`
9. `await settingsRepo.setSetting(db, "last_decay_run_day", today)`
10. `useSettingsStore.getState().setLastDecayRunDay(today)`

Use `useRef` to hold the latest `lastDecayRunDay` value from the store (avoids stale closure in the AppState listener). The `useEffect` dependency array is empty `[]`.

Ref initialization and update pattern:

```typescript
const lastDecayRunDayRef = useRef<ISODate | null>(
  useSettingsStore.getState().lastDecayRunDay,
);

const runDecay = useCallback(async () => {
  const today = todayLocalISODate();
  if (lastDecayRunDayRef.current === today) return; // idempotent — already ran today
  // ...decay logic (steps 3–9 above)...
  lastDecayRunDayRef.current = today; // update AFTER successful run
  await useSettingsStore.getState().setLastDecayRunDay(today);
}, []); // empty deps — ref is intentionally NOT a reactive selector to avoid resubscribing
```

The ref is initialized from `getState()` (not a hook selector) so it does not create a reactive subscription — the decay guard only needs the value at the moment `runDecay` fires, not reactively.

- [ ] **Step 2:** Run `npx tsc --noEmit`. Zero type errors.

- [ ] **Step 3: Commit.**
```
git add src/state/hooks/useAppForegroundDecay.ts
git commit -m "feat(state): add useAppForegroundDecay hook for on-open XP decay"
```

---

### Task 1.7 — Wire app/_layout.tsx, app/index.tsx, app/(main)/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`
- Modify: `app/(main)/_layout.tsx`

- [ ] **Step 1: Modify app/_layout.tsx.**

Current flow: DB migration succeeds -> `setDbReady(true)` -> render `<Slot />`.

New flow: DB migration succeeds -> hydrate all stores -> `setDbReady(true)` -> render with gate.

Changes:
1. Import: `useSettingsStore`, `useCharacterStore`, `useMissionsStore`, `useAppForegroundDecay`
2. In the `useEffect`, after `await applyMigrations(driver, [...MIGRATIONS])`, add:
   ```typescript
   await useSettingsStore.getState().hydrate();
   await useCharacterStore.getState().hydrate();
   await useMissionsStore.getState().hydrate();
   ```
3. Move `if (!cancelled) setDbReady(true)` to after the three hydrate calls.
4. Inside `RootLayout` component body, add `useAppForegroundDecay()` call (unconditional — hook handles its own guards).
5. Add `settingsHydrated` selector: `const settingsLoading = useSettingsStore(s => s.loading)`
6. Update the loading gate: `if (!fontsLoaded || !dbReady || settingsLoading) { return <LoadingScreen /> }`

- [ ] **Step 2: Modify app/index.tsx.**

Add a loading guard before the redirect to prevent flash-of-wrong-route:
```typescript
const loading = useSettingsStore(s => s.loading);
const onboardingComplete = useSettingsStore(s => s.onboardingComplete);
if (loading) return null;
```

The `if (loading) return null` is safe because `_layout.tsx` already waits for `settingsHydrated` before rendering `<Slot />`, so in practice `loading` is always false by the time index.tsx renders. The guard is defensive: it prevents any edge-case flash.

- [ ] **Step 3: Modify app/(main)/_layout.tsx.**

The `log` screen is opened as a modal via `router.push("/(main)/log")`. It must not appear in the tab bar (already set with `href: null`). In Expo Router v3, presenting a route that exists in a Tabs group as a modal requires placing it in a wrapping Stack, which is complex. For Phase 3: keep the current flat structure. The "modal" appearance is handled by adding a full-screen white/dark background in `LogEntryScreen` — the visual separation is sufficient for Phase 3. Phase 4 addresses the proper modal presentation if needed.

No code change to `_layout.tsx` is needed for Phase 3 unless `router.push("/(main)/log")` does not navigate correctly — in that case, add a `<Stack>` wrapper inside `MainLayout` with the log route as a child stack screen with `presentation: "modal"`. This is the fallback only if navigation is broken.

- [ ] **Step 4:** Run `npx tsc --noEmit`. Zero errors.

- [ ] **Step 5:** Run `npx expo start`. Verify app launches without crash and reaches Character Sheet (after completing onboarding or with an existing profile).

- [ ] **Step 6: Commit.**
```
git add app/_layout.tsx app/index.tsx app/(main)/_layout.tsx
git commit -m "feat(app): wire boot sequence — hydrate stores, decay hook, settingsHydrated gate"
```

---

### Task 1.8 — Implement AttributeBar and StreakIndicator components

**Files:**
- Create: `src/ui/components/AttributeBar.tsx`
- Create: `src/ui/components/StreakIndicator.tsx`

Presentational only. No business logic. Styled with NativeWind. No unit tests — covered by CharacterSheetScreen RNTL smoke test in Task 1.9.

- [ ] **Step 1: Implement AttributeBar.tsx.**

Props interface:
```typescript
interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
  xpThreshold: number;  // XP needed to reach next level
  decayedToday?: boolean;
}
```

Renders:
- Row: attribute abbreviation (e.g., "CON") + level number (e.g., "Lv 2")
- Progress bar: `width = min(inProgressXp / xpThreshold, 1) * 100%`. Bar fill color from `ATTRIBUTE_COLORS[attribute]`.
- If `decayedToday`: reduce bar fill opacity slightly (Phase 4 adds shimmer animation; Phase 3 renders at 60% opacity as a placeholder)

For `xpThreshold`: check whether `@/game/xp` exports a `xpForNextLevel(level: number): number` function. If it does, the caller (CharacterSheetScreen) computes the threshold and passes it as a prop. If not, use `level * 100` as a placeholder — Phase 5 will align with the real formula. Do not embed the formula inside the component.

- [ ] **Step 2: Implement StreakIndicator.tsx.**

Props interface:
```typescript
interface StreakIndicatorProps {
  streakDays: number;
}
```

Renders: if `streakDays === 0`, return null. Otherwise: small row with flame text emoji ("🔥") and "`${streakDays} day${streakDays !== 1 ? "s" : ""}"`.

- [ ] **Step 3:** Run `npx tsc --noEmit`. Zero type errors.

- [ ] **Step 4: Commit.**
```
git add src/ui/components/AttributeBar.tsx src/ui/components/StreakIndicator.tsx
git commit -m "feat(ui): add AttributeBar and StreakIndicator presentational components"
```

---

### Task 1.9 — Implement CharacterSheetScreen + RNTL smoke test

**Files:**
- Create: `src/ui/screens/CharacterSheetScreen.tsx`
- Create: `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`
- Modify: `app/(main)/character.tsx`
- Create: `jest.ui.config.js` (RNTL config, separate from main Jest config)
- Modify: `package.json` (add `"test:ui"` script)

**RNTL setup:** Main `jest.config.js` uses `testEnvironment: "node"` and covers `src/game/`, `src/ai/`, `src/lib/`, `src/storage/`, and `src/state/`. RNTL tests require a different preset. Create `jest.ui.config.js` at repo root:
```javascript
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
```

Add to `package.json` scripts: `"test:ui": "jest --config jest.ui.config.js"`

- [ ] **Step 1:** Install RNTL if not already present: `npx expo install @testing-library/react-native @testing-library/jest-native`

- [ ] **Step 2: Write failing RNTL smoke tests.**

File: `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx`

Mock stores:
```typescript
jest.mock("@/state/characterStore", () => ({
  useCharacterStore: jest.fn((selector) => selector({
    character: { id: 1, name: "Zara", avatarId: "avatar_1", createdAt: "2026-01-01T00:00:00Z" },
    attributeStates: [
      { attribute: "STR", level: 1, inProgressXp: 50 },
      { attribute: "DEX", level: 1, inProgressXp: 0 },
      { attribute: "CON", level: 2, inProgressXp: 150 },
      { attribute: "INT", level: 1, inProgressXp: 30 },
      { attribute: "WIS", level: 1, inProgressXp: 10 },
      { attribute: "CHA", level: 1, inProgressXp: 0 },
    ],
    streak: { currentLength: 3, longestLength: 5 },
    loading: false,
  })),
}));
```

Tests:
- renders character name "Zara"
- renders streak "3 days"
- renders 6 attribute bars (use `testID="attribute-bar-STR"` etc., or query by accessible text)
- renders the "+" FAB button
- pressing the FAB calls `router.push("/(main)/log")` (mock `expo-router` in the test setup)

- [ ] **Step 3: Implement CharacterSheetScreen.tsx.**

Data sources:
- `useCharacterStore(s => s.character)` — character name, avatarId
- `useCharacterStore(s => s.attributeStates)` — six bars
- `useCharacterStore(s => s.streak)` — streak
- `useMissionsStore(s => s.active)` — top 3 missions preview (added in Task 5.4)

Layout (per UI_SPEC.md §CharacterSheetScreen):
- Avatar placeholder (colored circle with first letter of name) + character name + `characterLevel(levels)` from `@/game/xp`
- `<StreakIndicator streakDays={streak.currentLength} />`
- ScrollView with 6 `<AttributeBar>` components (one per attribute in ATTRIBUTES order)
- FAB: `<TouchableOpacity testID="fab-log" onPress={() => router.push("/(main)/log")}>` with "+" label

Wire `app/(main)/character.tsx` to render `<CharacterSheetScreen />`.

- [ ] **Step 4:** Run `npm run test:ui -- CharacterSheetScreen`. All smoke tests pass.

- [ ] **Step 5: Commit.**
```
git add src/ui/screens/CharacterSheetScreen.tsx src/ui/screens/__tests__/CharacterSheetScreen.test.tsx app/(main)/character.tsx jest.ui.config.js package.json
git commit -m "feat(ui): implement CharacterSheetScreen with RNTL smoke tests"
```

---

### Task 1.10 — Implement LogEntryScreen + RNTL smoke tests

**Files:**
- Create: `src/ui/screens/LogEntryScreen.tsx`
- Create: `src/ui/screens/__tests__/LogEntryScreen.test.tsx`
- Modify: `app/(main)/log.tsx`

- [ ] **Step 1: Write failing RNTL smoke tests.**

File: `src/ui/screens/__tests__/LogEntryScreen.test.tsx`

Mock `useLogsStore` with controllable state:
```typescript
const mockSubmitLog = jest.fn();
const mockCancelSubmit = jest.fn();
jest.mock("@/state/logsStore", () => ({
  useLogsStore: jest.fn((selector) => selector({
    submitting: false,
    lowConfidence: false,
    error: null,
    submitLog: mockSubmitLog,
    cancelSubmit: mockCancelSubmit,
  })),
}));
```

Tests:
- renders text input with placeholder "What did you do?"
- submit button is disabled when input is empty
- submit button is enabled after typing text
- pressing submit with non-empty text calls `submitLog` once
- pressing submit with empty text does NOT call `submitLog` (button is disabled, so press has no effect)
- when `submitting = true`: submit button shows loading indicator or is disabled, input `editable={false}`
- when `lowConfidence = true`: inline message containing "couldn't categorize" is visible; input retains its text value
- when `error = "storage-error"`: message containing "Couldn't save" is visible
- when `error = "unknown"`: message containing "went wrong" is visible

- [ ] **Step 2: Implement LogEntryScreen.tsx.**

Local state: `const [text, setText] = useState("")`

Read from store: `submitting`, `lowConfidence`, `error` (via `useLogsStore` selector)
Get store actions: `useLogsStore(s => s.submitLog)`, `useLogsStore(s => s.cancelSubmit)`

Layout:
- `<TextInput multiline autoFocus placeholder="What did you do?" value={text} onChangeText={setText} editable={!submitting} />`
- Submit button: `disabled={text.trim() === "" || submitting}`. On press: `submitLog(text)`. Clear `text` on success (watch `submitting` transition from true to false and `lowConfidence` is false — use `useEffect` to detect this transition and call `setText("")`).
- If `lowConfidence`: `<Text>We couldn't categorize that confidently — try a more specific log.</Text>`. Input text preserved (do NOT call `setText("")`).
- If `error === "storage-error"`: `<Text>Couldn't save your log. Try again.</Text>`
- If `error === "unknown"`: `<Text>Something went wrong, try again.</Text>`
- Cancel button or back gesture: call `router.back()` and `cancelSubmit()`

Wire `app/(main)/log.tsx` to render `<LogEntryScreen />`.

- [ ] **Step 3:** Run `npm run test:ui -- LogEntryScreen`. All tests pass.

- [ ] **Step 4: Commit.**
```
git add src/ui/screens/LogEntryScreen.tsx src/ui/screens/__tests__/LogEntryScreen.test.tsx app/(main)/log.tsx
git commit -m "feat(ui): implement LogEntryScreen with low-confidence inline message"
```

---

### Task 1.11 — Manual Slice 1 verification on iPhone

**Files:** None. Observation only.

- [ ] Run `npx expo start`. Connect iPhone. Open in Expo Go.
- [ ] Character Sheet loads without crash. Six attribute bars visible (all level 1, XP 0 on fresh install).
- [ ] StreakIndicator is not visible (streak = 0).
- [ ] Tap "+" FAB. Log Entry screen opens.
- [ ] Type "ran 5km this morning". Tap Submit.
- [ ] Loading state visible briefly.
- [ ] Return to Character Sheet. CON bar has XP > 0.
- [ ] Streak shows "1 day".
- [ ] Re-open Log Entry. Type "did the thing". Submit. Low-confidence inline message appears. Input text preserved ("did the thing" still visible).
- [ ] Background app, then foreground. No crash. Decay hook fires silently.
- [ ] **Acceptance:** All checks pass without crash.

---

## Slice 2 — Missions screen

**Goal:** MissionsScreen shows active daily missions and weekly quest. Completing a log matching a mission marks it completed.

---

### Task 2.1 — Verify mission generation after first log

**Files:** None. Observation only.

- [ ] After the Slice 1 verification log ("ran 5km"), navigate to the Missions tab.
- [ ] Verify 3 daily missions are visible (mission generation ran in logsStore after submit).
- [ ] Verify 1 weekly quest is visible.
- [ ] If missions are missing: debug `missionsStore.generateForToday()` — add temporary `console.log` to confirm it fires after `submitLog` succeeds.
- [ ] **Acceptance:** 3 daily missions + 1 weekly quest visible after first log.

---

### Task 2.2 — Implement MissionCard component

**Files:**
- Create: `src/ui/components/MissionCard.tsx`

Props interface:
```typescript
interface MissionCardProps {
  mission: Mission;
  onTap?: () => void;
}
```

Renders (per UI_SPEC.md §Components):
- Description text
- Attribute label (mission.attribute)
- Binary completion dot: filled circle if `mission.status === "completed"`, hollow if "active"
- Expiry line: derive from `mission.generatedFor` and `mission.type`, NOT from `mission.expiresAt` (deprecated). For dailies: mission expires at end of `generatedFor` day — format as "expires today" or "expired" if past. For weeklies: expires end of the week started on `generatedFor` (Monday) — format as "expires Sunday". Use simple string formatting — no date-fns (not in the locked tech stack).
- If `mission.status === "completed"`: show `mission.completedAt` formatted date and `mission.bonusXp + " XP bonus"`

No RNTL test in isolation — covered by MissionsScreen smoke test in Task 2.3.

- [ ] **Step 1:** Implement MissionCard.tsx. Run `npx tsc --noEmit`. Zero errors.
- [ ] **Step 2: Commit.**
```
git add src/ui/components/MissionCard.tsx
git commit -m "feat(ui): add MissionCard component"
```

---

### Task 2.3 — Implement MissionsScreen + RNTL smoke test

**Files:**
- Create: `src/ui/screens/MissionsScreen.tsx`
- Create: `src/ui/screens/__tests__/MissionsScreen.test.tsx`
- Modify: `app/(main)/missions.tsx`

- [ ] **Step 1: Write failing RNTL smoke tests.**

Mock `useMissionsStore` with 3 active daily missions, 1 weekly active mission, and 2 recently completed.

Tests:
- renders section header "Active" (or "Daily Missions")
- renders all 4 active missions (3 daily + 1 weekly)
- renders section header "Completed"
- renders 2 completed mission entries
- each active mission shows its description text

- [ ] **Step 2: Implement MissionsScreen.tsx.**

Read from `useMissionsStore`: `active`, `recentlyCompleted`, `loading`.

Separate `active` by `mission.type`: `const dailies = active.filter(m => m.type === "daily")`, `const weekly = active.filter(m => m.type === "weekly")`.

Layout: `ScrollView` with two sections:
1. Active section: daily missions first, then weekly. Each rendered as `<MissionCard mission={m} />`.
2. Completed section: `recentlyCompleted.map(m => <MissionCard mission={m} />)`.

Wire `app/(main)/missions.tsx` to render `<MissionsScreen />`.

- [ ] **Step 3:** Run `npm run test:ui -- MissionsScreen`. All tests pass.
- [ ] **Step 4: Commit.**
```
git add src/ui/screens/MissionsScreen.tsx src/ui/screens/__tests__/MissionsScreen.test.tsx app/(main)/missions.tsx
git commit -m "feat(ui): implement MissionsScreen with MissionCard"
```

---

## Slice 3 — History screen

**Goal:** HistoryScreen shows all logged entries in reverse-chronological order with attribute filter pills.

---

### Task 3.1 — Implement LogRow component

**Files:**
- Create: `src/ui/components/LogRow.tsx`

Props interface:
```typescript
interface LogRowProps {
  entry: LogEntry;
  expanded?: boolean;
  onTap?: () => void;
}
```

Renders (per UI_SPEC.md §HistoryScreen):
- Date + time formatted from `entry.createdAt` (e.g., "May 8, 7:00 AM")
- `entry.aiSummary`
- `entry.totalXp + " XP"` and `entry.primaryAttribute` label
- If `expanded`: also render `entry.text` (full log) and per-attribute XP breakdown from `entry.attributeXp`

- [ ] **Step 1:** Implement LogRow.tsx. Run `npx tsc --noEmit`. Zero errors.
- [ ] **Step 2: Commit.**
```
git add src/ui/components/LogRow.tsx
git commit -m "feat(ui): add LogRow component for history screen"
```

---

### Task 3.2 — Implement HistoryScreen + RNTL smoke test

**Files:**
- Create: `src/ui/screens/HistoryScreen.tsx`
- Create: `src/ui/screens/__tests__/HistoryScreen.test.tsx`
- Modify: `app/(main)/history.tsx`

- [ ] **Step 1: Write failing RNTL smoke tests.**

Mock `useLogsStore` with 3 log entries with attributes STR, CON, CON.

Tests:
- renders all 3 log rows
- renders filter pills: "All", "STR", "DEX", "CON", "INT", "WIS", "CHA"
- pressing "CON" pill shows only 2 CON logs (STR log hidden)
- pressing "All" pill shows all 3 logs again
- pressing a log row once shows `expanded` content (full text visible)
- pressing same row again hides expanded content

- [ ] **Step 2: Implement HistoryScreen.tsx.**

Local state: `activeFilter: Attribute | "all" = "all"`, `expandedId: number | null = null`

Read from `useLogsStore`: `logs`

Filter: `const filtered = activeFilter === "all" ? logs : logs.filter(l => l.primaryAttribute === activeFilter)`

Layout:
- Filter pill row: horizontal `ScrollView`. Each pill calls `setActiveFilter(attr)`. Active pill has filled style.
- Log list: `FlatList` or `ScrollView` of `<LogRow entry={e} expanded={expandedId === e.id} onTap={() => setExpandedId(expandedId === e.id ? null : e.id)} />`

Wire `app/(main)/history.tsx` to render `<HistoryScreen />`.

- [ ] **Step 3:** Run `npm run test:ui -- HistoryScreen`. All tests pass.
- [ ] **Step 4: Commit.**
```
git add src/ui/components/LogRow.tsx src/ui/screens/HistoryScreen.tsx src/ui/screens/__tests__/HistoryScreen.test.tsx app/(main)/history.tsx
git commit -m "feat(ui): implement HistoryScreen with attribute filter and expand/collapse"
```

---

## Slice 4 — Settings screen

**Goal:** Settings screen reads and writes user preferences. Decay pause toggle and notifications toggle function.

---

### Task 4.1 — Verify notification setters in settingsStore

**Files:** No new files. Verification only.

`setNotificationsEnabled` and `setNotificationMorningTime` were defined in **Task 1.5 step 4** along with all other settingsStore setters. They follow the same pattern: `await settingsRepo.setSetting(db, key, value)` then `set({ field: value })`.

Task 4.2 (SettingsScreen) consumes these setters directly — no new implementation is needed here.

- [ ] **Step 1:** Confirm `useSettingsStore` exposes `setNotificationsEnabled(value: boolean)` and `setNotificationMorningTime(value: string)`. Run `npx tsc --noEmit`. Zero errors. If either setter is missing (Task 1.5 was skipped or incomplete), implement it now following the Task 1.5 step 4 pattern.
- [ ] **Step 2:** No commit needed if Task 1.5 is complete. If a setter was missing and added here, commit:
```
git add src/state/settingsStore.ts
git commit -m "fix(state): add missing notification setters to settingsStore"
```

---

### Task 4.2 — Implement SettingsScreen + RNTL smoke test

**Files:**
- Create: `src/ui/screens/SettingsScreen.tsx`
- Create: `src/ui/screens/__tests__/SettingsScreen.test.tsx`
- Modify: `app/(main)/settings.tsx`

- [ ] **Step 1: Write failing RNTL smoke tests.**

Mock `useSettingsStore` and `useCharacterStore`.

Tests:
- renders character name from `characterStore`
- renders "Mock (development)" as the AI source
- renders Notifications Switch; toggling it calls `setNotificationsEnabled`
- renders Decay Switch; toggling it calls `setDecayPaused`
- renders app version string (mock `expo-constants` to return version `"0.1.0"`)

- [ ] **Step 2: Implement SettingsScreen.tsx.**

Sections per UI_SPEC.md §SettingsScreen:

**Profile:** Character name (read-only for Phase 3). Display `character?.name ?? "Unknown"`.

**AI Source:** Map `aiSourceLastUsed` to display string:
- `"apple"` -> "Apple Intelligence"
- `"gemini"` -> "Gemini Nano"
- `"mock"` -> "Mock (development)"
- `"none"` -> "Not yet used"

**Notifications:** `<Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />`

**Decay:** `<Switch value={decayPaused} onValueChange={setDecayPaused} />`

**About:** `<Text>{Constants.expoConfig?.version}</Text>`

**Developer (visible only when `__DEV__` is true):** "Reset character" button — no-op in Phase 3 (logs "TODO: reset character" to console).

Wire `app/(main)/settings.tsx` to render `<SettingsScreen />`.

- [ ] **Step 3:** Run `npm run test:ui -- SettingsScreen`. All tests pass.
- [ ] **Step 4: Commit.**
```
git add src/ui/screens/SettingsScreen.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx app/(main)/settings.tsx
git commit -m "feat(ui): implement SettingsScreen with profile, AI source, and toggles"
```

---

## Slice 5 — Onboarding

**Goal:** Fresh install shows the onboarding flow. Character creation names the character. First log submission completes onboarding and navigates to Character Sheet.

---

### Task 5.1 — Create onboarding route group

**Files:**
- Create: `app/onboarding/_layout.tsx`
- Create: `app/onboarding/index.tsx`
- Delete: `app/onboarding.tsx` (the Phase 1 placeholder)

- [ ] **Step 1:** Create `app/onboarding/_layout.tsx`. Stack navigator, `headerShown: false`.

- [ ] **Step 2:** Create `app/onboarding/index.tsx`. Immediate redirect to `/onboarding/pitch`:
```typescript
import { Redirect } from "expo-router";
export default function OnboardingIndex() {
  return <Redirect href="/onboarding/pitch" />;
}
```

- [ ] **Step 3:** Delete `app/onboarding.tsx`: `git rm app/onboarding.tsx`

Expo Router resolves `/onboarding` to `app/onboarding/index.tsx` when a route group exists. The delete is required — having both `onboarding.tsx` and `onboarding/` causes a routing conflict.

- [ ] **Step 4:** Run `npx expo start --clear`. Navigate to `/onboarding` (clear app data or set `onboarding_complete = false` in settings). Verify the redirect to `/onboarding/pitch` resolves without error.

- [ ] **Step 5: Commit.**
```
git add app/onboarding/_layout.tsx app/onboarding/index.tsx
git rm app/onboarding.tsx
git commit -m "feat(nav): replace onboarding placeholder with route group"
```

---

### Task 5.2 — Implement PitchSlides screen

**Files:**
- Create: `src/ui/screens/onboarding/PitchSlides.tsx`
- Create: `app/onboarding/pitch.tsx`

Three slides per UI_SPEC.md §OnboardingScreen:
1. "Turn your life into an RPG"
2. "AI parses what you did. You just type."
3. "Six attributes. One you. Level up."

Controls:
- "Next" button advances to the next slide
- "Skip" button on every slide navigates directly to `router.push("/onboarding/creation")`
- After slide 3: "Next" navigates to `router.push("/onboarding/ai-confirm")`
- Three indicator dots (filled = current)

Local state: `const [slide, setSlide] = useState<0 | 1 | 2>(0)`

No RNTL test for PitchSlides — tested manually in Task 5.4.

- [ ] **Step 1:** Implement PitchSlides.tsx.
- [ ] **Step 2:** Wire `app/onboarding/pitch.tsx` to render `<PitchSlides />`.
- [ ] **Step 3:** Run `npx tsc --noEmit`. Zero errors.
- [ ] **Step 4: Commit.**
```
git add src/ui/screens/onboarding/PitchSlides.tsx app/onboarding/pitch.tsx
git commit -m "feat(ui): add onboarding pitch slides"
```

---

### Task 5.3 — Implement AIConfirm, CharacterCreation, and FirstLog screens

**Files:**
- Create: `src/ui/screens/onboarding/AIConfirmScreen.tsx`
- Create: `src/ui/screens/onboarding/CharacterCreationScreen.tsx`
- Create: `src/ui/screens/onboarding/FirstLogScreen.tsx`
- Create: `app/onboarding/ai-confirm.tsx`
- Create: `app/onboarding/creation.tsx`
- Create: `app/onboarding/first-log.tsx`
- Create: `src/ui/screens/__tests__/OnboardingScreens.test.tsx`

- [ ] **Step 1: Implement AIConfirmScreen.tsx.**

Content (Phase 3 — real AI name swapped in Phase 5):
- Heading: "AI Engine"
- Body: "Mock (development)" with a note: "Your logs stay on your device. No data leaves your phone."
- "Continue" button: `router.push("/onboarding/creation")`

Wire `app/onboarding/ai-confirm.tsx` to render `<AIConfirmScreen />`.

- [ ] **Step 2: Implement CharacterCreationScreen.tsx.**

Local state: `const [name, setName] = useState("")`, `const [selectedAvatarId, setSelectedAvatarId] = useState("avatar_1")`

Layout:
- Name input: `<TextInput placeholder="Character name" value={name} onChangeText={setName} />`
- Avatar grid: 6 items with ids `"avatar_1"` through `"avatar_6"`. Phase 3: render colored circles with letters (e.g., "A" for avatar_1). Selected avatar has a highlighted border.
- "Create Character" button: `disabled={name.trim().length === 0}`
  On press:
  1. `await useCharacterStore.getState().createCharacter(name.trim(), selectedAvatarId)`
  2. `router.push("/onboarding/first-log")`

Wire `app/onboarding/creation.tsx` to render `<CharacterCreationScreen />`.

- [ ] **Step 3: Implement FirstLogScreen.tsx.**

Identical data flow to `LogEntryScreen`. Context copy differs: heading "First Log" and placeholder "Tell us one thing you did today to get started."

After successful submit:
1. `await useSettingsStore.getState().setOnboardingComplete(true)`
2. `router.replace("/(main)/character")`

On low-confidence: show same inline message as LogEntryScreen. Keep input. Do NOT complete onboarding.

Reuse `useLogsStore.submitLog` — no special code path for the first log.

Wire `app/onboarding/first-log.tsx` to render `<FirstLogScreen />`.

- [ ] **Step 4: Write RNTL smoke tests.**

File: `src/ui/screens/__tests__/OnboardingScreens.test.tsx`

Tests:
- AIConfirmScreen: renders privacy note text; "Continue" button navigates to `/onboarding/creation`
- CharacterCreationScreen: "Create Character" button disabled on empty name; enabled after typing name; pressing "Create Character" calls `createCharacter` and navigates to first-log
- FirstLogScreen: when `lowConfidence = true`, inline "couldn't categorize" message is visible and input retains its text value
- FirstLogScreen: after success, `setOnboardingComplete(true)` is called and `router.replace` navigates to `/(main)/character`

- [ ] **Step 5:** Run `npm run test:ui -- OnboardingScreens`. All tests pass.
- [ ] **Step 6: Commit.**
```
git add src/ui/screens/onboarding/AIConfirmScreen.tsx src/ui/screens/onboarding/CharacterCreationScreen.tsx src/ui/screens/onboarding/FirstLogScreen.tsx app/onboarding/ai-confirm.tsx app/onboarding/creation.tsx app/onboarding/first-log.tsx src/ui/screens/__tests__/OnboardingScreens.test.tsx
git commit -m "feat(ui): implement onboarding screens — AI confirm, character creation, first log"
```

---

### Task 5.4 — Wire mission preview to CharacterSheetScreen and run fresh-install verification

**Files:**
- Modify: `src/ui/screens/CharacterSheetScreen.tsx`

- [ ] **Step 1: Add mission preview to CharacterSheetScreen.**

Below the attribute bars, add:
```typescript
const activeMissions = useMissionsStore(s => s.active);
const previewMissions = activeMissions.slice(0, 3);
```

Render `previewMissions.map(m => <MissionCard key={m.id} mission={m} />)` in a section labeled "Today's Missions".

If `activeMissions.length === 0`: render `<Text>No missions yet — submit your first log to generate missions.</Text>`

- [ ] **Step 2: Manual fresh-install verification.**

Clear Expo Go app data (or use a simulator with a fresh app install) to simulate a fresh user.

Checklist:
- [ ] App opens to `/onboarding/pitch` (`onboarding_complete` = false)
- [ ] Can navigate through all 3 pitch slides via "Next"
- [ ] Can skip from slide 1 to character creation via "Skip"
- [ ] AIConfirm shows "Mock (development)" and privacy note
- [ ] Character creation: empty name disables "Create Character"; typing enables it; tapping creates character and navigates to first-log
- [ ] First log: type "meditated for 10 minutes"; submit; app navigates to Character Sheet
- [ ] Character Sheet: shows character name, WIS bar has XP, StreakIndicator shows "1 day"
- [ ] Mission preview shows up to 3 daily missions
- [ ] Navigate to Missions tab: same 3 missions + 1 weekly quest
- [ ] Navigate to History tab: shows the first log entry
- [ ] Navigate to Settings: shows character name, AI source = "Mock (development)"
- [ ] Background and foreground app: no crash, decay hook fires silently
- [ ] **Acceptance:** All checklist items pass.

- [ ] **Step 3: Commit.**
```
git add src/ui/screens/CharacterSheetScreen.tsx
git commit -m "feat(ui): add mission preview to CharacterSheetScreen; Phase 3 feature-complete"
```

---

## Execution order

- **Batch 1 — Device checks (must run first, blocking):**
  Task 0.1, Task 0.2. These are gates. Do not begin Slice 1 until both pass.

- **Batch 2 — Slice 1 foundation (serial):**
  Task 1.1 -> Task 1.2 -> Task 1.2.5 -> Task 1.3 -> Task 1.4 -> Task 1.5 -> Task 1.6 -> Task 1.7 -> Task 1.8 -> Task 1.9 -> Task 1.10 -> Task 1.11.
  Each task depends on the previous. Do not parallelize within Slice 1.

- **Batch 3 — Slice 2 and Slice 3 (can run in parallel after Task 1.11):**
  Assign Slice 2 (Tasks 2.1 -> 2.2 -> 2.3) and Slice 3 (Tasks 3.1 -> 3.2) to separate agents or sessions.
  Both depend only on Slice 1 being complete.

- **Batch 4 — Slice 4 (after Batch 3):**
  Task 4.1 -> Task 4.2. Settings reads from missions store (for potential mission count display) and logs store (for AI source). Both Slices 2 and 3 must be complete.

- **Batch 5 — Slice 5 (after Batch 4):**
  Task 5.1 -> 5.2 -> 5.3 -> 5.4. Onboarding is the last slice. It depends on all earlier screens being correct because `FirstLogScreen` invokes the full submit-log pipeline.

---

## Rollout

- **Migration order:** One new migration — migration 002 (`generated_for` column on `missions`) added in Task 1.2.5. It runs automatically on cold start via the migration runner. Users upgrading from Phase 1/2 (migration 001 only) will have migration 002 applied on first launch. The empty-string default on `generated_for` is safe for any pre-existing mission rows. New settings keys (`last_decay_run_day`, etc.) use the existing `settings` table from migration 001 — no migration required for them. The `SettingKey` union change is TypeScript-only.

- **Feature flag:** None. Phase 3 is the first usable version of the app. There is no partial rollout.

- **Expo Go vs. build:** All Phase 3 development runs in Expo Go via `npx expo start`. No EAS build is needed until Phase 5 (real AI integration, which requires a native module not available in Expo Go).

- **Rollback:** Each slice is independently functional. If Slice 3 (History) has a regression, removing the History tab route does not break Character Sheet or Log Entry. The submit-log pipeline (Slice 1) is the only non-rollback-able piece — it is the core product function.

- **Incompatible DB state from Phase 1/2:** If a tester has the Phase 1/2 app installed, the migration runner will apply migration 002 automatically on first cold start — no manual intervention needed. If clearing Expo Go app data is preferred for a clean slate, that works too (fresh DB gets both migrations in order).

---

## Done criteria

Phase 3 is complete when ALL of the following are true.

**Automated gates (CI must pass before Phase 4 begins):**
- [ ] `npm test` passes: all game engine tests (100%), MockAIService (100%), clock.ts (100%), migration runner tests (001 and 002), all four repository integration test suites, submitLog integration tests
- [ ] `npm run test:ui` passes: all RNTL smoke tests (CharacterSheetScreen, LogEntryScreen, MissionsScreen, HistoryScreen, SettingsScreen, OnboardingScreens)
- [ ] `npx tsc --noEmit` zero errors
- [ ] Coverage thresholds: `src/game/*` 100%, `src/ai/MockAIService.ts` 100%, `src/lib/clock.ts` 100% (includes `daysAgoLocalISODate`), `src/storage/repositories/*` >= 85%

**User-visible behavior on device (verified via Task 5.4 checklist and Task 1.11):**
- [ ] Fresh install: complete onboarding flow from pitch slides to character sheet
- [ ] Submit "ran 5km this morning": CON bar gains XP, streak shows "1 day"
- [ ] Submit "did the thing": low-confidence inline message visible, input preserved, zero XP applied
- [ ] Cancel during submission: no XP applied, no error state, modal closes cleanly
- [ ] Missions tab: 3 daily missions + 1 weekly quest visible after first log
- [ ] History tab: log entry visible with correct AI summary, XP, and attribute
- [ ] Settings tab: character name, "Mock (development)" AI source, toggles functional
- [ ] Background + foreground: decay hook fires silently, no crash
- [ ] Second log on same day: streak stays at 1 (not 2)
- [ ] No `.toISOString().slice(0, 10)` or `.toISOString().substring(0, 10)` calls outside `src/lib/clock.ts` (grep check by reviewer — raw `.toISOString()` for full datetime timestamps is allowed)

**Mission activity:** Mission active/inactive state is computed from `generated_for` matching the current day, not from stored `expires_at`. No `expireBefore` logic runs in Phase 3.

**Review sign-offs (human check before Phase 4):**
- [ ] No game logic (XP formulas, level calculations, mission rules) in any file under `src/ui/` or `app/`
- [ ] No React imports in `src/state/submitLog.ts`
- [ ] No direct repo imports in `src/ui/` files (all state reads go through Zustand stores)
- [ ] `MockAIService` is instantiated only in `logsStore.submitLog` — not exported from a barrel or used in any UI file
- [ ] All repo functions have `db: DbDriver` as first parameter; no function calls `getDb()` internally

---

## Out of scope

- Animations (XP bar fill, level-up modal celebration, number ticking): Phase 4
- Push notifications and time picker in Settings: Phase 4
- Voice input button in LogEntryScreen: Phase 4
- AI-unavailable inline banner: Phase 4
- First-decay explainer modal UI: Phase 4 (flag is set in Phase 3)
- Pull-to-refresh on Character Sheet or History: Phase 4
- Pause decay day counting (`decayPausedDaysThisYear` tracking and logic): Phase 4
- Character name and avatar editing from Settings: Phase 4
- Developer "Reset character" button (functional): Phase 4
- Real AI implementations (Apple Foundation Models, Gemini Nano): Phase 5 and 6
- `aiServiceFactory.ts`: Phase 5
- Android support: Phase 6
- Infinite scroll pagination in HistoryScreen beyond the first 50 logs: Phase 4 if needed
- `getLogsByAttribute` DB-level filtering: Phase 4 (HistoryScreen filters in-memory in Phase 3)
- Mission expiry column cleanup (dropping `expires_at` from schema and `Mission` interface): Phase 4+
- Mission generation algorithm improvements (weighted probabilities, cooldowns): Phase 4
