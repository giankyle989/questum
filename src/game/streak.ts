/**
 * Streak multiplier table per GAME_RULES §Streak multiplier.
 * Streak length is "consecutive days with at least one log."
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.2;
  if (streakDays >= 5) return 1.1;
  if (streakDays >= 3) return 1.05;
  return 1.0;
}
