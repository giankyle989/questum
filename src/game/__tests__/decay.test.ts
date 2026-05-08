import { applyDecay, effectiveInactiveDays } from '@/game/decay';
import type { AttributeStateLike } from '@/game/xp';

describe('effectiveInactiveDays', () => {
  it('returns 0 for daysSinceLastLog <= 2 (grace period)', () => {
    expect(effectiveInactiveDays(0, 0)).toBe(0);
    expect(effectiveInactiveDays(1, 0)).toBe(0);
    expect(effectiveInactiveDays(2, 0)).toBe(0);
  });

  it('returns daysSinceLastLog - 2 once past the grace period', () => {
    expect(effectiveInactiveDays(3, 0)).toBe(1);
    expect(effectiveInactiveDays(10, 0)).toBe(8);
  });

  it('subtracts paused days inside the inactive window', () => {
    // 10 days inactive, 3 paused → effective = 10 - 2 - 3 = 5
    expect(effectiveInactiveDays(10, 3)).toBe(5);
  });

  it('clamps to 0 when paused days swallow the whole window', () => {
    expect(effectiveInactiveDays(10, 20)).toBe(0);
    expect(effectiveInactiveDays(3, 5)).toBe(0);
  });
});

const at = (level: number, inProgressXp: number): AttributeStateLike => ({
  level,
  inProgressXp,
});

describe('applyDecay', () => {
  it('returns identity when effective days is 0', () => {
    expect(applyDecay(at(3, 80), 0)).toEqual({ level: 3, inProgressXp: 80 });
  });

  it('grace boundary: day 2 of inactivity yields no decay (composed with effectiveInactiveDays)', () => {
    // PHASES.md acceptance: "no decay days 1–2". effectiveInactiveDays(2, 0) === 0.
    expect(applyDecay(at(3, 80), effectiveInactiveDays(2, 0))).toEqual({
      level: 3,
      inProgressXp: 80,
    });
  });

  it('grace boundary: day 3 of inactivity yields exactly one day of decay (composed)', () => {
    // PHASES.md acceptance: "decay applied days 3+". effectiveInactiveDays(3, 0) === 1 → -1%.
    expect(applyDecay(at(3, 100), effectiveInactiveDays(3, 0))).toEqual({
      level: 3,
      inProgressXp: 99,
    });
  });

  it('applies one day of decay (1% compound, floor)', () => {
    expect(applyDecay(at(1, 100), 1)).toEqual({ level: 1, inProgressXp: 99 });
    expect(applyDecay(at(2, 50), 1)).toEqual({ level: 2, inProgressXp: 49 });
  });

  it('compounds across multiple days', () => {
    // 100 * 0.99^5 = 95.099... → floor 95
    expect(applyDecay(at(1, 100), 5)).toEqual({ level: 1, inProgressXp: 95 });
  });

  it('never reduces the level (only in-progress XP)', () => {
    // Even with massive decay, level stays. 200 * 0.99^88 ≈ 81.5 → 81
    const result = applyDecay(at(7, 200), 88);
    expect(result.level).toBe(7);
    expect(result.inProgressXp).toBeLessThan(200);
    expect(result.inProgressXp).toBeGreaterThanOrEqual(0);
  });

  it('clamps in-progress XP at 0 and never goes negative', () => {
    // 1 XP * 0.99^999 → near 0 → floor to 0
    const result = applyDecay(at(5, 1), 999);
    expect(result.level).toBe(5);
    expect(result.inProgressXp).toBe(0);
  });

  it('handles zero in-progress XP (no change)', () => {
    expect(applyDecay(at(4, 0), 30)).toEqual({ level: 4, inProgressXp: 0 });
  });

  it('throws on negative days', () => {
    expect(() => applyDecay(at(1, 100), -1)).toThrow();
  });
});
