# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a blank Questum app on the user's iPhone via Expo Go with SQLite, navigation, and state-management plumbing in place. No game logic, no real UI, no AI implementations — just the skeleton so subsequent phases can fill it in.

**Architecture:** Expo (managed workflow) + TypeScript strict + Expo Router file-based routing. SQLite via `expo-sqlite` is opened on first launch and migrated forward via a numbered-migration runner. Zustand stores and storage repositories ship as typed skeletons that throw "not implemented" until Phase 2/3 wires their bodies. The `AIService` interface and Zod schemas land now so every later layer can depend on them. NativeWind reads color tokens from `src/game/constants.ts` so the design system is wired but unused.

**Tech Stack:** Expo SDK (latest), React Native 0.79+, TypeScript 5.6+ strict, Expo Router v5, Zustand v5, expo-sqlite (modern async API), NativeWind v4, expo-font, react-native-svg, Zod v4, Jest + ts-jest, ESLint v9 (flat config) + `@typescript-eslint`, Prettier, Husky v9, EAS Build. Test-only: `better-sqlite3` for the migration runner unit tests.

**Out of scope (do not implement):**

- Any UI beyond placeholder screens that render their route name
- Any function body in `src/game/*` other than `constants.ts`
- Any `AIService` implementation (interface + Zod schemas only)
- Any animation, font weight juggling, or final styling
- Any notification, voice input, or AI-unavailable banner work — those are Phase 4

**Branching:** All work lands on `develop` via PRs. Each task below is one PR-sized commit. Push at the end of each task; open a PR at the end of each section (A–K).

---

## File structure for Phase 1

The end-state of Phase 1 is this layout. Files marked `(skeleton)` have signatures and minimal init paths; their bodies throw `Error('not implemented in Phase 1')` for anything beyond what's needed to boot.

```
questum/
  app/
    _layout.tsx             # Root layout: load Manrope, init DB, render <Slot/>
    index.tsx               # Routes onboarding vs (main) based on settings
    onboarding.tsx          # Placeholder: renders "Onboarding"
    (main)/
      _layout.tsx           # Tabs: character, missions, history, settings
      character.tsx         # Placeholder
      log.tsx               # Placeholder modal route (presentation: modal)
      missions.tsx          # Placeholder
      history.tsx           # Placeholder
      settings.tsx          # Placeholder

  src/
    ai/
      AIService.ts          # interface + ClassifyLogInput + LogResult + ActiveMissionSummary
      schema.ts             # Zod schemas: AttributeSchema, LogResultSchema, ClassifyLogInputSchema, ActiveMissionSummarySchema
      schema.test.ts        # Round-trip tests for the schemas

    game/
      constants.ts          # Attribute type, ATTRIBUTES list, COLORS, ATTRIBUTE_COLORS, derived constants

    lib/
      logger.ts             # debug/info/warn/error wrappers; prod build silences debug+info

    state/
      characterStore.ts     # (skeleton)
      logsStore.ts          # (skeleton)
      missionsStore.ts      # (skeleton)
      settingsStore.ts      # (skeleton)

    storage/
      db.ts                 # DbDriver interface + production expo-sqlite adapter + getDb()
      migrations.ts         # applyMigrations(driver, migrations) runner
      migrations.test.ts    # Jest tests for the runner using better-sqlite3
      migrations/
        index.ts            # exports MIGRATIONS: Migration[]
        001_initial.ts      # exports MIGRATION_001 sql string
      testHelpers.ts        # createNodeSqliteDriver(db) for tests
      repositories/
        characterRepo.ts    # (skeleton: character + attribute_state + streak)
        logRepo.ts          # (skeleton: logs + log_attribute_xp + daily_xp_earned)
        missionRepo.ts      # (skeleton)
        settingsRepo.ts     # (skeleton)

  .eslintrc.cjs             # OR eslint.config.js (flat config) — see Task A3
  .prettierrc.json
  .gitattributes            # already present
  .gitignore                # already present, .superpowers/ already excluded
  .husky/
    pre-commit              # runs lint + typecheck
  app.config.ts             # iOS bundle, version, plugins
  babel.config.js           # NativeWind preset
  eas.json                  # iOS development/preview/production profiles
  jest.config.js            # ts-jest, node testEnvironment
  metro.config.js           # NativeWind metro config
  package.json              # scripts: lint, typecheck, format, test, start, prepare (husky)
  tailwind.config.js        # consumes COLORS + ATTRIBUTE_COLORS from src/game/constants.ts
  tsconfig.json             # strict + noUncheckedIndexedAccess + paths "@/*": ["src/*"]
  global.css                # @tailwind directives
  README.md                 # updated with setup instructions
```

**Repository allocation rationale.** `ARCHITECTURE.md` lists four repositories: `characterRepo`, `logRepo`, `missionRepo`, `settingsRepo`. Tables that aren't directly named (e.g. `attribute_state`, `streak`, `daily_xp_earned`) live with their owner aggregate:

- `characterRepo` owns `character` + `attribute_state` + `streak` — all single-character state
- `logRepo` owns `logs` + `log_attribute_xp` + `daily_xp_earned` — `daily_xp_earned` is a derived cache of log XP for the daily-cap enforcement and is tightly coupled to logs
- `missionRepo` owns `missions`
- `settingsRepo` owns the key-value `settings` table

---

## Section A — Project bootstrap

PR title at end of section: `feat(setup): bootstrap Expo TypeScript project`

### Task A1: Initialize Expo project on a feature branch

**Files:**

- Create: entire project tree from `npx create-expo-app`
- Create: `package.json` (generated)
- Create: `tsconfig.json` (generated)
- Create: `app.json` (generated, will be replaced by `app.config.ts` in Task J1)

**Notes:** The repo currently contains only `docs/`, `README.md`, `.gitignore`, `.gitattributes`, and `CLAUDE.md`. We need to scaffold an Expo project into the existing directory without nuking those files.

- [ ] **Step 1: Create a feature branch off `develop`**

```bash
git checkout develop
git pull
git checkout -b feat/phase-1-foundation
```

- [ ] **Step 2: Scaffold Expo into the existing repo**

```bash
# Use a temp dir then copy in, since create-expo-app refuses to scaffold into a non-empty dir
npx --yes create-expo-app@latest .questum-tmp --template default --no-install
```

Then move the scaffolded files in (preserving existing docs/, .gitignore, .gitattributes, CLAUDE.md, README.md):

```bash
# From repo root, on Windows PowerShell:
Get-ChildItem -Path .questum-tmp -Force | Where-Object { $_.Name -notin @('.git') } | Move-Item -Destination . -Force
Remove-Item -Recurse -Force .questum-tmp
```

If create-expo-app overwrote `.gitignore` or `README.md`, restore the prior ones from git:

```bash
git checkout -- .gitignore README.md CLAUDE.md
```

- [ ] **Step 3: Verify the scaffold ran**

```bash
ls package.json tsconfig.json app.json
cat package.json | findstr "expo"
```

Expected: `package.json`, `tsconfig.json`, `app.json` exist; `package.json` lists `expo`, `react`, `react-native`, `expo-router` as dependencies.

- [ ] **Step 4: Install deps**

```bash
npm install
```

Expected: completes without errors. `node_modules/` is created. `.gitignore` already excludes `node_modules`.

- [ ] **Step 5: Add the locked extra deps in one install**

```bash
npm install zustand zod expo-sqlite expo-font react-native-svg
```

```bash
npm install --save-dev typescript @types/react @types/react-native better-sqlite3 @types/better-sqlite3
```

Expected: dependencies appear in `package.json`. No peer-dep warnings beyond Expo's standard ones.

