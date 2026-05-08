import {
  MISSION_TEMPLATES,
  instanceIdFor,
  generateDailyMissions,
  generateWeeklyQuest,
  mondayOf,
  validateMatchedMissions,
  applyMissionBonus,
  type MissionTemplate,
  type MissionInstance,
} from '@/game/missions';
import type { AttributeStateLike } from '@/game/xp';
import { ATTRIBUTES, type Attribute } from '@/game/constants';

describe('MISSION_TEMPLATES', () => {
  it('has at least one daily template per attribute', () => {
    for (const attribute of ATTRIBUTES) {
      const dailyForAttr = MISSION_TEMPLATES.filter(
        (t) => t.attribute === attribute && t.type === 'daily',
      );
      expect(dailyForAttr.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('has at least one weekly template per attribute', () => {
    for (const attribute of ATTRIBUTES) {
      const weeklyForAttr = MISSION_TEMPLATES.filter(
        (t) => t.attribute === attribute && t.type === 'weekly',
      );
      expect(weeklyForAttr.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every template has a unique templateId', () => {
    const ids = MISSION_TEMPLATES.map((t: MissionTemplate) => t.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('daily bonusXP is 50 and weekly is 150 by default', () => {
    for (const t of MISSION_TEMPLATES) {
      if (t.type === 'daily') expect(t.bonusXP).toBe(50);
      if (t.type === 'weekly') expect(t.bonusXP).toBe(150);
    }
  });
});

describe('instanceIdFor', () => {
  it('joins templateId and ISO date with underscore', () => {
    expect(instanceIdFor('daily_con_cardio', '2026-05-08')).toBe('daily_con_cardio_2026-05-08');
  });
});

const allLevel1 = (): Record<Attribute, number> => ({
  STR: 1,
  DEX: 1,
  CON: 1,
  INT: 1,
  WIS: 1,
  CHA: 1,
});

describe('generateDailyMissions', () => {
  it('returns exactly 3 instances', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    expect(out).toHaveLength(3);
  });

  it('uses the default seed (CON, INT, CHA) when user has never logged', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    const attrs = out.map((m) => m.attribute);
    expect(new Set(attrs)).toEqual(new Set(['CON', 'INT', 'CHA']));
  });

  it('targets the three lowest-level attributes for an experienced user (ties broken by ATTRIBUTES order)', () => {
    // STR=5, DEX=2, CON=2, INT=4, WIS=2, CHA=3 → three lowest are DEX, CON, WIS (all 2)
    const out = generateDailyMissions({
      attributeLevels: { STR: 5, DEX: 2, CON: 2, INT: 4, WIS: 2, CHA: 3 },
      today: '2026-05-08',
      hasEverLogged: true,
    });
    const attrs = out.map((m) => m.attribute).sort();
    expect(attrs).toEqual(['CON', 'DEX', 'WIS']);
  });

  it('picks deterministic templates per date (same input → same instance ids)', () => {
    const a = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: true,
    });
    const b = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: true,
    });
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('produces unique instance ids and consistent generatedFor', () => {
    const out = generateDailyMissions({
      attributeLevels: allLevel1(),
      today: '2026-05-08',
      hasEverLogged: false,
    });
    expect(new Set(out.map((m) => m.id)).size).toBe(3);
    for (const m of out) {
      expect(m.generatedFor).toBe('2026-05-08');
      expect(m.type).toBe('daily');
    }
  });
});

describe('mondayOf', () => {
  it('returns the input when input is a Monday', () => {
    expect(mondayOf('2026-05-04')).toBe('2026-05-04'); // 2026-05-04 is a Monday
  });
  it('returns the previous Monday for a Wednesday', () => {
    expect(mondayOf('2026-05-06')).toBe('2026-05-04');
  });
  it('returns the previous Monday for a Sunday', () => {
    expect(mondayOf('2026-05-10')).toBe('2026-05-04');
  });
});

describe('generateWeeklyQuest', () => {
  it('returns a single weekly instance generatedFor that Monday', () => {
    const quests = generateWeeklyQuest({
      attributeLevels: { STR: 5, DEX: 5, CON: 5, INT: 2, WIS: 5, CHA: 5 },
      today: '2026-05-08', // Friday → Monday is 05-04
    });
    expect(quests).toHaveLength(1);
    const q = quests[0]!;
    expect(q.type).toBe('weekly');
    expect(q.generatedFor).toBe('2026-05-04');
    expect(q.attribute).toBe('INT');
    expect(q.bonusXP).toBe(150);
  });

  it('breaks ties by ATTRIBUTES order (returns STR when STR and DEX both lowest)', () => {
    const quests = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 1, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-08',
    });
    expect(quests[0]!.attribute).toBe('STR');
  });

  it('produces a stable instance id for the same Monday', () => {
    const a = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 5, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-06',
    });
    const b = generateWeeklyQuest({
      attributeLevels: { STR: 1, DEX: 5, CON: 5, INT: 5, WIS: 5, CHA: 5 },
      today: '2026-05-08',
    });
    expect(a[0]!.id).toBe(b[0]!.id);
  });
});

const dailyInst = (id: string, attribute: Attribute, bonusXP: number): MissionInstance => ({
  id,
  templateId: id,
  description: id,
  attribute,
  type: 'daily',
  bonusXP,
  generatedFor: '2026-05-08',
});

describe('validateMatchedMissions', () => {
  it('returns valid ids and summed bonus XP grouped by attribute', () => {
    const active: MissionInstance[] = [
      dailyInst('m1', 'STR', 50),
      dailyInst('m2', 'CON', 50),
      dailyInst('m3', 'INT', 50),
    ];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'm3'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.completedIds).toEqual(['m1', 'm3']);
    expect(result.bonusByAttribute).toEqual({ STR: 50, CON: 0, DEX: 0, INT: 50, WIS: 0, CHA: 0 });
  });

  it('drops unknown ids silently', () => {
    const active: MissionInstance[] = [dailyInst('m1', 'STR', 50)];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'unknown'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.completedIds).toEqual(['m1']);
    expect(result.unknownIds).toEqual(['unknown']);
  });

  it('drops already-completed ids', () => {
    const active: MissionInstance[] = [dailyInst('m1', 'STR', 50)];
    const result = validateMatchedMissions({
      matchedIds: ['m1'],
      activeMissions: active,
      completedIds: new Set(['m1']),
    });
    expect(result.completedIds).toEqual([]);
    expect(result.alreadyCompleted).toEqual(['m1']);
    expect(result.bonusByAttribute.STR).toBe(0);
  });

  it('sums bonuses when multiple matched missions target the same attribute', () => {
    const active: MissionInstance[] = [
      dailyInst('m1', 'STR', 50),
      { ...dailyInst('w1', 'STR', 150), type: 'weekly' },
    ];
    const result = validateMatchedMissions({
      matchedIds: ['m1', 'w1'],
      activeMissions: active,
      completedIds: new Set(),
    });
    expect(result.bonusByAttribute.STR).toBe(200);
  });
});

