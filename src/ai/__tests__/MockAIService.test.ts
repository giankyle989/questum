import type { ActiveMissionSummary, ClassifyLogInput, LogResult } from '@/ai/AIService';
import { MockAIService } from '@/ai/MockAIService';
import { LogResultSchema } from '@/ai/schema';
import { ATTRIBUTES } from '@/game/constants';

function makeInput(overrides: Partial<ClassifyLogInput> = {}): ClassifyLogInput {
  return {
    text: 'did something',
    activeMissions: [],
    currentStreak: 0,
    ...overrides,
  };
}

async function classify(
  input: Partial<ClassifyLogInput> = {},
  signal?: AbortSignal,
): Promise<LogResult> {
  const service = new MockAIService();
  return service.classifyLog(makeInput(input), signal);
}

const ZERO_XP = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };

describe('MockAIService — interface', () => {
  it('declares sourceId as "mock"', () => {
    const service = new MockAIService();
    expect(service.sourceId).toBe('mock');
  });

  it('declares displayName as "Mock (development)"', () => {
    const service = new MockAIService();
    expect(service.displayName).toBe('Mock (development)');
  });

  it('isAvailable resolves to true', async () => {
    const service = new MockAIService();
    await expect(service.isAvailable()).resolves.toBe(true);
  });
});

describe('MockAIService — schema validity', () => {
  it('returns a schema-valid LogResult for a normal log', async () => {
    const result = await classify({ text: 'ran 5km this morning' });
    expect(() => LogResultSchema.parse(result)).not.toThrow();
  });

  it('returns a schema-valid LogResult for an empty string', async () => {
    const result = await classify({ text: '' });
    expect(() => LogResultSchema.parse(result)).not.toThrow();
    expect(result.summary).toBe('Log');
  });

  it('returns a schema-valid LogResult for a very long string', async () => {
    const result = await classify({ text: 'a'.repeat(5000) });
    expect(() => LogResultSchema.parse(result)).not.toThrow();
    expect(result.summary.length).toBeLessThanOrEqual(60);
  });

  it('returns a schema-valid LogResult for unicode input', async () => {
    const result = await classify({ text: 'naglinis ng bahay 🧹 さようなら' });
    expect(() => LogResultSchema.parse(result)).not.toThrow();
  });

  it('always returns all six attribute keys', async () => {
    const result = await classify({ text: 'went to the gym' });
    for (const attr of ATTRIBUTES) {
      expect(result.attributeXP).toHaveProperty(attr);
      expect(typeof result.attributeXP[attr]).toBe('number');
    }
  });
});

describe('MockAIService — determinism', () => {
  it('returns identical output for identical input across calls', async () => {
    const input = makeInput({
      text: 'ran 5km then read 30 pages',
      activeMissions: [
        {
          id: 'daily_cardio_20_2026-05-07',
          description: 'Move your body 20 min',
          attribute: 'CON',
        },
      ],
      currentStreak: 4,
    });
    const service = new MockAIService();
    const a = await service.classifyLog(input);
    const b = await service.classifyLog(input);
    expect(a).toEqual(b);
  });
});

