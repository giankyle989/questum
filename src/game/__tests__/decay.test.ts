import { effectiveInactiveDays } from '@/game/decay';

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
