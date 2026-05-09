import { create } from 'zustand';
import type { ISODate } from '@/game/calendar';
import { ATTRIBUTES, type Attribute } from '@/game/constants';
import {
  generateDailyMissions,
  generateWeeklyQuest,
  mondayOf,
  type MissionInstance,
} from '@/game/missions';
import { daysAgoLocalISODate, todayLocalISODate } from '@/lib/clock';
import * as logRepo from '@/storage/repositories/logRepo';
import * as missionRepo from '@/storage/repositories/missionRepo';
import type { Mission } from '@/storage/repositories/missionRepo';
import { getDb } from '@/storage/db';
import { useCharacterStore } from '@/state/characterStore';

export interface MissionsStoreState {
  active: Mission[];
  recentlyCompleted: Mission[];
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  generateForToday: () => Promise<void>;
}

function instanceToMission(
  instance: MissionInstance,
  today: ISODate,
  mondayOfToday: ISODate,
): Mission {
  const generatedFor = instance.type === 'daily' ? today : mondayOfToday;
  return {
    id: instance.id,
    templateId: instance.templateId,
    description: instance.description,
    attribute: instance.attribute,
    type: instance.type,
    bonusXp: instance.bonusXP,
    progress: 0,
    target: 1,
    status: 'active',
    generatedAt: new Date().toISOString(),
    generatedFor,
    // missionRepo.insertMissions overwrites this internally; placeholder only.
    expiresAt: '',
    completedAt: null,
  };
}

export const useMissionsStore = create<MissionsStoreState>((set, get) => ({
  active: [],
  recentlyCompleted: [],
  loading: false,
  error: null,

  hydrate: async () => {
    const db = await getDb();
    const today = todayLocalISODate();
    const mondayOfToday = mondayOf(today);
    const [activeDailies, activeWeeklies, recentlyCompleted] = await Promise.all([
      missionRepo.getActiveDailyMissions(db, today),
      missionRepo.getActiveWeeklyMissions(db, mondayOfToday),
      missionRepo.getRecentlyCompleted(db, daysAgoLocalISODate(30)),
    ]);
    set({
      active: [...activeDailies, ...activeWeeklies],
      recentlyCompleted,
      loading: false,
    });
  },

  generateForToday: async () => {
    const db = await getDb();
    const today = todayLocalISODate();
    const mondayOfToday = mondayOf(today);

    const attributeStates = useCharacterStore.getState().attributeStates;
    const attributeLevels = {} as Record<Attribute, number>;
    for (const attr of ATTRIBUTES) {
      attributeLevels[attr] = 1;
    }
    for (const state of attributeStates) {
      attributeLevels[state.attribute] = state.level;
    }

    const lastLogDay = await logRepo.getLastLogDay(db);
    const hasEverLogged = lastLogDay !== null;

    const dailyInstances = generateDailyMissions({ attributeLevels, today, hasEverLogged });
    const weeklyInstances = generateWeeklyQuest({ attributeLevels, today });

    const missions: Mission[] = [
      ...dailyInstances.map((i) => instanceToMission(i, today, mondayOfToday)),
      ...weeklyInstances.map((i) => instanceToMission(i, today, mondayOfToday)),
    ];

    await missionRepo.insertMissions(db, missions);
    await get().hydrate();
  },
}));
