import { displayedStreak, getStreakMultiplier, updatePersistedStreak } from '@/game/streak';
import type { PauseWindow } from '@/game/calendar';

const NO_PAUSE: PauseWindow[] = [];

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

describe('updatePersistedStreak', () => {
  it('keeps streak and longest unchanged when today already has a log', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 5,
        currentLongestStreak: 12,
        lastLogDay: '2026-05-08',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 5, newLongestStreak: 12, newLastLogDay: '2026-05-08' });
  });

  it('increments when last log was yesterday (consecutive)', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 3,
        currentLongestStreak: 10,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 4, newLongestStreak: 10, newLastLogDay: '2026-05-08' });
  });

  it('updates longestStreak when newStreak exceeds the prior watermark', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 9,
        currentLongestStreak: 9,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 10, newLongestStreak: 10, newLastLogDay: '2026-05-08' });
  });

  it('does not lower longestStreak when current streak resets', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 10,
        currentLongestStreak: 15,
        lastLogDay: '2026-05-05',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 15, newLastLogDay: '2026-05-08' });
  });

  it('treats a paused gap as continuous (streak increments after 5 paused days)', () => {
    // Last log 05-01, today 05-07, pause 05-02 → 05-06 (does not overlap endpoints).
    // Calendar gap = 6, paused days in (05-01, 05-07] = 5, result = 1 → increment.
    expect(
      updatePersistedStreak({
        currentStreak: 8,
        currentLongestStreak: 8,
        lastLogDay: '2026-05-01',
        today: '2026-05-07',
        pauseWindows: [{ start: '2026-05-02', end: '2026-05-06' }],
      }),
    ).toEqual({ newStreak: 9, newLongestStreak: 9, newLastLogDay: '2026-05-07' });
  });

  it('increments across a full pause that overlaps lastLogDay (gap of 0)', () => {
    // Boundary case: user logs Mon (05-04), pauses Mon→Fri, logs Fri (05-08).
    // Calendar gap = 4, paused days in (05-04, 05-08] = {Tue,Wed,Thu,Fri} = 4 → result 0.
    // Engine treats 0 (with lastLogDay !== today) as "consecutive across pause" → increment.
    // newLastLogDay must update to today, NOT remain as lastLogDay.
    expect(
      updatePersistedStreak({
        currentStreak: 4,
        currentLongestStreak: 4,
        lastLogDay: '2026-05-04',
        today: '2026-05-08',
        pauseWindows: [{ start: '2026-05-04', end: '2026-05-08' }],
      }),
    ).toEqual({ newStreak: 5, newLongestStreak: 5, newLastLogDay: '2026-05-08' });
  });

  it('starts at 1 when there is no prior log (lastLogDay is null) and seeds longest', () => {
    expect(
      updatePersistedStreak({
        currentStreak: 0,
        currentLongestStreak: 0,
        lastLogDay: null,
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 1, newLastLogDay: '2026-05-08' });
  });

  it('resets after one missed non-paused day (calendar gap of 2)', () => {
    // Decay grace period does not extend the streak — even one missed day breaks it.
    // Here: lastLog 05-06, today 05-08, no pause. One day (05-07) was skipped between
    // logs. `nonPausedDaysBetween` returns 2 (calendar gap), engine resets.
    expect(
      updatePersistedStreak({
        currentStreak: 5,
        currentLongestStreak: 7,
        lastLogDay: '2026-05-06',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toEqual({ newStreak: 1, newLongestStreak: 7, newLastLogDay: '2026-05-08' });
  });
});

describe('displayedStreak', () => {
  it('returns stored when today equals lastLogDay (already logged today)', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-08',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(5);
  });
  it('returns stored when last log was yesterday non-paused (still in window)', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-07',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(5);
  });
  it('returns 0 when there is a non-paused gap of 2+ days', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-06',
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(0);
  });
  it('returns stored when the gap is fully paused', () => {
    expect(
      displayedStreak({
        stored: 5,
        lastLogDay: '2026-05-01',
        today: '2026-05-08',
        pauseWindows: [{ start: '2026-05-02', end: '2026-05-07' }],
      }),
    ).toBe(5);
  });
  it('returns 0 when lastLogDay is null', () => {
    expect(
      displayedStreak({
        stored: 0,
        lastLogDay: null,
        today: '2026-05-08',
        pauseWindows: NO_PAUSE,
      }),
    ).toBe(0);
  });
});