- [ ] **Step 6: Smoke-check that `npx expo --version` works**

```bash
npx expo --version
```

Expected: prints a semver (e.g. `54.0.0`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(setup): scaffold Expo TypeScript project with core deps"
```

---

### Task A2: Strict TypeScript + path alias

**Files:**

- Modify: `tsconfig.json`

- [ ] **Step 1: Replace `tsconfig.json` content**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules", ".expo"]
}
```

- [ ] **Step 2: Run typecheck to verify no regressions**

Add the `typecheck` script first:

Modify `package.json` `"scripts"` block:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit"
  }
}
```

Then run:

```bash
npm run typecheck
```

Expected: exits 0 (the scaffold's default `App.tsx` or `app/index.tsx` has no errors under strict mode at this point).

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json package.json
git commit -m "feat(setup): enable TypeScript strict mode and @/* path alias"
```

---

### Task A3: ESLint + Prettier with `consistent-type-imports`

**Files:**

- Create: `eslint.config.js` (flat config)
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (add `lint` and `format` scripts, add deps)

- [ ] **Step 1: Install lint/format deps**

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks eslint-plugin-react-native eslint-config-prettier prettier eslint-plugin-prettier
```

- [ ] **Step 2: Create `eslint.config.js`**

```javascript
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'dist/**', 'build/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      prettier,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
```

- [ ] **Step 3: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
node_modules
.expo
android
ios
dist
build
*.lock
*.log
.superpowers
```

- [ ] **Step 5: Add `lint` and `format` scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 6: Format the codebase and verify lint passes**

```bash
npm run format
npm run lint
```

Expected: `format` rewrites files to Prettier style. `lint` exits 0 (no warnings, no errors).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(setup): add ESLint flat config and Prettier with consistent-type-imports"
```

---

### Task A4: README updates with setup instructions

**Files:**

- Modify: `README.md`

The existing README documents the product. Add a "Local development setup" section near the bottom so a fresh clone can boot.

- [ ] **Step 1: Append a setup section to `README.md`**

After the existing "Project docs" section, append:

````markdown
## Local development setup

Prerequisites: Node 20+, npm 10+, Git, an iPhone 15 Pro or newer with the Expo Go app installed (iOS 26+).

```bash
git clone <repo>
cd questum
npm install
npm run typecheck   # should pass
npm run lint        # should pass
npm run test        # should pass (after Section B)

npm start
# scan the QR code with Expo Go on your iPhone
```
````

The first time the app boots on a device it creates `questum.db` in the app's sandboxed storage and applies migrations. To reset: delete the app and reinstall via Expo Go (or call `expo-sqlite`'s `deleteDatabaseAsync` from a dev menu — wired in Phase 4).

Branching: `develop` is the integration branch, `main` is the release branch. Open PRs against `develop` (see `docs/CONVENTIONS.md`).

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(setup): add local development setup instructions to README"
````

---

## Section B — Quality gates

PR title: `feat(setup): test framework, scripts, and pre-commit hook`

### Task B1: Jest with ts-jest in node environment

**Files:**

- Create: `jest.config.js`
- Modify: `package.json` (add `test` script and deps)

We use Jest in `node` environment (not `jest-expo`) because Phase 1 only tests the migration runner, which uses `better-sqlite3`. The RN-environment Jest setup arrives in Phase 2 alongside the game engine.

- [ ] **Step 1: Install Jest deps**

```bash
npm install --save-dev jest ts-jest @types/jest
```

- [ ] **Step 2: Create `jest.config.js`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
```

- [ ] **Step 3: Add `test` script**

Modify `package.json` `"scripts"`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "jest"
  }
}
```

- [ ] **Step 4: Add a sentinel test so Jest doesn't error on empty test set**

Create `src/__tests__/sentinel.test.ts`:

```typescript
describe('jest is wired', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 1 test, passes. Jest exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(setup): wire up Jest with ts-jest and node testEnvironment"
```

---

### Task B2: Husky pre-commit hook

**Files:**

- Create: `.husky/pre-commit`
- Modify: `package.json` (add `prepare` script)

- [ ] **Step 1: Install Husky**

```bash
npm install --save-dev husky
```

- [ ] **Step 2: Add the `prepare` script and run it**

Modify `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "jest",
    "prepare": "husky"
  }
}
```

```bash
npm run prepare
```

Expected: creates `.husky/` directory.

- [ ] **Step 3: Create the pre-commit hook**

Create `.husky/pre-commit`:

```sh
npm run lint
npm run typecheck
```

(No shebang or `husky.sh` source line — that's the pre-v9 format.)

- [ ] **Step 4: Make it executable on Unix-likes (Windows-safe — git stores the bit)**

```bash
git update-index --chmod=+x .husky/pre-commit
```

- [ ] **Step 5: Test the hook by attempting a commit**

```bash
# Stage the hook itself:
git add .husky/pre-commit package.json
git commit -m "feat(setup): add Husky pre-commit hook running lint and typecheck"
```

Expected: commit succeeds; the hook runs and prints lint + typecheck output.

---

## Section C — Game constants (no runtime deps)

PR title: `feat(game): add Attribute type and design-system constants`

### Task C1: `src/game/constants.ts`

**Files:**

- Create: `src/game/constants.ts`
- Create: `src/game/__tests__/constants.test.ts`

This file is the single source of truth for the `Attribute` type and the design-system color tokens. Per `ARCHITECTURE.md` rule 1, this file imports nothing from the rest of the app. NativeWind config and Zod schemas (later tasks) read from here.

- [ ] **Step 1: Write a failing test that the constants exist with the expected shape**

Create `src/game/__tests__/constants.test.ts`:

```typescript
import { ATTRIBUTES, ATTRIBUTE_COLORS, COLORS, type Attribute } from '../constants';

