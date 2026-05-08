import {
  xpToReachLevel,
  totalXPForLevel,
  characterLevel,
  applyImprovementBonus,
  applyStreakMultiplier,
  applyXPMultipliers,
} from '@/game/xp';

describe('xpToReachLevel', () => {
  it('returns 100 for level 2 (i.e., 1→2 takes 100 XP)', () => {
    expect(xpToReachLevel(2)).toBe(100);
  });
  it('returns 200 for level 3', () => {
    expect(xpToReachLevel(3)).toBe(200);
  });
  it('returns 1000 for level 11', () => {
    expect(xpToReachLevel(11)).toBe(1000);
  });
  it('throws for level <= 1 (no threshold to reach level 1)', () => {
    expect(() => xpToReachLevel(1)).toThrow();
    expect(() => xpToReachLevel(0)).toThrow();
  });
});

describe('totalXPForLevel', () => {
  it('returns 0 for level 1 (starting level)', () => {
    expect(totalXPForLevel(1)).toBe(0);
  });
  it('returns 100 for level 2', () => {
    expect(totalXPForLevel(2)).toBe(100);
  });
  it('returns 50*N*(N-1) for level N: e.g., 300 for level 3, 600 for level 4', () => {
    expect(totalXPForLevel(3)).toBe(300);
    expect(totalXPForLevel(4)).toBe(600);
    expect(totalXPForLevel(10)).toBe(4500);
  });
});

describe('characterLevel', () => {
  it('returns the floored average of six attribute levels', () => {
    expect(characterLevel({ STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 })).toBe(1);
    expect(characterLevel({ STR: 2, DEX: 2, CON: 2, INT: 2, WIS: 2, CHA: 2 })).toBe(2);
    // (1+2+3+4+5+6)/6 = 3.5 → floor 3
    expect(characterLevel({ STR: 1, DEX: 2, CON: 3, INT: 4, WIS: 5, CHA: 6 })).toBe(3);
  });
});

describe('applyImprovementBonus', () => {
  it('returns the input unchanged when improvementDetected is false', () => {
    expect(applyImprovementBonus(50, false)).toBe(50);
    expect(applyImprovementBonus(0, false)).toBe(0);
  });
  it('returns 1.25 * input as a float when improvementDetected is true', () => {
    expect(applyImprovementBonus(50, true)).toBe(62.5);
    expect(applyImprovementBonus(40, true)).toBe(50);
    expect(applyImprovementBonus(0, true)).toBe(0);
  });
});

describe('applyStreakMultiplier', () => {
  it('returns the input multiplied as a float (no rounding)', () => {
    expect(applyStreakMultiplier(50, 1.0)).toBe(50);
    expect(applyStreakMultiplier(50, 1.05)).toBeCloseTo(52.5);
    expect(applyStreakMultiplier(50, 1.1)).toBeCloseTo(55);
    expect(applyStreakMultiplier(50, 1.2)).toBeCloseTo(60);
  });
  it('preserves fractional inputs through the multiply', () => {
    // float in, float out — composition with applyImprovementBonus stays exact
    expect(applyStreakMultiplier(62.5, 1.2)).toBeCloseTo(75);
  });
});

describe('applyXPMultipliers', () => {
  it('matches the GAME_RULES per-log ceiling worked example (50 → 75)', () => {
    // 50 → ×1.25 → 62.5 → ×1.20 → 75 (single round at the end)
    expect(applyXPMultipliers(50, true, 1.2)).toBe(75);
  });
  it('returns the base XP rounded when no improvement and 1.0 streak', () => {
    expect(applyXPMultipliers(37, false, 1.0)).toBe(37);
  });
  it('applies streak multiplier alone when no improvement', () => {
    // 50 × 1.05 = 52.5 → round to 53
    expect(applyXPMultipliers(50, false, 1.05)).toBe(53);
  });
  it('applies improvement bonus alone when streak multiplier is 1.0', () => {
    // 50 × 1.25 = 62.5 → Math.round(62.5) === 63 (rounds half away from zero).
    // Intentional: documents the rounding tie-break for future maintainers.
    expect(applyXPMultipliers(50, true, 1.0)).toBe(63);
  });
  it('returns 0 for a 0 base regardless of multipliers', () => {
    expect(applyXPMultipliers(0, true, 1.2)).toBe(0);
  });
});
