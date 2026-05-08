/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Use `roots` + a relative `testMatch` so the glob doesn't embed `<rootDir>`,
  // which on Windows expands to a backslash path that micromatch mis-escapes
  // when the project lives under a directory like `.claude/worktrees/...`.
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