describe('game constants', () => {
  it('exports six attributes in canonical order', () => {
    expect(ATTRIBUTES).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
  });

  it('has a color for every attribute', () => {
    for (const attr of ATTRIBUTES) {
      expect(ATTRIBUTE_COLORS[attr]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has the surface and accent tokens from the visual design spec', () => {
    expect(COLORS.bg).toBe('#0E1116');
    expect(COLORS.surface).toBe('#161B22');
    expect(COLORS.accent).toBe('#E8C547');
  });

  it('Attribute type is the union of the six codes', () => {
    const sample: Attribute = 'STR';
    expect(ATTRIBUTES).toContain(sample);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- constants
```

Expected: FAIL — `Cannot find module '../constants'`.

- [ ] **Step 3: Write `src/game/constants.ts`**

```typescript
export const ATTRIBUTES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

export const COLORS = {
  bg: '#0E1116',
  surface: '#161B22',
  surface2: '#1A1F26',
  border: '#2A2F36',
  text: '#E6EDF3',
  textMute: '#9AA4AE',
  textDim: '#7D8590',
  accent: '#E8C547',
} as const;

export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  STR: '#C97A6E',
  DEX: '#8FB29D',
  CON: '#D49E63',
  INT: '#7D9BC4',
  WIS: '#A892C7',
  CHA: '#C786A4',
} as const;

/** Maximum XP per attribute per calendar day (see GAME_RULES.md §Daily attribute cap). */
export const DAILY_ATTRIBUTE_XP_CAP = 200;

/** Maximum XP a single AI-classified log can deposit total (see GAME_RULES.md §Per-log XP cap). */
export const MAX_LOG_TOTAL_XP = 100;

/** Maximum XP a single AI-classified log can deposit into one attribute. */
export const MAX_LOG_ATTRIBUTE_XP = 50;
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- constants
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/constants.ts src/game/__tests__/constants.test.ts
git commit -m "feat(game): add Attribute type and design-system color constants"
```

---

## Section D — AI interface and Zod schemas

PR title: `feat(ai): scaffold AIService interface and Zod validators`

### Task D1: `src/ai/AIService.ts` interface

**Files:**

- Create: `src/ai/AIService.ts`

Type-only import from `@/game/constants` is allowed by `ARCHITECTURE.md`'s type-only exception.

- [ ] **Step 1: Write the interface file**

Create `src/ai/AIService.ts`:

```typescript
import type { Attribute } from '@/game/constants';

export interface ActiveMissionSummary {
  /** Full instance ID, e.g. 'daily_cardio_20_2026-05-07'. */
  id: string;
  /** Human-readable, used by the AI for matching against the log text. */
  description: string;
  attribute: Attribute;
}

export interface ClassifyLogInput {
  /** Raw user log, e.g. "ran 5km this morning". */
  text: string;
  activeMissions: ActiveMissionSummary[];
  currentStreak: number;
  /** Optional ISO time. */
  timeOfDay?: string;
}

export interface LogResult {
  /** Short label, max 60 chars. */
  summary: string;
  primaryAttribute: Attribute;
  /** Per-attribute XP. Always six keys, value 0 means unaffected. */
  attributeXP: Record<Attribute, number>;
  /** 0 to 100 (inclusive). */
  totalXP: number;
  /** Mission instance IDs the log applies to. */
  matchedMissions: string[];
  /** 0.0 to 1.0. */
  confidence: number;
  improvementDetected: boolean;
}

export interface AIService {
  /** Returns true if this implementation can run on the current device. */
  isAvailable(): Promise<boolean>;

  /**
   * Classifies a log into structured XP/attribute data.
   *
   * Implementations must respect `signal`: if aborted, throw a
   * `DOMException` with `name === 'AbortError'` rather than resolving.
   * Implementations should also apply an internal timeout (default 10s)
   * and abort themselves if exceeded.
   */
  classifyLog(input: ClassifyLogInput, signal?: AbortSignal): Promise<LogResult>;

  /** Human-readable name for the Settings screen. */
  readonly displayName: string;
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/ai/AIService.ts
git commit -m "feat(ai): define AIService interface with AbortSignal cancellation contract"
```

---

### Task D2: `src/ai/schema.ts` Zod schemas

**Files:**

- Create: `src/ai/schema.ts`
- Create: `src/ai/schema.test.ts`

The runtime Zod schemas validate AI output. They must stay aligned with the `Attribute` type from `src/game/constants.ts`. We use a type-only import to keep the runtime separation per `ARCHITECTURE.md`.

- [ ] **Step 1: Write a failing test for the schemas**

Create `src/ai/schema.test.ts`:

```typescript
import {
  AttributeSchema,
  LogResultSchema,
  ClassifyLogInputSchema,
  ActiveMissionSummarySchema,
} from './schema';

describe('AttributeSchema', () => {
  it.each(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])('accepts %s', (a) => {
    expect(AttributeSchema.parse(a)).toBe(a);
  });

  it('rejects unknown attribute', () => {
    expect(() => AttributeSchema.parse('LCK')).toThrow();
  });
});

describe('LogResultSchema', () => {
  const valid = {
    summary: 'Morning run',
    primaryAttribute: 'CON' as const,
    attributeXP: { STR: 0, DEX: 0, CON: 30, INT: 0, WIS: 0, CHA: 0 },
    totalXP: 30,
    matchedMissions: [],
    confidence: 0.9,
    improvementDetected: false,
  };

  it('accepts a well-formed result', () => {
    expect(() => LogResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects totalXP > 100', () => {
    expect(() => LogResultSchema.parse({ ...valid, totalXP: 101 })).toThrow();
  });

  it('rejects per-attribute xp > 50', () => {
    expect(() =>
      LogResultSchema.parse({
        ...valid,
        attributeXP: { ...valid.attributeXP, CON: 51 },
      }),
    ).toThrow();
  });

  it('rejects negative xp', () => {
    expect(() => LogResultSchema.parse({ ...valid, totalXP: -1 })).toThrow();
  });

  it('rejects confidence out of [0,1]', () => {
    expect(() => LogResultSchema.parse({ ...valid, confidence: 1.1 })).toThrow();
  });

  it('rejects empty summary', () => {
    expect(() => LogResultSchema.parse({ ...valid, summary: '' })).toThrow();
  });

  it('rejects summary > 60 chars', () => {
    expect(() => LogResultSchema.parse({ ...valid, summary: 'x'.repeat(61) })).toThrow();
  });

  it('rejects missing attributeXP keys', () => {
    expect(() =>
      LogResultSchema.parse({
        ...valid,
        attributeXP: {
          STR: 0,
          DEX: 0,
          CON: 30,
          INT: 0,
          WIS: 0,
        } as unknown as typeof valid.attributeXP,
      }),
    ).toThrow();
  });
});

describe('ClassifyLogInputSchema', () => {
  it('accepts a minimal input', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({
        text: 'ran 5km',
        activeMissions: [],
        currentStreak: 3,
      }),
    ).not.toThrow();
  });

  it('accepts active missions', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({
        text: 'jog',
        activeMissions: [
          { id: 'daily_cardio_20_2026-05-07', description: 'Move 20 min', attribute: 'CON' },
        ],
        currentStreak: 0,
      }),
    ).not.toThrow();
  });

  it('rejects negative streak', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({ text: 'x', activeMissions: [], currentStreak: -1 }),
    ).toThrow();
  });
});

