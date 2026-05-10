/**
 * Minimal stub for expo-sqlite used in the node jest environment.
 * The real module is a native Expo module that cannot load in Node.
 * Tests that need SQLite use better-sqlite3 via testHelpers.ts instead.
 */
export const openDatabaseAsync = jest.fn().mockResolvedValue({
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 }),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
  withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
});