describe('MockAIService — fixture values from plan', () => {
  it('"went to the gym" → STR: 15 (no duration)', async () => {
    const result = await classify({ text: 'went to the gym' });
    expect(result.attributeXP).toEqual({ ...ZERO_XP, STR: 15 });
    expect(result.primaryAttribute).toBe('STR');
    expect(result.totalXP).toBe(15);
  });

  it('"ran 5km" → CON: 15 (5km × 6min/km = 30min, 30/2 = 15)', async () => {
    const result = await classify({ text: 'ran 5km' });
    expect(result.attributeXP).toEqual({ ...ZERO_XP, CON: 15 });
    expect(result.primaryAttribute).toBe('CON');
    expect(result.totalXP).toBe(15);
  });

  it('"read 40 pages" → INT: 40 (40 × 2 = 80min, 80/2 = 40)', async () => {
    const result = await classify({ text: 'read 40 pages' });
    expect(result.attributeXP).toEqual({ ...ZERO_XP, INT: 40 });
    expect(result.primaryAttribute).toBe('INT');
    expect(result.totalXP).toBe(40);
  });

  it('"read 3 chapters" → INT: 30 (3 × 20 = 60min, 60/2 = 30)', async () => {
    const result = await classify({ text: 'read 3 chapters' });
    expect(result.attributeXP).toEqual({ ...ZERO_XP, INT: 30 });
    expect(result.primaryAttribute).toBe('INT');
    expect(result.totalXP).toBe(30);
  });

  it('"studied for 2 hours" → INT: 50 (2 × 60 = 120min, capped at 50)', async () => {
    const result = await classify({ text: 'studied for 2 hours' });
    expect(result.attributeXP).toEqual({ ...ZERO_XP, INT: 50 });
    expect(result.primaryAttribute).toBe('INT');
    expect(result.totalXP).toBe(50);
  });

  it('"did the thing" → no-match fallback (confidence 0.2, totalXP 5, primary STR)', async () => {
    const result = await classify({ text: 'did the thing' });
    expect(result.confidence).toBe(0.2);
    expect(result.totalXP).toBe(5);
    expect(result.primaryAttribute).toBe('STR');
    expect(result.attributeXP).toEqual(ZERO_XP);
  });
});

describe('MockAIService — attribute keyword attribution', () => {
  it('STR keyword (gym) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'lifted at the gym' });
    expect(result.attributeXP.STR).toBe(15);
    expect(result.primaryAttribute).toBe('STR');
  });

  it('DEX keyword (cooked) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'cooked dinner' });
    // Note: "dinner" is also a CHA + CON keyword, so multiple attrs match.
    expect(result.attributeXP.DEX).toBe(15);
  });

  it('CON keyword (jog) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'morning jog' });
    expect(result.attributeXP.CON).toBe(15);
    expect(result.primaryAttribute).toBe('CON');
  });

  it('INT keyword (studied) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'studied algorithms' });
    expect(result.attributeXP.INT).toBe(15);
    expect(result.primaryAttribute).toBe('INT');
  });

  it('WIS keyword (meditated) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'meditated for clarity' });
    expect(result.attributeXP.WIS).toBe(15);
    expect(result.primaryAttribute).toBe('WIS');
  });

  it('CHA keyword (called) without duration awards 15 XP', async () => {
    const result = await classify({ text: 'called my mom' });
    // "mom" is also CHA, but result is the same.
    expect(result.attributeXP.CHA).toBe(15);
    expect(result.primaryAttribute).toBe('CHA');
  });
});

describe('MockAIService — duration formulas', () => {
  it('hours pattern: "ran for 1 hour" → CON 30 (60min/2)', async () => {
    const result = await classify({ text: 'ran for 1 hour' });
    expect(result.attributeXP.CON).toBe(30);
  });

  it('minutes pattern: "ran 30 minutes" → CON 15 (30min/2)', async () => {
    const result = await classify({ text: 'ran 30 minutes' });
    expect(result.attributeXP.CON).toBe(15);
  });

  it('hr abbreviation: "ran 1 hr" → CON 30', async () => {
    const result = await classify({ text: 'ran 1 hr' });
    expect(result.attributeXP.CON).toBe(30);
  });

  it('min abbreviation: "ran 40 min" → CON 20', async () => {
    const result = await classify({ text: 'ran 40 min' });
    expect(result.attributeXP.CON).toBe(20);
  });

  it('km pattern: "ran 1km" gives floor at 10 (1×6=6min, 6/2=3, max(10,3)=10)', async () => {
    const result = await classify({ text: 'ran 1km' });
    expect(result.attributeXP.CON).toBe(10);
  });

  it('matched + duration too short floors XP at 10', async () => {
    // 5 minutes / 2 = 2, but Math.max(10, 2) = 10
    const result = await classify({ text: 'ran 5 minutes' });
    expect(result.attributeXP.CON).toBe(10);
  });

  it('first duration pattern wins (hours over minutes when both present)', async () => {
    // "1 hour" comes first in DURATION_PATTERNS -> 60min, 60/2=30
    const result = await classify({ text: 'ran 1 hour and 30 minutes' });
    expect(result.attributeXP.CON).toBe(30);
  });
});

