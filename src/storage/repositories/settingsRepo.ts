import type { DbDriver } from '@/storage/db';

export type SettingKey =
  | 'notifications_enabled'
  | 'notification_morning_time'
  | 'decay_paused'
  | 'decay_pause_started_at'
  | 'decay_paused_days_this_year'
  | 'decay_paused_year'
  | 'first_decay_shown'
  | 'ai_source_last_used'
  | 'onboarding_complete'
  | 'last_decay_run_day';

export async function getSetting(db: DbDriver, key: SettingKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(db: DbDriver, key: SettingKey, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function getAllSettings(db: DbDriver): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
