import { MISSION_TEMPLATES, type MissionTemplate } from '@/game/missions';
import { ATTRIBUTES } from '@/game/constants';

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
