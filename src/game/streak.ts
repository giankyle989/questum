import { nonPausedDaysBetween, type ISODate, type PauseWindow } from '@/game/calendar';

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

export interface UpdatePersistedStreakInput {
  currentStreak: number;
  /** Previously stored longest-streak watermark (`streak.longest_length`). */
  currentLongestStreak: number;
  /** Previously stored last log day, or null if no prior log. */
  lastLogDay: ISODate | null;
  today: ISODate;
  pauseWindows: PauseWindow[];
}

export interface UpdatePersistedStreakOutput {
  newStreak: number;
  /** `Math.max(currentLongestStreak, newStreak)` — the new watermark to persist. */
  newLongestStreak: number;
  newLastLogDay: ISODate;
}

/**
 * Streak update rule per GAME_RULES §Streak update rules. Called when a log
 * is submitted on `today`.
 *
 * - `lastLogDay === today` → already logged today, streak unchanged.
 * - `nonPausedDaysBetween(lastLogDay, today, pauseWindows) <= 1` → consecutive
 *   (either yesterday → today directly, or last-log → today across a fully
 *   paused bridge with no non-paused day missed) → increment.
 * - Otherwise → reset to 1.
 *
 * Also returns the updated `longestStreak` watermark so Phase 3 callers can
 * persist `streak.longest_length` in a single write without recomputing.
 */
export function updatePersistedStreak(
  input: UpdatePersistedStreakInput,
): UpdatePersistedStreakOutput {
  const { currentStreak, currentLongestStreak, lastLogDay, today, pauseWindows } = input;
  const finalize = (newStreak: number, newLastLogDay: ISODate): UpdatePersistedStreakOutput => ({
    newStreak,
    newLongestStreak: Math.max(currentLongestStreak, newStreak),
    newLastLogDay,
  });

  if (lastLogDay === null) {
    return finalize(1, today);
  }
  if (lastLogDay === today) {
    return finalize(currentStreak, today);
  }
  const nonPausedGap = nonPausedDaysBetween(lastLogDay, today, pauseWindows);
  if (nonPausedGap <= 1) {
    return finalize(currentStreak + 1, today);
  }
  return finalize(1, today);
}

export interface DisplayedStreakInput {
  stored: number;
  lastLogDay: ISODate | null;
  today: ISODate;
  pauseWindows: PauseWindow[];
}

/**
 * displayedStreak: zero the moment a non-paused gap actually breaks the streak,
 * even before the next log writes to the DB. Per GAME_RULES §Displayed streak.
 *
 * The `today === lastLogDay` "still in window" case from the spec is handled
 * implicitly: `nonPausedDaysBetween` returns 0 when start === end, which falls
 * into the `<= 1` branch and returns `stored`. No explicit guard needed.
 */
export function displayedStreak(input: DisplayedStreakInput): number {
  if (input.lastLogDay === null) return 0;
  const nonPausedGap = nonPausedDaysBetween(input.lastLogDay, input.today, input.pauseWindows);
  return nonPausedGap <= 1 ? input.stored : 0;
}
