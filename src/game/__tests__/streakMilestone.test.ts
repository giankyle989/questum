import { crossedStreakMilestone, streakMultiplierAt } from '@/game/streakMilestone';

describe('crossedStreakMilestone', () => {
  it('returns null when no threshold is crossed', () => {
    expect(crossedStreakMilestone(0, 1)).toBeNull();
    expect(crossedStreakMilestone(0, 0)).toBeNull();
    expect(crossedStreakMilestone(7, 8)).toBeNull();
    expect(crossedStreakMilestone(7, 7)).toBeNull();
    expect(crossedStreakMilestone(30, 31)).toBeNull();
    expect(crossedStreakMilestone(30, 100)).toBeNull();
  });

  it('returns 3 when crossing the 3-day threshold', () => {
    expect(crossedStreakMilestone(2, 3)).toBe(3);
    expect(crossedStreakMilestone(2, 4)).toBe(3);
    expect(crossedStreakMilestone(2, 6)).toBe(3);
    expect(crossedStreakMilestone(0, 3)).toBe(3);
  });

  it('returns 7 when crossing the 7-day threshold', () => {
    expect(crossedStreakMilestone(6, 7)).toBe(7);
    expect(crossedStreakMilestone(2, 7)).toBe(7);
    expect(crossedStreakMilestone(2, 8)).toBe(7);
    expect(crossedStreakMilestone(2, 29)).toBe(7);
  });

  it('returns 30 when crossing the 30-day threshold', () => {
    expect(crossedStreakMilestone(29, 30)).toBe(30);
    expect(crossedStreakMilestone(2, 30)).toBe(30);
    expect(crossedStreakMilestone(2, 100)).toBe(30);
  });
});

describe('streakMultiplierAt', () => {
  it('returns the GAME_RULES multipliers for each threshold', () => {
    expect(streakMultiplierAt(3)).toBe(1.05);
    expect(streakMultiplierAt(7)).toBe(1.2);
    expect(streakMultiplierAt(30)).toBe(1.2);
  });
});
