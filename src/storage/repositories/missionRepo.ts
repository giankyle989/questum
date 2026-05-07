import type { Attribute } from '@/game/constants';

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
  expiresAt: string;
  completedAt: string | null;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`missionRepo.${name} not implemented in Phase 1`);
};

export async function getActiveMissions(): Promise<Mission[]> {
  return NOT_IMPL('getActiveMissions');
}

export async function insertMissions(_missions: Mission[]): Promise<void> {
  NOT_IMPL('insertMissions');
}

export async function markCompleted(_id: string, _completedAt: string): Promise<void> {
  NOT_IMPL('markCompleted');
}

export async function expireBefore(_isoDateTime: string): Promise<number> {
  return NOT_IMPL('expireBefore');
}

export async function getRecentlyCompleted(_sinceDay: string): Promise<Mission[]> {
  return NOT_IMPL('getRecentlyCompleted');
}
