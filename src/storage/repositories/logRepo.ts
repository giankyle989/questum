import type { Attribute } from '@/game/constants';
import type { DbDriver } from '@/storage/db';

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

interface LogRow {
  id: number;
  text: string;
  created_at: string;
  day: string;
  ai_summary: string;
  primary_attribute: Attribute;
  total_xp: number;
  confidence: number;
  improvement: number;
  ai_source: 'apple' | 'gemini' | 'mock';
}

interface LogAttributeXpRow {
  attribute: Attribute;
  xp: number;
}

function buildAttributeXpMap(rows: LogAttributeXpRow[]): Partial<Record<Attribute, number>> {
  const result: Partial<Record<Attribute, number>> = {};
  for (const row of rows) {
    if (row.xp > 0) result[row.attribute] = row.xp;
  }
  return result;
}

function rowToLogEntry(row: LogRow, attributeXp: Partial<Record<Attribute, number>>): LogEntry {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    day: row.day,
    aiSummary: row.ai_summary,
    primaryAttribute: row.primary_attribute,
    totalXp: row.total_xp,
    confidence: row.confidence,
    improvement: Boolean(row.improvement),
    aiSource: row.ai_source,
    attributeXp,
  };
}

/**
 * Inserts a `logs` row plus its `log_attribute_xp` child rows in sequence.
 * Atomicity is the caller's responsibility — `submitLog` already wraps the
 * full pipeline in `withTransactionAsync`. expo-sqlite does not support
 * nested transactions, so this function MUST NOT introduce its own.
 */
export async function insertLog(db: DbDriver, input: LogInsert): Promise<LogEntry> {
  const result = await db.runAsync(
    `INSERT INTO logs (
      text, created_at, day, ai_summary, primary_attribute,
      total_xp, confidence, improvement, ai_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.text,
      input.createdAt,
      input.day,
      input.aiSummary,
      input.primaryAttribute,
      input.totalXp,
      input.confidence,
      input.improvement ? 1 : 0,
      input.aiSource,
    ],
  );
  const logId = result.lastInsertRowId;

  for (const [attribute, xp] of Object.entries(input.attributeXp)) {
    if (typeof xp === 'number' && xp > 0) {
      await db.runAsync('INSERT INTO log_attribute_xp (log_id, attribute, xp) VALUES (?, ?, ?)', [
        logId,
        attribute,
        xp,
      ]);
    }
  }

  const sparseAttributeXp: Partial<Record<Attribute, number>> = {};
  for (const [attribute, xp] of Object.entries(input.attributeXp)) {
    if (typeof xp === 'number' && xp > 0) {
      sparseAttributeXp[attribute as Attribute] = xp;
    }
  }

  return {
    id: logId,
    text: input.text,
    createdAt: input.createdAt,
    day: input.day,
    aiSummary: input.aiSummary,
    primaryAttribute: input.primaryAttribute,
    totalXp: input.totalXp,
    confidence: input.confidence,
    improvement: input.improvement,
    aiSource: input.aiSource,
    attributeXp: sparseAttributeXp,
  };
}

export async function getRecentLogs(
  db: DbDriver,
  limit: number,
  offset: number,
): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<LogRow>(
    `SELECT id, text, created_at, day, ai_summary, primary_attribute,
            total_xp, confidence, improvement, ai_source
     FROM logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  const entries: LogEntry[] = [];
  for (const row of rows) {
    const xpRows = await db.getAllAsync<LogAttributeXpRow>(
      'SELECT attribute, xp FROM log_attribute_xp WHERE log_id = ?',
      [row.id],
    );
    entries.push(rowToLogEntry(row, buildAttributeXpMap(xpRows)));
  }
  return entries;
}

export async function getLogsByAttribute(
  db: DbDriver,
  attribute: Attribute,
  limit: number,
  offset: number,
): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<LogRow>(
    `SELECT l.id, l.text, l.created_at, l.day, l.ai_summary, l.primary_attribute,
            l.total_xp, l.confidence, l.improvement, l.ai_source
     FROM logs l
     INNER JOIN log_attribute_xp lax ON lax.log_id = l.id
     WHERE lax.attribute = ?
     ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [attribute, limit, offset],
  );

  const entries: LogEntry[] = [];
  for (const row of rows) {
    const xpRows = await db.getAllAsync<LogAttributeXpRow>(
      'SELECT attribute, xp FROM log_attribute_xp WHERE log_id = ?',
      [row.id],
    );
    entries.push(rowToLogEntry(row, buildAttributeXpMap(xpRows)));
  }
  return entries;
}

export async function getLastLogDay(db: DbDriver): Promise<string | null> {
  const row = await db.getFirstAsync<{ day: string }>(
    'SELECT day FROM logs ORDER BY created_at DESC LIMIT 1',
  );
  return row?.day ?? null;
}

export async function getDailyXpEarned(
  db: DbDriver,
  day: string,
): Promise<Partial<Record<Attribute, number>>> {
  const rows = await db.getAllAsync<{ attribute: Attribute; xp_earned: number }>(
    'SELECT attribute, xp_earned FROM daily_xp_earned WHERE day = ?',
    [day],
  );
  const result: Partial<Record<Attribute, number>> = {};
  for (const row of rows) {
    if (row.xp_earned > 0) result[row.attribute] = row.xp_earned;
  }
  return result;
}

/**
 * Upserts daily-XP gains in sequence. Atomicity is the caller's responsibility
 * — wrap in `withTransactionAsync` if needed (e.g., `submitLog` does this).
 * expo-sqlite does not support nested transactions, so this function MUST NOT
 * introduce its own.
 */
export async function incrementDailyXpEarned(
  db: DbDriver,
  day: string,
  gains: Partial<Record<Attribute, number>>,
): Promise<void> {
  for (const [attribute, gain] of Object.entries(gains)) {
    if (typeof gain === 'number' && gain > 0) {
      await db.runAsync(
        `INSERT INTO daily_xp_earned (day, attribute, xp_earned) VALUES (?, ?, ?)
         ON CONFLICT(day, attribute) DO UPDATE SET xp_earned = xp_earned + excluded.xp_earned`,
        [day, attribute, gain],
      );
    }
  }
}

export async function pruneDailyXpOlderThanDays(db: DbDriver, days: number): Promise<void> {
  await db.runAsync(`DELETE FROM daily_xp_earned WHERE day < date('now', '-' || ? || ' days')`, [
    days,
  ]);
}
