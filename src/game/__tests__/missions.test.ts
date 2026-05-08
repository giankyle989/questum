import {
  MISSION_TEMPLATES,
  instanceIdFor,
  generateDailyMissions,
  generateWeeklyQuest,
  mondayOf,
  type MissionTemplate,
} from '@/game/missions';
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
