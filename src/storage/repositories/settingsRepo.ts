export type SettingKey =
  | 'notifications_enabled'
  | 'notification_morning_time'
  | 'decay_paused'
  | 'decay_pause_started_at'
  | 'decay_paused_days_this_year'
  | 'decay_paused_year'
  | 'first_decay_shown'
  | 'ai_source_last_used'
  | 'onboarding_complete';

const NOT_IMPL = (name: string): never => {
  throw new Error(`settingsRepo.${name} not implemented in Phase 1`);
};

export async function getSetting(_key: SettingKey): Promise<string | null> {
  return NOT_IMPL('getSetting');
}

export async function setSetting(_key: SettingKey, _value: string): Promise<void> {
  NOT_IMPL('setSetting');
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return NOT_IMPL('getAllSettings');
}
