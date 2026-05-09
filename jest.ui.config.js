/** @type {import('jest').Config} */
// RNTL config — separate from the main Node-environment Jest config in
// jest.config.js. Limited to `*.test.tsx` files so the existing Node-env
// `*.test.ts` suite does not get re-run under jest-expo (which would fail
// on the SQLite/native modules those tests use).
//
// We don't set `roots` here: the jest-expo preset relies on Jest being able
// to resolve internal Expo modules (e.g. `expo/src/winter/...`) outside of
// `<rootDir>/src`, and Jest's "scope of the test code" guard rejects those
// requires when `roots` is narrowed.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ui.js'],
  // `roots` includes both `src` (where our tests live) and `node_modules` so
  // jest-expo can require internal Expo modules without tripping Jest's
  // "outside scope of the test code" guard. The relative `testMatch` avoids
  // embedding `<rootDir>` in the glob, which on Windows expands to a path
  // containing backslashes and breaks micromatch when the project lives
  // under `.claude/worktrees/...`.
  roots: ['<rootDir>/src', '<rootDir>/node_modules'],
  testMatch: ['**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
