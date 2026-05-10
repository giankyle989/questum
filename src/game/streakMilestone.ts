/**
 * Returns the highest streak milestone threshold the user crossed in this
 * submission, or null if no milestone was crossed.
 *
 * "Crossed" means: prev was strictly below the threshold, and next is at or
 * above the threshold. Sitting at a milestone (e.g., 7 → 8) returns null.
 */
export type StreakMilestone = 3 | 7 | 30;

export function crossedStreakMilestone(prev: number, next: number): StreakMilestone | null {
  for (const threshold of [30, 7, 3] as const) {
    if (prev < threshold && next >= threshold) return threshold;
  }
  return null;
}

/**
 * Streak multiplier at a given milestone. Mirrors the tiers in
 * `STREAK_MULTIPLIER_TIERS` (game/constants) — both the 7 and 30 tiers cap at
 * 1.20×, since GAME_RULES.md does not introduce a higher tier above 7.
 */
export function streakMultiplierAt(threshold: StreakMilestone): number {
  if (threshold === 3) return 1.05;
  return 1.2;
}
