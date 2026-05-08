import { getStreakMultiplier } from '@/game/streak';

describe('getStreakMultiplier', () => {
  it('returns 1.00 for streaks 0, 1, and 2', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(1)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.0);
  });
  it('returns 1.05 for streaks 3 and 4', () => {
    expect(getStreakMultiplier(3)).toBe(1.05);
    expect(getStreakMultiplier(4)).toBe(1.05);
  });
  it('returns 1.10 for streaks 5 and 6', () => {
    expect(getStreakMultiplier(5)).toBe(1.1);
    expect(getStreakMultiplier(6)).toBe(1.1);
  });
  it('returns 1.20 for streaks 7 and above', () => {
    expect(getStreakMultiplier(7)).toBe(1.2);
    expect(getStreakMultiplier(30)).toBe(1.2);
    expect(getStreakMultiplier(365)).toBe(1.2);
  });
});
