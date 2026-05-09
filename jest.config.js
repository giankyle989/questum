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
  coverageThreshold: {
    './src/game/': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/ai/MockAIService.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/lib/clock.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/storage/repositories/': {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
