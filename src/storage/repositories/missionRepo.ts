import type { Attribute } from '@/game/constants';
import { addDays } from '@/game/calendar';
import type { ISODate } from '@/game/calendar';
import type { DbDriver } from '@/storage/db';

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
  generatedFor: ISODate;
  /**
   * @deprecated Use `generatedFor` to determine activity. The `expiresAt` column
   * is populated for schema compliance only.
   */
  expiresAt: string;
  completedAt: string | null;
}

interface MissionRow {
  id: string;
  template_id: string;
  description: string;
  attribute: Attribute;
  type: MissionType;
  bonus_xp: number;
  progress: number;
  target: number;
  status: MissionStatus;
  generated_at: string;
  generated_for: string;
  expires_at: string;
  completed_at: string | null;
}

function rowToMission(row: MissionRow): Mission {
  return {
    id: row.id,
    templateId: row.template_id,
    description: row.description,
    attribute: row.attribute,
    type: row.type,
    bonusXp: row.bonus_xp,
    progress: row.progress,
    target: row.target,
    status: row.status,
    generatedAt: row.generated_at,
    generatedFor: row.generated_for,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
  };
}

const SELECT_MISSION_COLUMNS = `id, template_id, description, attribute, type,
  bonus_xp, progress, target, status, generated_at, generated_for, expires_at, completed_at`;

export async function getActiveDailyMissions(db: DbDriver, today: ISODate): Promise<Mission[]> {
  const rows = await db.getAllAsync<MissionRow>(
    `SELECT ${SELECT_MISSION_COLUMNS} FROM missions
     WHERE type = 'daily' AND generated_for = ? AND completed_at IS NULL
     ORDER BY generated_at`,
    [today],
  );
  return rows.map(rowToMission);
}

export async function getActiveWeeklyMissions(
  db: DbDriver,
  mondayOfWeek: ISODate,
): Promise<Mission[]> {
  const rows = await db.getAllAsync<MissionRow>(
    `SELECT ${SELECT_MISSION_COLUMNS} FROM missions
     WHERE type = 'weekly' AND generated_for = ? AND completed_at IS NULL
     ORDER BY generated_at`,
    [mondayOfWeek],
  );
  return rows.map(rowToMission);
}

export async function insertMissions(db: DbDriver, missions: Mission[]): Promise<void> {
  for (const mission of missions) {
    const expiresAt =
      mission.type === 'daily'
        ? `${addDays(mission.generatedFor, 1)}T00:00:00Z`
        : `${addDays(mission.generatedFor, 7)}T00:00:00Z`;
    await db.runAsync(
      `INSERT OR IGNORE INTO missions (
        id, template_id, description, attribute, type,
        bonus_xp, progress, target, status,
        generated_at, generated_for, expires_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mission.id,
        mission.templateId,
        mission.description,
        mission.attribute,
        mission.type,
        mission.bonusXp,
        mission.progress,
        mission.target,
        mission.status,
        mission.generatedAt,
        mission.generatedFor,
        expiresAt,
        mission.completedAt,
      ],
    );
  }
}

export async function markCompleted(db: DbDriver, id: string, completedAt: string): Promise<void> {
  await db.runAsync(`UPDATE missions SET status = 'completed', completed_at = ? WHERE id = ?`, [
    completedAt,
    id,
  ]);
}

export async function getRecentlyCompleted(db: DbDriver, sinceDay: string): Promise<Mission[]> {
  const rows = await db.getAllAsync<MissionRow>(
    `SELECT ${SELECT_MISSION_COLUMNS} FROM missions
     WHERE status = 'completed' AND completed_at >= ?
     ORDER BY completed_at DESC`,
    [sinceDay],
  );
  return rows.map(rowToMission);
}
