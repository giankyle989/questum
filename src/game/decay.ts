/**
 * Per GAME_RULES §Grace period:
 * effectiveInactiveDays = max(0, daysSinceLastLog - 2 - pausedDaysInWindow)
 * The "2" is the always-on grace period. Pause days never count.
 */
export function effectiveInactiveDays(
  daysSinceLastLog: number,
  pausedDaysInWindow: number,
): number {
  return Math.max(0, daysSinceLastLog - 2 - pausedDaysInWindow);
}