describe('ActiveMissionSummarySchema', () => {
  it('accepts a valid mission', () => {
    expect(() =>
      ActiveMissionSummarySchema.parse({
        id: 'daily_cardio_20_2026-05-07',
        description: 'Move your body for 20 minutes',
        attribute: 'CON',
      }),
    ).not.toThrow();
  });

  it('rejects an empty id', () => {
    expect(() =>
      ActiveMissionSummarySchema.parse({ id: '', description: 'x', attribute: 'CON' }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- schema
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/ai/schema.ts`**

```typescript
import { z } from 'zod';
import type { Attribute } from '@/game/constants';

export const AttributeSchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);

// Compile-time assertion: AttributeSchema's output type matches the Attribute type
// from game/constants.ts. If the lists drift, this line stops compiling.
const _attributeTypeCheck: Attribute = 'STR' as z.infer<typeof AttributeSchema>;
void _attributeTypeCheck;

const AttributeXPSchema = z.object({
  STR: z.number().int().min(0).max(50),
  DEX: z.number().int().min(0).max(50),
  CON: z.number().int().min(0).max(50),
  INT: z.number().int().min(0).max(50),
  WIS: z.number().int().min(0).max(50),
  CHA: z.number().int().min(0).max(50),
});

export const LogResultSchema = z.object({
  summary: z.string().min(1).max(60),
  primaryAttribute: AttributeSchema,
  attributeXP: AttributeXPSchema,
  totalXP: z.number().int().min(0).max(100),
  matchedMissions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  improvementDetected: z.boolean(),
});

export const ActiveMissionSummarySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  attribute: AttributeSchema,
});

export const ClassifyLogInputSchema = z.object({
  text: z.string().min(1),
  activeMissions: z.array(ActiveMissionSummarySchema),
  currentStreak: z.number().int().min(0),
  timeOfDay: z.string().optional(),
});

// Inferred types — these are the source of truth for the runtime shape; the
// hand-written interfaces in AIService.ts must stay in sync.
export type LogResultParsed = z.infer<typeof LogResultSchema>;
export type ClassifyLogInputParsed = z.infer<typeof ClassifyLogInputSchema>;
export type ActiveMissionSummaryParsed = z.infer<typeof ActiveMissionSummarySchema>;
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- schema
```

Expected: all schema tests pass.

- [ ] **Step 5: Verify type-only import lint compliance**

```bash
npm run lint
```

Expected: exits 0; the `import type { Attribute }` lines are accepted by `consistent-type-imports`.

- [ ] **Step 6: Commit**

```bash
git add src/ai/schema.ts src/ai/schema.test.ts
git commit -m "feat(ai): add Zod schemas for LogResult, ClassifyLogInput, and ActiveMissionSummary"
```

---

## Section E — Storage layer

PR title: `feat(storage): SQLite migration runner, repository skeletons`

### Task E1: `DbDriver` interface + production expo-sqlite adapter

**Files:**

- Create: `src/storage/db.ts`

The driver interface lets us run the migration runner against `better-sqlite3` in Jest while production uses `expo-sqlite`. This keeps the migration runner unit-testable without booting React Native.

- [ ] **Step 1: Create `src/storage/db.ts`**

```typescript
import * as SQLite from 'expo-sqlite';

/**
 * Minimal driver interface used by the migration runner and repositories.
 * Production: backed by expo-sqlite. Tests: backed by better-sqlite3 (see testHelpers.ts).
 */
export interface DbDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

const DB_NAME = 'questum.db';

let cachedDriver: DbDriver | null = null;

/** Production driver — opens the on-device SQLite file lazily and caches the handle. */
export async function getDb(): Promise<DbDriver> {
  if (cachedDriver) return cachedDriver;

  const native = await SQLite.openDatabaseAsync(DB_NAME);

  cachedDriver = {
    execAsync: (sql) => native.execAsync(sql),
    runAsync: (sql, params = []) =>
      native.runAsync(sql, params as readonly SQLite.SQLiteBindValue[]),
    getFirstAsync: <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      native.getFirstAsync<T>(sql, params as readonly SQLite.SQLiteBindValue[]),
    getAllAsync: <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      native.getAllAsync<T>(sql, params as readonly SQLite.SQLiteBindValue[]),
    withTransactionAsync: (fn) => native.withTransactionAsync(fn),
  };

  return cachedDriver;
}

/** Test-only: reset the cached driver so tests start from a fresh state. */
export function _resetDbCacheForTesting(): void {
  cachedDriver = null;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/storage/db.ts
git commit -m "feat(storage): add DbDriver interface and expo-sqlite production adapter"
```

---

### Task E2: Migration 001 inline SQL

**Files:**

- Create: `src/storage/migrations/001_initial.ts`
- Create: `src/storage/migrations/index.ts`

Inlining SQL as TypeScript template strings avoids Metro/Jest config gymnastics around `.sql` imports. If we ever need to author large migrations as separate `.sql` files, we can revisit — but at six tables this is fine.

- [ ] **Step 1: Create `src/storage/migrations/001_initial.ts`**

```typescript
export const MIGRATION_001 = `
CREATE TABLE character (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT NOT NULL,
  avatar_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE attribute_state (
  attribute       TEXT PRIMARY KEY CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  level           INTEGER NOT NULL DEFAULT 1,
  in_progress_xp  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE daily_xp_earned (
  day        TEXT NOT NULL,
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp_earned  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, attribute)
);
CREATE INDEX idx_daily_xp_day ON daily_xp_earned(day);

CREATE TABLE logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  text              TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  day               TEXT NOT NULL,
  ai_summary        TEXT NOT NULL,
  primary_attribute TEXT NOT NULL CHECK (primary_attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  total_xp          INTEGER NOT NULL,
  confidence        REAL NOT NULL,
  improvement       INTEGER NOT NULL DEFAULT 0,
  ai_source         TEXT NOT NULL
);
CREATE INDEX idx_logs_day ON logs(day);
CREATE INDEX idx_logs_created_at ON logs(created_at);

CREATE TABLE log_attribute_xp (
  log_id     INTEGER NOT NULL,
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp         INTEGER NOT NULL,
  PRIMARY KEY (log_id, attribute),
  FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
);

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
  expires_at      TEXT NOT NULL,
  completed_at    TEXT
);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_type_status ON missions(type, status);

CREATE TABLE streak (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  current_length  INTEGER NOT NULL DEFAULT 0,
  longest_length  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;
```

- [ ] **Step 2: Create `src/storage/migrations/index.ts`**

```typescript
import { MIGRATION_001 } from './001_initial';

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: ReadonlyArray<Migration> = [{ version: 1, sql: MIGRATION_001 }];
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/storage/migrations/001_initial.ts src/storage/migrations/index.ts
git commit -m "feat(storage): add 001_initial migration with all SCHEMA.md tables"
```

---

### Task E3: Migration runner with TDD

**Files:**

- Create: `src/storage/testHelpers.ts`
- Create: `src/storage/migrations.ts`
- Create: `src/storage/migrations.test.ts`

- [ ] **Step 1: Create the test helper that wraps `better-sqlite3` to satisfy `DbDriver`**

Create `src/storage/testHelpers.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { DbDriver } from './db';

/**
 * Test-only adapter. better-sqlite3 is synchronous; we wrap each call in
 * Promise.resolve(...) to satisfy the async DbDriver interface.
 */
export function createNodeSqliteDriver(db: Database.Database): DbDriver {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      const info = db.prepare(sql).run(...(params as unknown[]));
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },
    async getFirstAsync<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const row = db.prepare(sql).get(...(params as unknown[]));
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      return db.prepare(sql).all(...(params as unknown[])) as T[];
    },
    async withTransactionAsync(fn) {
      // better-sqlite3 transactions are synchronous; for tests we accept a
      // best-effort wrapper that just runs fn and lets exceptions propagate.
      await fn();
    },
  };
}
```

- [ ] **Step 2: Write failing tests for the runner**

Create `src/storage/migrations.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { applyMigrations, type Migration } from './migrations';
import { createNodeSqliteDriver } from './testHelpers';

describe('applyMigrations', () => {
  let raw: Database.Database;
  let driver: ReturnType<typeof createNodeSqliteDriver>;

  beforeEach(() => {
    raw = new Database(':memory:');
    driver = createNodeSqliteDriver(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('creates schema_version table when missing and applies all migrations', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version',
    );
    expect(versions.map((r) => r.version)).toEqual([1]);

    const tables = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='foo'",
    );
    expect(tables).toHaveLength(1);
  });

  it('skips already-applied migrations on re-run (idempotent)', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1]);
  });

  it('applies only newer migrations on partial state', async () => {
    const v1Only: Migration[] = [{ version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' }];
    await applyMigrations(driver, v1Only);

    const v1AndV2: Migration[] = [
      ...v1Only,
      { version: 2, sql: 'CREATE TABLE bar (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, v1AndV2);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1, 2]);

    const bar = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='bar'",
    );
    expect(bar).toHaveLength(1);
  });

  it('applies migrations in numeric order even when input is shuffled', async () => {
    const migrations: Migration[] = [
      { version: 3, sql: 'CREATE TABLE c (id INTEGER PRIMARY KEY);' },
      { version: 1, sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY);' },
      { version: 2, sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('records applied_at as an ISO timestamp', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const row = await driver.getFirstAsync<{ applied_at: string }>(
      'SELECT applied_at FROM schema_version WHERE version = 1',
    );
    expect(row).not.toBeNull();
    // ISO 8601: 2026-05-07T12:34:56.789Z
    expect(row?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('applies the production 001_initial migration end-to-end', async () => {
    const { MIGRATIONS } = await import('./migrations/index');
    await applyMigrations(driver, [...MIGRATIONS]);

    const tables = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((t) => t.name).filter((n) => !n.startsWith('sqlite_'));
    expect(names).toEqual(
      [
        'attribute_state',
        'character',
        'daily_xp_earned',
        'log_attribute_xp',
        'logs',
        'missions',
        'schema_version',
        'settings',
        'streak',
      ].sort(),
    );
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npm test -- migrations
```

Expected: FAIL — `Cannot find module './migrations'`.

- [ ] **Step 4: Implement the runner**

Create `src/storage/migrations.ts`:

```typescript
import type { DbDriver } from './db';

export type { Migration } from './migrations/index';
import type { Migration } from './migrations/index';

const SCHEMA_VERSION_DDL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

/**
 * Apply any migrations whose version is not yet recorded in `schema_version`,
 * in ascending version order. Idempotent: re-running with the same input is a no-op.
 *
 * Each migration's SQL is executed via `execAsync`, so a single migration
 * SQL string may contain multiple statements separated by semicolons.
 */
export async function applyMigrations(
  driver: DbDriver,
  migrations: ReadonlyArray<Migration>,
): Promise<void> {
  await driver.execAsync(SCHEMA_VERSION_DDL);

  const applied = await driver.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_version',
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  for (const m of sorted) {
    if (appliedSet.has(m.version)) continue;

    await driver.execAsync(m.sql);
    await driver.runAsync('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      m.version,
      new Date().toISOString(),
    ]);
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test -- migrations
```

Expected: 6 tests pass. The end-to-end test using `MIGRATIONS` confirms that `001_initial.ts` produces the full schema.

- [ ] **Step 6: Commit**

```bash
git add src/storage/migrations.ts src/storage/migrations.test.ts src/storage/testHelpers.ts
git commit -m "feat(storage): add migration runner with idempotent forward-only apply"
```

---

### Task E4: Repository skeletons

**Files:**

- Create: `src/storage/repositories/characterRepo.ts`
- Create: `src/storage/repositories/logRepo.ts`
- Create: `src/storage/repositories/missionRepo.ts`
- Create: `src/storage/repositories/settingsRepo.ts`

Skeletons are typed signatures that match how Phase 2/3 will call them. Bodies throw `Error('not implemented in Phase 1')` so any accidental Phase-1 caller crashes loudly. The exception is no method actually needs to work in Phase 1 — the app only opens the DB and runs migrations; no repository call paths fire from the placeholder screens.

- [ ] **Step 1: `characterRepo.ts`**

Create `src/storage/repositories/characterRepo.ts`:

```typescript
import type { Attribute } from '@/game/constants';

export interface Character {
  id: 1;
  name: string;
  avatarId: string;
  createdAt: string;
}

export interface AttributeState {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
}

export interface Streak {
  currentLength: number;
  longestLength: number;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`characterRepo.${name} not implemented in Phase 1`);
};

export async function getCharacter(): Promise<Character | null> {
  return NOT_IMPL('getCharacter');
}

export async function createCharacter(_name: string, _avatarId: string): Promise<Character> {
  return NOT_IMPL('createCharacter');
}

export async function getAttributeStates(): Promise<AttributeState[]> {
  return NOT_IMPL('getAttributeStates');
}

export async function updateAttributeStates(_states: AttributeState[]): Promise<void> {
  NOT_IMPL('updateAttributeStates');
}

export async function getStreak(): Promise<Streak> {
  return NOT_IMPL('getStreak');
}

export async function updateStreak(_streak: Streak): Promise<void> {
  NOT_IMPL('updateStreak');
}
```

- [ ] **Step 2: `logRepo.ts`**

Create `src/storage/repositories/logRepo.ts`:

```typescript
import type { Attribute } from '@/game/constants';

export interface LogEntry {
  id: number;
  text: string;
  createdAt: string;
  day: string;
  aiSummary: string;
  primaryAttribute: Attribute;
  totalXp: number;
  confidence: number;
  improvement: boolean;
  aiSource: 'apple' | 'gemini' | 'mock';
  attributeXp: Partial<Record<Attribute, number>>;
}

export interface LogInsert {
  text: string;
  createdAt: string;
  day: string;
  aiSummary: string;
  primaryAttribute: Attribute;
  totalXp: number;
  confidence: number;
  improvement: boolean;
  aiSource: 'apple' | 'gemini' | 'mock';
  attributeXp: Partial<Record<Attribute, number>>;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`logRepo.${name} not implemented in Phase 1`);
};

export async function insertLog(_input: LogInsert): Promise<LogEntry> {
  return NOT_IMPL('insertLog');
}

export async function getRecentLogs(_limit: number, _offset: number): Promise<LogEntry[]> {
  return NOT_IMPL('getRecentLogs');
}

export async function getLogsByAttribute(
  _attribute: Attribute,
  _limit: number,
  _offset: number,
): Promise<LogEntry[]> {
  return NOT_IMPL('getLogsByAttribute');
}

export async function getLastLogDay(): Promise<string | null> {
  return NOT_IMPL('getLastLogDay');
}

export async function getDailyXpEarned(_day: string): Promise<Partial<Record<Attribute, number>>> {
  return NOT_IMPL('getDailyXpEarned');
}

export async function incrementDailyXpEarned(
  _day: string,
  _gains: Partial<Record<Attribute, number>>,
): Promise<void> {
  NOT_IMPL('incrementDailyXpEarned');
}

export async function pruneDailyXpOlderThanDays(_days: number): Promise<void> {
  NOT_IMPL('pruneDailyXpOlderThanDays');
}
```

- [ ] **Step 3: `missionRepo.ts`**

Create `src/storage/repositories/missionRepo.ts`:

```typescript
import type { Attribute } from '@/game/constants';

export type MissionStatus = 'active' | 'completed' | 'expired';
export type MissionType = 'daily' | 'weekly';

export interface Mission {
  id: string;
  templateId: string;
  description: string;
  attribute: Attribute;
  type: MissionType;
  bonusXp: number;
  progress: number;
  target: number;
  status: MissionStatus;
  generatedAt: string;
  expiresAt: string;
  completedAt: string | null;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`missionRepo.${name} not implemented in Phase 1`);
};

export async function getActiveMissions(): Promise<Mission[]> {
  return NOT_IMPL('getActiveMissions');
}

export async function insertMissions(_missions: Mission[]): Promise<void> {
  NOT_IMPL('insertMissions');
}

export async function markCompleted(_id: string, _completedAt: string): Promise<void> {
  NOT_IMPL('markCompleted');
}

export async function expireBefore(_isoDateTime: string): Promise<number> {
  return NOT_IMPL('expireBefore');
}

export async function getRecentlyCompleted(_sinceDay: string): Promise<Mission[]> {
  return NOT_IMPL('getRecentlyCompleted');
}
```

- [ ] **Step 4: `settingsRepo.ts`**

Create `src/storage/repositories/settingsRepo.ts`:

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
  | 'onboarding_complete';

const NOT_IMPL = (name: string): never => {
  throw new Error(`settingsRepo.${name} not implemented in Phase 1`);
};

export async function getSetting(_key: SettingKey): Promise<string | null> {
  return NOT_IMPL('getSetting');
}

export async function setSetting(_key: SettingKey, _value: string): Promise<void> {
  NOT_IMPL('setSetting');
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return NOT_IMPL('getAllSettings');
}
```

- [ ] **Step 5: Verify typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/storage/repositories/
git commit -m "feat(storage): scaffold repository skeletons with typed signatures"
```

---

## Section F — Logger

PR title: `feat(lib): add central logger`

### Task F1: `src/lib/logger.ts`

**Files:**

- Create: `src/lib/logger.ts`

`CONVENTIONS.md` requires a central logger so we don't sprinkle `console.log` (which the lint rule blocks). In Phase 1 we just wrap `console`; production silencing of `debug`/`info` lands in Phase 4 alongside the production build.

- [ ] **Step 1: Create the logger**

Create `src/lib/logger.ts`:

```typescript
type Level = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const isDev = __DEV__;

function emit(level: Level, message: string, args: unknown[]): void {
  // ESLint's no-console allows warn/error; we use those channels for all dev logs.
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const tag = `[${level}]`;
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(tag, message, ...args);
  } else {
    // eslint-disable-next-line no-console
    console.warn(tag, message, ...args);
  }
}

export const logger: Logger = {
  debug: (message, ...args) => emit('debug', message, args),
  info: (message, ...args) => emit('info', message, args),
  warn: (message, ...args) => emit('warn', message, args),
  error: (message, ...args) => emit('error', message, args),
};
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/logger.ts
git commit -m "feat(lib): add central logger wrapping console with dev-vs-prod gate"
```

---

## Section G — Zustand store skeletons

PR title: `feat(state): scaffold Zustand store shapes`

### Task G1: All four stores

**Files:**

- Create: `src/state/characterStore.ts`
- Create: `src/state/logsStore.ts`
- Create: `src/state/missionsStore.ts`
- Create: `src/state/settingsStore.ts`

Skeletons expose the state shape and action signatures with empty bodies. Phase 2/3 will fill the bodies.

- [ ] **Step 1: `characterStore.ts`**

Create `src/state/characterStore.ts`:

```typescript
import { create } from 'zustand';
import type { Character, AttributeState, Streak } from '@/storage/repositories/characterRepo';

export interface CharacterStoreState {
  character: Character | null;
  attributeStates: AttributeState[];
  streak: Streak;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  createCharacter: (name: string, avatarId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStoreState>((set) => ({
  character: null,
  attributeStates: [],
  streak: { currentLength: 0, longestLength: 0 },
  loading: false,
  error: null,

  hydrate: async () => {
    // Phase 2/3 will call characterRepo.getCharacter() etc. and populate state.
    set({ loading: false });
  },

  createCharacter: async () => {
    // Phase 3 will implement.
  },
}));
```

- [ ] **Step 2: `logsStore.ts`**

Create `src/state/logsStore.ts`:

```typescript
import { create } from 'zustand';
import type { LogEntry } from '@/storage/repositories/logRepo';

export interface LogsStoreState {
  logs: LogEntry[];
  submitting: boolean;
  lastResultSummary: string | null;
  error: string | null;

  hydrate: () => Promise<void>;
  submitLog: (text: string) => Promise<void>;
  cancelSubmit: () => void;
}

export const useLogsStore = create<LogsStoreState>((set) => ({
  logs: [],
  submitting: false,
  lastResultSummary: null,
  error: null,

  hydrate: async () => {
    set({ logs: [] });
  },

  submitLog: async () => {
    // Phase 3 will implement the AI → game → storage flow.
  },

  cancelSubmit: () => {
    // Phase 3 will hook this to AbortController.abort().
  },
}));
```

- [ ] **Step 3: `missionsStore.ts`**

Create `src/state/missionsStore.ts`:

```typescript
import { create } from 'zustand';
import type { Mission } from '@/storage/repositories/missionRepo';

export interface MissionsStoreState {
  active: Mission[];
  recentlyCompleted: Mission[];
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  generateForToday: () => Promise<void>;
}

export const useMissionsStore = create<MissionsStoreState>((set) => ({
  active: [],
  recentlyCompleted: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ active: [], recentlyCompleted: [] });
  },

  generateForToday: async () => {
    // Phase 4 implements actual generation.
  },
}));
```

- [ ] **Step 4: `settingsStore.ts`**

Create `src/state/settingsStore.ts`:

```typescript
import { create } from 'zustand';

export interface SettingsStoreState {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  notificationMorningTime: string;
  decayPaused: boolean;
  firstDecayShown: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  loading: boolean;

  hydrate: () => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  onboardingComplete: false,
  notificationsEnabled: false,
  notificationMorningTime: '08:00',
  decayPaused: false,
  firstDecayShown: false,
  aiSourceLastUsed: 'none',
  loading: false,

  hydrate: async () => {
    // Phase 3 reads from settingsRepo and populates this object.
    set({ loading: false });
  },

  setOnboardingComplete: async (value) => {
    set({ onboardingComplete: value });
  },
}));
```

- [ ] **Step 5: Verify typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/state/
git commit -m "feat(state): scaffold Zustand stores with typed state shapes"
```

---

## Section H — Theming and fonts

PR title: `feat(ui): wire NativeWind to design tokens and load Manrope`

### Task H1: Install and configure NativeWind v4

**Files:**

- Create: `tailwind.config.js`
- Create: `global.css`
- Create or modify: `babel.config.js`
- Create or modify: `metro.config.js`
- Modify: `app.json` (add `web.bundler` if not present)
- Modify: `package.json` (deps)

NativeWind v4 reads Tailwind config and produces RN style objects via Babel + Metro plugins. The `tailwind.config.js` consumes `COLORS` and `ATTRIBUTE_COLORS` from `src/game/constants.ts` so the design system has a single source of truth.

- [ ] **Step 1: Install NativeWind and Tailwind**

```bash
npm install nativewind@latest react-native-reanimated
npm install --save-dev tailwindcss@latest
```

(Reanimated is a NativeWind v4 peer dependency.)

- [ ] **Step 2: Create `tailwind.config.js`**

Create `tailwind.config.js` at repo root with:

```javascript
const { COLORS, ATTRIBUTE_COLORS } = require('./src/game/constants');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: COLORS.bg,
        surface: COLORS.surface,
        'surface-2': COLORS.surface2,
        border: COLORS.border,
        text: COLORS.text,
        'text-mute': COLORS.textMute,
        'text-dim': COLORS.textDim,
        accent: COLORS.accent,
        'attr-str': ATTRIBUTE_COLORS.STR,
        'attr-dex': ATTRIBUTE_COLORS.DEX,
        'attr-con': ATTRIBUTE_COLORS.CON,
        'attr-int': ATTRIBUTE_COLORS.INT,
        'attr-wis': ATTRIBUTE_COLORS.WIS,
        'attr-cha': ATTRIBUTE_COLORS.CHA,
      },
      fontFamily: {
        manrope: ['Manrope_400Regular'],
        'manrope-medium': ['Manrope_500Medium'],
        'manrope-semibold': ['Manrope_600SemiBold'],
        'manrope-bold': ['Manrope_700Bold'],
        'manrope-extrabold': ['Manrope_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
```

The `require('./src/game/constants')` works because Tailwind config runs in Node and `constants.ts` is compiled at config-load time via NativeWind's Babel pipeline. If this fails at boot, switch to a duplicated literal map and add a Jest test asserting the two stay in sync.

- [ ] **Step 3: Create `global.css`**

Create `global.css` at repo root:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Update `babel.config.js`**

Create or modify `babel.config.js`:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [ ] **Step 5: Create `metro.config.js`**

Create `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 6: Verify the CSS-import side doesn't break typecheck**

```bash
npm run typecheck
```

Expected: exits 0. (NativeWind generates types into `nativewind-env.d.ts` automatically on first start.)

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js global.css babel.config.js metro.config.js package.json
git commit -m "feat(ui): configure NativeWind v4 and wire color tokens to game constants"
```

---

### Task H2: Load Manrope via `@expo-google-fonts/manrope`

**Files:**

- Modify: `package.json` (add dep)
- Modify: `app/_layout.tsx` (or create — see Task I1, which depends on this)

Manrope arrives via the `@expo-google-fonts` package family — pre-bundled font files we load through `expo-font`'s `useFonts` hook. The `_layout.tsx` integration happens in Task I1 (which depends on this dep being installed).

- [ ] **Step 1: Install the Manrope font package**

```bash
npm install @expo-google-fonts/manrope
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(ui): install @expo-google-fonts/manrope for Manrope loading"
```

---

## Section I — Navigation skeleton

PR title: `feat(ui): expo-router placeholder screens with DB init and font gate`

### Task I1: Root layout with DB init + font gate

**Files:**

- Modify or create: `app/_layout.tsx`

Replace whatever the Expo scaffold generated with our gated layout. The layout:

1. Loads Manrope via `useFonts`
2. Opens the SQLite DB and runs migrations
3. Renders `<Slot />` only when both are ready, otherwise a minimal "Loading…" fallback
4. Hooks the `expo-router` global error boundary

- [ ] **Step 1: Replace `app/_layout.tsx`**

```typescript
import { Slot } from 'expo-router';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { applyMigrations } from '@/storage/migrations';
import { MIGRATIONS } from '@/storage/migrations/index';
import { getDb } from '@/storage/db';
import { logger } from '@/lib/logger';
import '../global.css';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const [dbReady, setDbReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const driver = await getDb();
        await applyMigrations(driver, [...MIGRATIONS]);
        if (!cancelled) setDbReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('DB init failed', msg);
        if (!cancelled) setBootError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1116',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: '#E6EDF3', fontSize: 16, textAlign: 'center' }}>
          Database failed to initialize. Reinstall the app to retry.
        </Text>
        <Text style={{ color: '#7D8590', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
          {bootError}
        </Text>
      </View>
    );
  }

  if (!fontsLoaded || !dbReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1116',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#9AA4AE', fontSize: 14 }}>Loading…</Text>
      </View>
    );
  }

  return <Slot />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. (If the Expo scaffold included a different `_layout.tsx`, this replaces it cleanly.)

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(ui): wire root layout with Manrope font gate and SQLite migration init"
```

---

### Task I2: `app/index.tsx` route resolver

**Files:**

- Modify or create: `app/index.tsx`

Per `ARCHITECTURE.md`, the index route picks between onboarding and the main app based on `settings.onboarding_complete`. In Phase 1 the settings store is a skeleton, so we just default to onboarding.

- [ ] **Step 1: Replace `app/index.tsx`**

```typescript
import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/state/settingsStore';

export default function Index() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  return onboardingComplete ? <Redirect href="/(main)/character" /> : <Redirect href="/onboarding" />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat(ui): route between onboarding and main app via settings store"
```

---

### Task I3: Onboarding placeholder

**Files:**

- Create: `app/onboarding.tsx`

- [ ] **Step 1: Create the placeholder**

Create `app/onboarding.tsx`:

```typescript
import { Text, View } from 'react-native';

export default function Onboarding() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Onboarding
      </Text>
      <Text className="font-manrope text-text-mute" style={{ fontSize: 12, marginTop: 6 }}>
        Phase 3 will replace this with the pitch + character creation.
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat(ui): add onboarding placeholder screen"
```

---

### Task I4: Main tabs layout

**Files:**

- Create: `app/(main)/_layout.tsx`

- [ ] **Step 1: Create the tabs layout**

Create `app/(main)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { COLORS } from '@/game/constants';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 },
      }}
    >
      <Tabs.Screen name="character" options={{ title: 'Character' }} />
      <Tabs.Screen name="missions" options={{ title: 'Quests' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="log" options={{ href: null }} />
    </Tabs>
  );
}
```

The `href: null` on `log` keeps it accessible as a route but hides it from the tab bar — log entry is opened from the Character screen via the floating button (Phase 3), not as a peer tab.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/(main)/_layout.tsx
git commit -m "feat(ui): add main tabs layout (character, missions, history, settings)"
```