describe('MockAIService — multi-attribute logs', () => {
  it('"had lunch with friend" → CON+CHA both nonzero', async () => {
    const result = await classify({ text: 'had lunch with friend' });
    expect(result.attributeXP.CON).toBe(15);
    expect(result.attributeXP.CHA).toBe(15);
    // Tie broken by ATTRIBUTES order: STR<DEX<CON<INT<WIS<CHA → CON wins.
    expect(result.primaryAttribute).toBe('CON');
    expect(result.totalXP).toBe(30);
  });

  it('confidence rises with multiple matched attributes', async () => {
    const single = await classify({ text: 'went to the gym' });
    const multi = await classify({ text: 'had lunch with friend' });
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });
});

describe('MockAIService — totalXP cap', () => {
  it('caps totalXP at 100 even when sum of attribute XP exceeds it', async () => {
    // Triggers many keyword matches with a long duration to push past 100.
    // "studied" (INT, 50) + "called friend mom dad" (CHA, 50) + "lunch dinner" (CON+CHA, 50)
    // Sum: STR 0, DEX 0, CON 50, INT 50, WIS 0, CHA 50 = 150 → capped at 100.
    const result = await classify({
      text: 'studied for 2 hours then called mom dad friend over lunch dinner',
    });
    expect(result.totalXP).toBe(100);
    // Per-attribute caps remain at 50 (schema enforced).
    for (const attr of ATTRIBUTES) {
      expect(result.attributeXP[attr]).toBeLessThanOrEqual(50);
    }
  });
});

describe('MockAIService — improvement detection', () => {
  it.each([
    'longest run ever',
    'farthest I have biked',
    'heaviest deadlift this month',
    'hit a pr at the gym',
    'new personal best on bench',
    'broke my record running',
    'lifted more than last time',
    'workout was harder than yesterday',
    'pushed myself in the gym',
  ])('flags improvementDetected for "%s"', async (text) => {
    const result = await classify({ text });
    expect(result.improvementDetected).toBe(true);
  });

  it('does NOT flag improvementDetected on a plain log', async () => {
    const result = await classify({ text: 'went to the gym' });
    expect(result.improvementDetected).toBe(false);
  });
});

