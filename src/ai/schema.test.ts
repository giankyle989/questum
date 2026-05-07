import {
  AttributeSchema,
  LogResultSchema,
  ClassifyLogInputSchema,
  ActiveMissionSummarySchema,
} from './schema';

describe('AttributeSchema', () => {
  it.each(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])('accepts %s', (a) => {
    expect(AttributeSchema.parse(a)).toBe(a);
  });

  it('rejects unknown attribute', () => {
    expect(() => AttributeSchema.parse('LCK')).toThrow();
  });
});

describe('LogResultSchema', () => {
  const valid = {
    summary: 'Morning run',
    primaryAttribute: 'CON' as const,
    attributeXP: { STR: 0, DEX: 0, CON: 30, INT: 0, WIS: 0, CHA: 0 },
    totalXP: 30,
    matchedMissions: [],
    confidence: 0.9,
    improvementDetected: false,
  };

  it('accepts a well-formed result', () => {
    expect(() => LogResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects totalXP > 100', () => {
    expect(() => LogResultSchema.parse({ ...valid, totalXP: 101 })).toThrow();
  });

  it('rejects per-attribute xp > 50', () => {
    expect(() =>
      LogResultSchema.parse({
        ...valid,
        attributeXP: { ...valid.attributeXP, CON: 51 },
      }),
    ).toThrow();
  });

  it('rejects negative xp', () => {
    expect(() => LogResultSchema.parse({ ...valid, totalXP: -1 })).toThrow();
  });

  it('rejects confidence out of [0,1]', () => {
    expect(() => LogResultSchema.parse({ ...valid, confidence: 1.1 })).toThrow();
  });

  it('rejects empty summary', () => {
    expect(() => LogResultSchema.parse({ ...valid, summary: '' })).toThrow();
  });

  it('rejects summary > 60 chars', () => {
    expect(() => LogResultSchema.parse({ ...valid, summary: 'x'.repeat(61) })).toThrow();
  });

  it('rejects missing attributeXP keys', () => {
    expect(() =>
      LogResultSchema.parse({
        ...valid,
        attributeXP: {
          STR: 0,
          DEX: 0,
          CON: 30,
          INT: 0,
          WIS: 0,
        } as unknown as typeof valid.attributeXP,
      }),
    ).toThrow();
  });
});

describe('ClassifyLogInputSchema', () => {
  it('accepts a minimal input', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({
        text: 'ran 5km',
        activeMissions: [],
        currentStreak: 3,
      }),
    ).not.toThrow();
  });

  it('accepts active missions', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({
        text: 'jog',
        activeMissions: [
          { id: 'daily_cardio_20_2026-05-07', description: 'Move 20 min', attribute: 'CON' },
        ],
        currentStreak: 0,
      }),
    ).not.toThrow();
  });

  it('rejects negative streak', () => {
    expect(() =>
      ClassifyLogInputSchema.parse({ text: 'x', activeMissions: [], currentStreak: -1 }),
    ).toThrow();
  });
});

describe('ActiveMissionSummarySchema', () => {
  it('accepts a valid mission', () => {
    expect(() =>
      ActiveMissionSummarySchema.parse({
        id: 'daily_cardio_20_2026-05-07',
        description: 'Move your body for 20 minutes',
        attribute: 'CON',
      }),
    ).not.toThrow();
  });

  it('rejects an empty id', () => {
    expect(() =>
      ActiveMissionSummarySchema.parse({ id: '', description: 'x', attribute: 'CON' }),
    ).toThrow();
  });
});