---

### Task I5: Five placeholder tab screens

**Files:**

- Create: `app/(main)/character.tsx`
- Create: `app/(main)/missions.tsx`
- Create: `app/(main)/history.tsx`
- Create: `app/(main)/settings.tsx`
- Create: `app/(main)/log.tsx`

Each is a near-identical placeholder. Repeat the markup verbatim for each so the engineer can paste without thinking. (DRY-ing this into a shared component is Phase 3 territory once we know what they actually share.)

- [ ] **Step 1: `character.tsx`**

```typescript
import { Text, View } from 'react-native';

export default function Character() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Character
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: `missions.tsx`**

```typescript
import { Text, View } from 'react-native';

export default function Missions() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Missions
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: `history.tsx`**

```typescript
import { Text, View } from 'react-native';

export default function History() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        History
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: `settings.tsx`**

```typescript
import { Text, View } from 'react-native';

export default function Settings() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Settings
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: `log.tsx`**

```typescript
import { Text, View } from 'react-native';

export default function Log() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Log Entry
      </Text>
    </View>
  );
}
```

- [ ] **Step 6: Typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/(main)/
git commit -m "feat(ui): add placeholder screens for character, missions, history, settings, log"
```

---

## Section J — App configuration and EAS

PR title: `feat(setup): app config and EAS development build profile`

### Task J1: Convert `app.json` to `app.config.ts` with iOS settings

**Files:**

- Delete: `app.json` (after migrating its content)
- Create: `app.config.ts`

A typed config file is easier to extend (`expo-constants` integration, environment variants in later phases).

- [ ] **Step 1: Read the existing `app.json`**

```bash
cat app.json
```

Note the existing `expo` block (name, slug, version, icon paths, splash, plugins). You'll fold these into `app.config.ts`.

- [ ] **Step 2: Create `app.config.ts`**

```typescript
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Questum',
  slug: 'questum',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'questum',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1116',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'com.kylelaguerta.questum',
    supportsTablet: false,
    deploymentTarget: '26.0',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: ['expo-router', 'expo-font', 'expo-sqlite'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
```

- [ ] **Step 3: Delete `app.json`**

```bash
git rm app.json
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. If `expo/config` types aren't resolved, install:

```bash
npm install --save-dev expo
```

- [ ] **Step 5: Verify Expo recognises the config**

```bash
npx expo config --type public
```

Expected: prints the merged config including `bundleIdentifier: com.kylelaguerta.questum` and `deploymentTarget: 26.0`.

- [ ] **Step 6: Commit**

```bash
git add app.config.ts
git commit -m "feat(setup): convert app.json to typed app.config.ts with iOS 26 deployment target"
```

---

### Task J2: EAS Build profiles (iOS only)

**Files:**

- Create: `eas.json`

Phase 1 doesn't actually run EAS builds (no Mac, no Apple Developer account yet). The config is in place so Phase 5 can flip the switch.

- [ ] **Step 1: Install the EAS CLI as a dev dep (so it's pinned)**

```bash
npm install --save-dev eas-cli
```

- [ ] **Step 2: Create `eas.json`**

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "channel": "preview"
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {}
    }
  }
}
```

Note: no `android` blocks. Phase 6 adds them.

- [ ] **Step 3: Run `eas project:init` if you have an Expo account; otherwise skip**

```bash
npx eas project:init
```

This is optional in Phase 1; it links the project to an EAS project ID. If you don't have an account yet, skip and add the `extra.eas.projectId` field in `app.config.ts` later.

- [ ] **Step 4: Commit**

```bash
git add eas.json package.json
git commit -m "feat(setup): add EAS Build profiles for iOS (development, preview, production)"
```

---

## Section K — Smoke test on device and final wrap

PR title: `chore(setup): smoke test and Phase 1 close-out`

### Task K1: Run on iPhone via Expo Go

This is a manual acceptance step, not a code change. It satisfies Phase 1 acceptance criterion 1 ("App launches on iPhone via Expo Go without errors") and 2 ("Database file is created on first launch").

- [ ] **Step 1: Start Expo dev server**

```bash
npm start
```

Expected: Metro starts. The terminal shows a QR code and a localhost URL.

- [ ] **Step 2: Open Expo Go on the iPhone and scan the QR code**

Expected:

- App downloads the JS bundle and renders the "Loading…" splash for ~1–2 seconds (font + DB init)
- Then renders the `Onboarding` placeholder screen (because `onboardingComplete` defaults to `false` in the settings store)
- No red error screen

- [ ] **Step 3: Verify DB was created**

In Expo Go, shake the device to open the dev menu → "Open JS Debugger" or "Show Performance Monitor" — the dev menu should be reachable. (Reading the SQLite file directly from Expo Go isn't trivially possible, but the absence of the bootError state means migrations completed, since the DB driver requires migrations to apply before `dbReady` flips to true.)

A more direct verification: temporarily add a `logger.info('DB ready, schema_version:', ...)` line that queries `SELECT version FROM schema_version` after migration. If the count is 1, the DB is real and migration 001 is applied. Then revert the temporary log before commit.

Alternatively, edit `app/index.tsx` temporarily to redirect to `/(main)/character`:

```typescript
// temporarily, for smoke test only — revert before commit
return <Redirect href="/(main)/character" />;
```

Tap each tab — Character, Quests, History, Settings — to verify the tab bar renders and navigation works. Then revert the temporary edit.

- [ ] **Step 4: Verify hot reload**

Edit `app/onboarding.tsx`, change "Onboarding" to "Onboarding ✨", save. Expo should hot-reload and the screen should update without a full reload.

Revert the change so the commit is clean.

- [ ] **Step 5: Run lint and typecheck one last time**

```bash
npm run lint
npm run typecheck
npm test
```

Expected: all three exit 0 with zero warnings.

- [ ] **Step 6: Commit (if any docs/log adjustments were needed)**

If no code changes were needed beyond the temporary smoke-test edits (which are reverted), skip the commit. Otherwise:

```bash
git add -A
git commit -m "chore(setup): smoke test and lint/typecheck verification"
```

---

### Task K2: Open the Phase 1 PR and merge to `develop`

> **User-confirmation gate:** Before pushing, surface the smoke-test results to the user (screenshots from the iPhone are ideal — Onboarding placeholder visible, then the Character/Missions/History/Settings tabs after temporarily routing past onboarding). Only push and open a PR after the user signs off on the visual smoke test. The plan auto-generates the PR body, but the merge-to-develop step is a destructive shared action and must be user-approved.

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feat/phase-1-foundation
```