describe('MockAIService — confidence formula', () => {
  it('no-match confidence is 0.2', async () => {
    const result = await classify({ text: 'did the thing' });
    expect(result.confidence).toBe(0.2);
  });

  it('one matched attribute, no duration → 0.5 + 0.2 = 0.7', async () => {
    const result = await classify({ text: 'went to the gym' });
    expect(result.confidence).toBeCloseTo(0.7, 5);
  });

  it('one matched attribute + duration → 0.5 + 0.2 + 0.15 = 0.85', async () => {
    const result = await classify({ text: 'ran 5km' });
    expect(result.confidence).toBeCloseTo(0.85, 5);
  });

  it('two matched attributes + duration → 0.5 + 0.2 + 0.1 + 0.15 = 0.95 (capped)', async () => {
    // "had lunch (CON+CHA) for 30 minutes with friend"
    const result = await classify({ text: 'had lunch for 30 minutes with friend' });
    expect(result.confidence).toBeCloseTo(0.95, 5);
  });

  it('caps confidence at 0.95', async () => {
    // Many matches + duration; the cap should still hold.
    const result = await classify({
      text: 'studied for 2 hours then called mom dad friend over lunch dinner',
    });
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

describe('MockAIService — mission matching', () => {
  it('matches mission when ≥2 content words overlap', async () => {
    const missions: ActiveMissionSummary[] = [
      {
        id: 'daily_reading_chapters_2026-05-08',
        description: 'Read three chapters today',
        attribute: 'INT',
      },
    ];
    const result = await classify({
      text: 'read 3 chapters of my history book',
      activeMissions: missions,
    });
    expect(result.matchedMissions).toContain('daily_reading_chapters_2026-05-08');
  });

  it('does NOT match when fewer than 2 content words overlap', async () => {
    const missions: ActiveMissionSummary[] = [
      {
        id: 'daily_meditation_2026-05-08',
        description: 'Meditate for ten minutes today',
        attribute: 'WIS',
      },
    ];
    // "meditate" is the only overlapping content word (length > 3).
    const result = await classify({
      text: 'meditate now',
      activeMissions: missions,
    });
    expect(result.matchedMissions).not.toContain('daily_meditation_2026-05-08');
  });

  it('ignores short words (length ≤ 3) when computing overlap', async () => {
    const missions: ActiveMissionSummary[] = [
      {
        id: 'mission_short_words',
        description: 'go for a run now',
        attribute: 'CON',
      },
    ];
    // 'go', 'for', 'a', 'run', 'now' — only 'run' (length 3? no — len 3) and 'now' (len 3).
    // 'go' (2), 'for' (3), 'a' (1), 'run' (3), 'now' (3). All ≤3 except possibly none.
    const result = await classify({
      text: 'go for a run now',
      activeMissions: missions,
    });
    expect(result.matchedMissions).toEqual([]);
  });

  it('handles multiple active missions; only matches those with sufficient overlap', async () => {
    const missions: ActiveMissionSummary[] = [
      {
        id: 'matching_mission',
        description: 'Read three chapters today',
        attribute: 'INT',
      },
      {
        id: 'non_matching_mission',
        description: 'Climb the hardest mountain alone',
        attribute: 'STR',
      },
    ];
    const result = await classify({
      text: 'read 3 chapters today',
      activeMissions: missions,
    });
    expect(result.matchedMissions).toContain('matching_mission');
    expect(result.matchedMissions).not.toContain('non_matching_mission');
  });

  it('returns empty matchedMissions when no missions are active', async () => {
    const result = await classify({ text: 'ran 5km', activeMissions: [] });
    expect(result.matchedMissions).toEqual([]);
  });
});

describe('MockAIService — abort signal', () => {
  it('throws an AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const service = new MockAIService();
    await expect(
      service.classifyLog(makeInput({ text: 'ran 5km' }), controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('completes normally when signal is provided but not aborted', async () => {
    const controller = new AbortController();
    const result = await classify({ text: 'ran 5km' }, controller.signal);
    expect(result.totalXP).toBe(15);
  });

  it('completes normally when no signal is provided', async () => {
    const result = await classify({ text: 'ran 5km' });
    expect(result.totalXP).toBe(15);
  });
});

describe('MockAIService — summary', () => {
  it('uses raw text up to 60 chars', async () => {
    const result = await classify({ text: 'ran 5km this morning' });
    expect(result.summary).toBe('ran 5km this morning');
  });

  it('truncates to 60 chars for long input', async () => {
    const long = 'a'.repeat(120);
    const result = await classify({ text: long });
    expect(result.summary).toHaveLength(60);
  });

  it('uses fallback "Log" for empty string', async () => {
    const result = await classify({ text: '' });
    expect(result.summary).toBe('Log');
  });
});

describe('MockAIService — primary attribute tie-breaking', () => {
  it('ties resolve by ATTRIBUTES order (STR<DEX<CON<INT<WIS<CHA)', async () => {
    // STR (gym) and CON (jog) both 15 → STR wins.
    const result = await classify({ text: 'gym then jog' });
    expect(result.attributeXP.STR).toBe(15);
    expect(result.attributeXP.CON).toBe(15);
    expect(result.primaryAttribute).toBe('STR');
  });
});
