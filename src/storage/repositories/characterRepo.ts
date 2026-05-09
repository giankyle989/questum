import type { Attribute } from '@/game/constants';
import type { DbDriver } from '@/storage/db';

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

interface CharacterRow {
  id: 1;
  name: string;
  avatar_id: string;
  created_at: string;
}

interface AttributeStateRow {
  attribute: Attribute;
  level: number;
  in_progress_xp: number;
}

interface StreakRow {
  current_length: number;
  longest_length: number;
}

const ATTRIBUTE_ORDER_SQL =
  'CASE attribute ' +
  "WHEN 'STR' THEN 1 " +
  "WHEN 'DEX' THEN 2 " +
  "WHEN 'CON' THEN 3 " +
  "WHEN 'INT' THEN 4 " +
  "WHEN 'WIS' THEN 5 " +
  "WHEN 'CHA' THEN 6 END";

export async function getCharacter(db: DbDriver): Promise<Character | null> {
  const row = await db.getFirstAsync<CharacterRow>(
    'SELECT id, name, avatar_id, created_at FROM character WHERE id = 1',
  );
  if (!row) return null;
  return {
    id: 1,
    name: row.name,
    avatarId: row.avatar_id,
    createdAt: row.created_at,
  };
}

export async function createCharacter(
  db: DbDriver,
  name: string,
  avatarId: string,
): Promise<Character> {
  const createdAt = new Date().toISOString();
  await db.runAsync('INSERT INTO character (id, name, avatar_id, created_at) VALUES (1, ?, ?, ?)', [
    name,
    avatarId,
    createdAt,
  ]);
  return { id: 1, name, avatarId, createdAt };
}

export async function getAttributeStates(db: DbDriver): Promise<AttributeState[]> {
  const rows = await db.getAllAsync<AttributeStateRow>(
    `SELECT attribute, level, in_progress_xp FROM attribute_state ORDER BY ${ATTRIBUTE_ORDER_SQL}`,
  );
  return rows.map((r) => ({
    attribute: r.attribute,
    level: r.level,
    inProgressXp: r.in_progress_xp,
  }));
}

export async function updateAttributeStates(db: DbDriver, states: AttributeState[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const state of states) {
      await db.runAsync(
        'INSERT OR REPLACE INTO attribute_state (attribute, level, in_progress_xp) VALUES (?, ?, ?)',
        [state.attribute, state.level, state.inProgressXp],
      );
    }
  });
}

export async function getStreak(db: DbDriver): Promise<Streak> {
  const row = await db.getFirstAsync<StreakRow>(
    'SELECT current_length, longest_length FROM streak WHERE id = 1',
  );
  if (!row) {
    await db.runAsync(
      'INSERT OR IGNORE INTO streak (id, current_length, longest_length) VALUES (1, 0, 0)',
    );
    return { currentLength: 0, longestLength: 0 };
  }
  return {
    currentLength: row.current_length,
    longestLength: row.longest_length,
  };
}

export async function updateStreak(db: DbDriver, streak: Streak): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO streak (id, current_length, longest_length) VALUES (1, ?, ?)',
    [streak.currentLength, streak.longestLength],
  );
}
