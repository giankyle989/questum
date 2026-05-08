import { validateLogResult } from '@/game/validation';
import type { LogResult } from '@/ai/AIService';

const goodResult = (overrides: Partial<LogResult> = {}): LogResult => ({
  summary: 'Ran 5km',
  primaryAttribute: 'CON',
  attributeXP: { STR: 0, DEX: 0, CON: 50, INT: 0, WIS: 0, CHA: 0 },
  totalXP: 50,
  matchedMissions: [],
  confidence: 0.8,
  improvementDetected: false,
  ...overrides,
});

describe('validateLogResult', () => {
  it('passes a clean result through unchanged', () => {
    const r = validateLogResult(goodResult());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalXP).toBe(50);
      expect(r.value.attributeXP.CON).toBe(50);
    }
  });

  it('clamps totalXP above 100 down to 100', () => {
    const r = validateLogResult(goodResult({ totalXP: 250 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalXP).toBe(100);
  });

  it('clamps negative totalXP to 0', () => {
    const r = validateLogResult(goodResult({ totalXP: -10 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalXP).toBe(0);
  });

  it('clamps individual attribute XP above 50 to 50', () => {
    const r = validateLogResult(
      goodResult({
        attributeXP: { STR: 80, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
        primaryAttribute: 'STR',
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.attributeXP.STR).toBe(50);
  });

  it('rejects when confidence < 0.3', () => {
    const r = validateLogResult(goodResult({ confidence: 0.2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low-confidence');
  });

  it('replaces invalid primary with the highest-XP attribute', () => {
    const r = validateLogResult({
      ...goodResult(),
      primaryAttribute: 'NOPE' as never,
      attributeXP: { STR: 10, DEX: 30, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.primaryAttribute).toBe('DEX');
  });

  it('rejects when primary is invalid AND all attributeXP are zero', () => {
    const r = validateLogResult({
      ...goodResult(),
      primaryAttribute: 'NOPE' as never,
      attributeXP: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      totalXP: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid-primary');
  });
});
