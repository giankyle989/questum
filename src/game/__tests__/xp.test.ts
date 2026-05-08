import { xpToReachLevel, totalXPForLevel, characterLevel } from '@/game/xp';

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