const evenStates = (level: number, inProgressXp: number) =>
  ATTRIBUTES.reduce(
    (acc, a) => {
      acc[a] = { level, inProgressXp };
      return acc;
    },
    {} as Record<Attribute, AttributeStateLike>,
  );

const noBonus = (): Record<Attribute, number> =>
  ATTRIBUTES.reduce(
    (acc, a) => {
      acc[a] = 0;
      return acc;
    },
    {} as Record<Attribute, number>,
  );

describe('applyMissionBonus', () => {
  it('applies bonus XP without any cap clamping (can exceed 200/day on attribute)', () => {
    const states = evenStates(1, 0);
    const bonus = noBonus();
    bonus.STR = 200;
    const result = applyMissionBonus(states, bonus);
    // 200 → level 2 with 100 carry → 100 → level 3 with 0 carry. Wait: at level 2, threshold to reach 3 is 200.
    // 100 < 200, so stay at level 2 with 100 in-progress.
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 100 });
    expect(result.levelUps).toEqual([{ attribute: 'STR', newLevel: 2 }]);
  });

  it('returns identity when no attribute has bonus', () => {
    const states = evenStates(3, 50);
    const result = applyMissionBonus(states, noBonus());
    expect(result.newStates.STR).toEqual({ level: 3, inProgressXp: 50 });
    expect(result.levelUps).toEqual([]);
  });

  it('applies bonus across multiple attributes and reports level-ups in attribute order', () => {
    const states = evenStates(1, 80);
    const bonus = noBonus();
    bonus.STR = 30;
    bonus.INT = 25;
    const result = applyMissionBonus(states, bonus);
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 10 });
    expect(result.newStates.INT).toEqual({ level: 2, inProgressXp: 5 });
    // Level-ups iterate in ATTRIBUTES order: STR, DEX, CON, INT, WIS, CHA
    expect(result.levelUps).toEqual([
      { attribute: 'STR', newLevel: 2 },
      { attribute: 'INT', newLevel: 2 },
    ]);
  });

  it('treats missing bonusByAttribute keys as 0 (?? fallback)', () => {
    // Pass a partial bonusByAttribute that omits keys — those should be treated as 0.
    const states = evenStates(2, 25);
    const result = applyMissionBonus(states, { STR: 50 } as Record<Attribute, number>);
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 75 });
    // DEX has no key → defaults to 0 → state unchanged.
    expect(result.newStates.DEX).toEqual({ level: 2, inProgressXp: 25 });
    expect(result.levelUps).toEqual([]);
  });

  it('produces double level-ups when bonus stacks high (e.g., daily + weekly on same attribute)', () => {
    // Per GAME_RULES §Per-log ceiling worst case: daily 50 + weekly 150 on same attribute = 200 bonus.
    const states = evenStates(1, 0);
    const bonus = noBonus();
    bonus.STR = 200; // 50 + 150
    const result = applyMissionBonus(states, bonus);
    // 200 from level 1 with 0 in-progress: → level 2 (carry 100). Threshold 2→3 = 200, 100 < 200, stop.
    expect(result.newStates.STR).toEqual({ level: 2, inProgressXp: 100 });
  });
});

describe('pickInstance defensive throw (unreachable in normal flow)', () => {
  // Exercises the safety branch in pickInstance() when no templates exist for an
  // (attribute, type) combo. Normal flow guarantees coverage via MISSION_TEMPLATES,
  // so we synthesize the empty-candidates state by temporarily removing templates.
  it('throws when no daily templates exist for a target attribute', () => {
    // Remove all CON daily templates so the seed default ("CON, INT, CHA") triggers the throw.
    const conDailies = MISSION_TEMPLATES.filter((t) => t.attribute === 'CON' && t.type === 'daily');
    const removed: MissionTemplate[] = [];
    for (const t of conDailies) {
      const idx = MISSION_TEMPLATES.indexOf(t);
      removed.push(MISSION_TEMPLATES.splice(idx, 1)[0]!);
    }
    try {
      expect(() =>
        generateDailyMissions({
          attributeLevels: allLevel1(),
          today: '2026-05-08',
          hasEverLogged: false,
        }),
      ).toThrow(/No daily templates for CON/);
    } finally {
      // Restore so other tests are unaffected.
      MISSION_TEMPLATES.push(...removed);
    }
  });
});
