# Conventions

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`
- No `any`. Use `unknown` and narrow.
- No `@ts-ignore` without an inline comment explaining why and what would fix it.
- Prefer `type` for unions and primitives, `interface` for object shapes intended to be implemented or extended.
- Use `readonly` arrays and properties when the data shouldn't mutate.
- Branded types for IDs to prevent mixing: `type LogId = number & { __brand: 'LogId' }`.

## File naming

- `PascalCase.tsx` for React components: `CharacterSheetScreen.tsx`, `AttributeBar.tsx`
- `camelCase.ts` for everything else: `characterRepo.ts`, `xp.ts`, `aiServiceFactory.ts`
- Test files: `xp.test.ts` next to `xp.ts`, OR in a sibling `__tests__/` folder for groups
- One default export max per file. Prefer named exports.

## Imports

Order:

1. React / React Native
2. External libraries
3. Internal absolute imports (use path alias `@/`)
4. Relative imports

Configure path alias in `tsconfig.json`:

```json
"paths": { "@/*": ["src/*"] }
```

## Functions

- Pure functions in `src/game/` only. Pure means: no I/O, no Math.random, no Date.now, no global state.
- Date.now and Date construction are passed in as parameters to game functions for testability:
  ```typescript
  function shouldDecay(lastLogAt: string, now: Date): boolean;
  ```
- Avoid classes for business logic. Prefer functions and plain data.
- Avoid optional parameters that change behavior. Prefer separate functions or required configuration objects.

## Async

- Always use `async/await`, not raw `.then()`.
- Every `await` either lives inside a `try/catch` or has documented why it's safe to throw.
- Never swallow errors. Log them to a central error reporter (configured in `src/lib/errorReporter.ts`).

## State management (Zustand)

- One store per domain (character, logs, missions, settings).
- **Cross-store reads are allowed via `getState()` snapshots inside actions.** Cross-store _subscriptions_ (e.g. `useOtherStore(selector)` or `useOtherStore.subscribe(...)` from inside another store) are not. Reading another store's snapshot does not couple their render lifecycles; subscribing does.

  ```typescript
  // OK — snapshot read inside an action
  const character = useCharacterStore.getState().character;

  // NOT OK — creates a subscription dependency between stores
  const character = useCharacterStore((s) => s.character);
  ```

- Store actions are async functions that:
  1. Call repositories or services
  2. Apply game functions (pure)
  3. Update store state
  4. Never throw to the UI; convert errors to UI-displayable state

```typescript
// Good
const useLogsStore = create<LogsStore>((set, get) => ({
  logs: [],
  submitting: false,
  error: null,
  submitLog: async (text) => {
    set({ submitting: true, error: null });
    try {
      const aiResult = await aiService.classifyLog({ text, ... });
      const cleaned = clampLogResult(aiResult);
      const character = useCharacterStore.getState().character;
      const updated = applyXPToCharacter(character, cleaned);
      await characterRepo.update(updated);
      // ...
    } catch (e) {
      set({ error: 'Could not save your log. Try again.' });
    } finally {
      set({ submitting: false });
    }
  },
}));
```

## Components

- One component per file
- Props interface defined directly above the component
- No business logic in components — call store actions
- No direct database or AI imports in components

```typescript
interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  inProgressXP: number;
  threshold: number;
  decayedToday?: boolean;
}

export function AttributeBar({
  attribute,
  level,
  inProgressXP,
  threshold,
  decayedToday = false,
}: AttributeBarProps) {
  // ...
}
```

## Testing

### Game engine

- Jest with `ts-jest`
- Aim for 100% line and branch coverage of `src/game/`
- Test names should read like specifications: `it('does not decay during the 2-day grace period', () => {...})`

### Components

- React Native Testing Library
- Test user-visible behavior, not implementation details
- One smoke test per screen at minimum (renders without crashing)

### What NOT to test

- Storage layer (covered by integration testing on device)
- AI services (covered by the spike, not unit tests)
- Generated code from libraries

## Commits

Conventional Commits format:

```
<type>(<scope>): <subject>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`.
Scopes (optional): `game`, `ai`, `ui`, `storage`, `state`, `notifications`.

Examples:

- `feat(game): implement decay calculation with grace period`
- `fix(ui): xp gain animation no longer skips on rapid logs`
- `test(game): add edge case for level-up across multiple thresholds`
- `docs: update AI_CONTRACT with confidence threshold rules`

Keep commits small and atomic. A failing build between commits is unacceptable.

## Branching and PRs

- `develop` is the integration branch. All feature work lands here via PR.
- `main` is the release branch. Only updated when shipping a build (typically by merging `develop` into `main` and tagging).
- Use PRs against `develop` even when working alone. Forces a review pass.

PR description must include:

- What changed
- Why
- Which docs were updated (if any)
- Test plan: how the change was verified

## Lint and format

- Prettier for formatting (default config + 100 char line width)
- ESLint with `@typescript-eslint`, `react-hooks`, `react-native`
- Run `npm run lint` and `npm run typecheck` before every commit
- Set up a pre-commit hook with Husky (Phase 1 task)

## Comments

- Comments explain _why_, not _what_. The code shows what.
- Prefer self-documenting names over comments.
- TODO comments must include either a date or a tracking issue: `// TODO(2026-06-01): handle this edge case`
- No commented-out code in commits. Delete it.

## Logging

- Use a central logger in `src/lib/logger.ts`
- Levels: `debug`, `info`, `warn`, `error`
- Production builds suppress `debug` and `info`
- No `console.log` in shipped code (lint rule enforces)

## Secrets and config

- No secrets in code. Use `expo-secure-store` for anything sensitive.
- App config in `app.config.ts` with environment-specific variants.
- API keys (none in MVP, but post-MVP): EAS Secrets.

## Performance

- Watch render counts on the character sheet (it's the hot path)
- Use `React.memo` only after profiling, not preemptively
- SQLite queries should be `<10ms` on device — use indexes per `SCHEMA.md`
- AI calls show explicit loading states; never block the UI thread

## Error handling philosophy

- AI errors → fall back to mock classifier, log the failure
- Storage errors → show retry UI, don't lose user data
- Unknown errors → show generic "something went wrong, try again" message + log to error reporter
- Never crash the app from a recoverable error
