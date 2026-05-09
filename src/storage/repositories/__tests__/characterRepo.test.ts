import Database from 'better-sqlite3';
import type { DbDriver } from '@/storage/db';
import { MIGRATION_001 } from '@/storage/migrations/001_initial';
import { MIGRATION_002 } from '@/storage/migrations/002_missions_generated_for';
import { createNodeSqliteDriver } from '@/storage/testHelpers';
import {
  createCharacter,
  getAttributeStates,
  getCharacter,
  getStreak,
  updateAttributeStates,
  updateStreak,
} from '@/storage/repositories/characterRepo';

describe('characterRepo', () => {
  let raw: Database.Database;
  let driver: DbDriver;

  beforeEach(() => {
    raw = new Database(':memory:');
    raw.exec(MIGRATION_001);
    raw.exec(MIGRATION_002);
    driver = createNodeSqliteDriver(raw);
  });

  afterEach(() => {
    raw.close();
  });

  describe('character', () => {
    it('returns null on empty DB', async () => {
      expect(await getCharacter(driver)).toBeNull();
    });

    it('createCharacter inserts and getCharacter returns it', async () => {
      const created = await createCharacter(driver, 'Zara', 'avatar_1');
      expect(created.id).toBe(1);
      expect(created.name).toBe('Zara');
      expect(created.avatarId).toBe('avatar_1');
      expect(typeof created.createdAt).toBe('string');

      const fetched = await getCharacter(driver);
      expect(fetched).toEqual({
        id: 1,
        name: 'Zara',
        avatarId: 'avatar_1',
        createdAt: created.createdAt,
      });
    });

    it('createCharacter throws when called twice (id = 1 unique)', async () => {
      await createCharacter(driver, 'Zara', 'avatar_1');
      await expect(createCharacter(driver, 'Other', 'avatar_2')).rejects.toThrow();
    });
  });

  describe('attribute states', () => {
    it('returns empty array on fresh DB', async () => {
      expect(await getAttributeStates(driver)).toEqual([]);
    });

    it('updateAttributeStates persists a single row', async () => {
      await updateAttributeStates(driver, [{ attribute: 'CON', level: 2, inProgressXp: 300 }]);
      const states = await getAttributeStates(driver);
      expect(states).toEqual([{ attribute: 'CON', level: 2, inProgressXp: 300 }]);
    });

    it('returns all 6 attributes in ATTRIBUTES order (STR, DEX, CON, INT, WIS, CHA)', async () => {
      // Insert in random order to verify the ORDER BY clause sorts correctly.
      await updateAttributeStates(driver, [
        { attribute: 'WIS', level: 5, inProgressXp: 50 },
        { attribute: 'STR', level: 1, inProgressXp: 0 },
        { attribute: 'CHA', level: 6, inProgressXp: 60 },
        { attribute: 'DEX', level: 2, inProgressXp: 20 },
        { attribute: 'INT', level: 4, inProgressXp: 40 },
        { attribute: 'CON', level: 3, inProgressXp: 30 },
      ]);

      const states = await getAttributeStates(driver);
      expect(states.map((s) => s.attribute)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    });

    it('updateAttributeStates upserts existing rows', async () => {
      await updateAttributeStates(driver, [{ attribute: 'STR', level: 1, inProgressXp: 0 }]);
      await updateAttributeStates(driver, [{ attribute: 'STR', level: 2, inProgressXp: 100 }]);
      const states = await getAttributeStates(driver);
      expect(states).toEqual([{ attribute: 'STR', level: 2, inProgressXp: 100 }]);
    });
  });

  describe('streak', () => {
    it('seeds and returns zeroed streak on fresh DB', async () => {
      const streak = await getStreak(driver);
      expect(streak).toEqual({ currentLength: 0, longestLength: 0 });

      // Subsequent call should still work (row now exists).
      expect(await getStreak(driver)).toEqual({ currentLength: 0, longestLength: 0 });
    });

    it('updateStreak persists values that getStreak reads back', async () => {
      await updateStreak(driver, { currentLength: 5, longestLength: 10 });
      expect(await getStreak(driver)).toEqual({ currentLength: 5, longestLength: 10 });
    });
  });
});
