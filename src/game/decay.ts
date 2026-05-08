import type { AttributeStateLike } from '@/game/xp';

const PER_DAY_RETENTION = 0.99;

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

/**
 * Per GAME_RULES §Per-day decay and §Applied to in-progress XP only:
 * inProgressXp_new = floor(inProgressXp_old * 0.99^days). Level is never touched.
 */
export function applyDecay(state: AttributeStateLike, effectiveDays: number): AttributeStateLike {
  if (effectiveDays < 0) {
    throw new Error(`applyDecay: effectiveDays must be >= 0 (got ${effectiveDays})`);
  }
  if (effectiveDays === 0) return { ...state };
  const multiplier = Math.pow(PER_DAY_RETENTION, effectiveDays);
  const decayed = Math.floor(state.inProgressXp * multiplier);
  return {
    level: state.level,
    inProgressXp: Math.max(0, decayed),
  };
}