- [ ] **Step 2: Open a PR**

Use `gh` (GitHub CLI):

```bash
gh pr create --base develop --title "feat: Phase 1 — Foundation" --body "$(cat <<'EOF'
## Summary

Implements Phase 1 of the Questum build per `docs/PHASES.md` lines 7–34 and the plan at `docs/superpowers/plans/2026-05-07-phase-1-foundation.md`.

- Expo TypeScript scaffold with strict mode and `@/*` path alias
- ESLint flat config + Prettier; `consistent-type-imports` enforces the type-only exception between `game/` and `ai/`
- Husky pre-commit running lint + typecheck
- Jest with ts-jest in node environment; migration runner unit tests use better-sqlite3
- SQLite migration runner with idempotent forward-only apply; ships 001_initial.sql with all SCHEMA.md tables
- Repository skeletons (character, log, mission, settings) with typed signatures and "not implemented" bodies
- Zustand store skeletons (character, logs, missions, settings)
- NativeWind v4 wired to `COLORS` and `ATTRIBUTE_COLORS` from `src/game/constants.ts`; Manrope loaded via `@expo-google-fonts/manrope`
- Expo Router skeleton: onboarding placeholder + (main) tab group with five placeholder screens
- `AIService` interface + Zod schemas for `LogResult`, `ClassifyLogInput`, `ActiveMissionSummary`
- `app.config.ts` with iOS 26 deployment target and bundle id; `eas.json` with iOS-only build profiles

## Test plan

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` exits 0 with no warnings
- [x] `npm test` passes all unit tests (constants + AI schemas + migration runner)
- [x] App launches on iPhone via Expo Go without errors
- [x] DB initialization completes (no boot-error state on launch)
- [x] Tab navigation works (manual verification by temporarily routing to /(main)/character)
- [x] Hot reload works (edit a placeholder screen; change appears without full reload)

## Out of scope

Anything in Phases 2–6. The repos and stores throw "not implemented" for any operation beyond the boot path.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Self-review the diff in the PR view**

Read every file change in the PR. Confirm:

- No accidental `console.log` calls in shipped paths (logger only)
- No `any` types and no unexplained `@ts-ignore`
- All cross-layer imports between `game/` and `ai/` use `import type ... from`
- No imports between `state/` and `ui/` and `storage/` violate `ARCHITECTURE.md` runtime rules
- No files committed from `node_modules/`, `.expo/`, or `.superpowers/`

- [ ] **Step 3: Merge to `develop`**

```bash
gh pr merge --squash --delete-branch
```

(Or use the GitHub UI if you prefer non-squash; squash keeps `develop`'s log clean across the many small commits this plan produces.)

---

## Phase 1 acceptance checklist

These are the exact criteria from `docs/PHASES.md` lines 24–30. Verify each before declaring Phase 1 done:

- [ ] App launches on iPhone via Expo Go without errors (Task K1 Step 2)
- [ ] Database file is created on first launch (Task K1 Step 3)
- [ ] Navigation between empty screens works (Task K1 Step 3)
- [ ] Hot reload works during development (Task K1 Step 4)
- [ ] `npm run lint` and `npm run typecheck` pass with zero warnings (Task K1 Step 5)
- [ ] README has setup instructions for a fresh clone (Task A4)

When all six are checked, post a brief "Phase 1 complete" note in your work journal and proceed to plan Phase 2.

---

## Risk notes

- **NativeWind config requires `src/game/constants.ts` to be Node-loadable.** Tailwind config runs in plain Node, which doesn't natively understand `.ts` files. If `tailwind.config.js` fails to `require('./src/game/constants')`, the cleanest fix is to keep the constants in TypeScript but author a small `scripts/syncTailwindColors.cjs` that imports them via `ts-node/register`, OR duplicate the literal hex maps directly in `tailwind.config.js` and add a Jest test (e.g. `src/game/__tests__/tailwindParity.test.ts`) that imports both and asserts they match. Choose the duplication path if the ts-node approach adds friction. Watch for this on the first `npm start`.
- **better-sqlite3 native bindings** must build for the user's Node version on Windows. If `npm install` fails for `better-sqlite3`, install Microsoft Build Tools or use prebuilt binaries (`npm install better-sqlite3 --build-from-source=false`).
- **Expo Router typed routes** are enabled via `experiments.typedRoutes: true`. The first `npm start` will generate `.expo/types/router.d.ts`. If TypeScript errors mention unknown routes, run `npm start` once and let it generate the file before running `npm run typecheck` again.
- **No EAS Build runs in Phase 1** — the EAS config exists to be ready for Phase 5. If `eas build` is invoked accidentally, it will fail without an Expo account; that's expected.
