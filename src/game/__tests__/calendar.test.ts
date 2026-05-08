import {
  addDays,
  daysBetween,
  nonPausedDaysBetween,
  type ISODate,
  type PauseWindow,
} from '@/game/calendar';

describe('daysBetween', () => {
  it('returns 0 when the two dates are identical', () => {
    expect(daysBetween('2026-05-08', '2026-05-08')).toBe(0);
  });

  it('returns the positive difference for later second arg', () => {
    expect(daysBetween('2026-05-08', '2026-05-10')).toBe(2);
  });

  it('returns a negative difference for earlier second arg', () => {
    expect(daysBetween('2026-05-10', '2026-05-08')).toBe(-2);
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2026-05-31', '2026-06-01')).toBe(1);
  });

  it('handles year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('handles leap-year February', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });
});

describe('addDays', () => {
  it('returns the same date when adding zero', () => {
    expect(addDays('2026-05-08', 0)).toBe('2026-05-08');
  });

  it('adds positive days within the same month', () => {
    expect(addDays('2026-05-08', 3)).toBe('2026-05-11');
  });

  it('subtracts when given a negative offset', () => {
    expect(addDays('2026-05-08', -3)).toBe('2026-05-05');
  });

  it('rolls forward across a month boundary', () => {
    expect(addDays('2026-05-30', 3)).toBe('2026-06-02');
  });

  it('rolls forward across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap-year February correctly', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('zero-pads months and days', () => {
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
    expect(addDays('2026-09-09', 1)).toBe('2026-09-10');
  });
});

describe('nonPausedDaysBetween', () => {
  const NO_PAUSE: PauseWindow[] = [];

  it('matches daysBetween when no pause windows exist', () => {
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-08', NO_PAUSE)).toBe(7);
  });

  it('returns 0 when start equals end', () => {
    expect(nonPausedDaysBetween('2026-05-08', '2026-05-08', NO_PAUSE)).toBe(0);
  });

  it('subtracts a fully-contained closed pause window', () => {
    // 2026-05-01 → 2026-05-10: 9 days. Pause 03→05 inclusive: 3 days. Result 6.
    const windows: PauseWindow[] = [{ start: '2026-05-03', end: '2026-05-05' }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(6);
  });

  it('subtracts an open-ended pause window up to the end date', () => {
    // 2026-05-01 → 2026-05-10: 9 days. Open pause from 05-07: covers 07,08,09,10 = 4 days. Result 5.
    const windows: PauseWindow[] = [{ start: '2026-05-07', end: null }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(5);
  });

  it('clips a pause window that starts before the range', () => {
    // Range 05-05 (excl) → 05-10 (incl) = 5 days in (start, end].
    // Pause 05-01 → 05-07 clipped to (05-05, 05-10] is 06 and 07 = 2 days. Result 3.
    const windows: PauseWindow[] = [{ start: '2026-05-01', end: '2026-05-07' }];
    expect(nonPausedDaysBetween('2026-05-05', '2026-05-10', windows)).toBe(3);
  });

  it('does NOT count a pause day overlapping `start` (the last log day)', () => {
    // start = 2026-05-01 (lastLogDay), end = 2026-05-05 (today). Pause 05-01 → 05-01.
    // The day OF the last log is excluded from the "between" range, so this pause
    // contributes 0 paused days. Total = 4, paused = 0, result = 4.
    const windows: PauseWindow[] = [{ start: '2026-05-01', end: '2026-05-01' }];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-05', windows)).toBe(4);
  });

  it('correctly bridges a full pause from the lastLogDay to today (gap of 0)', () => {
    // Streak boundary case: user logs Mon, pauses Mon→Fri, logs again Fri.
    // Days strictly after Mon and on/before Fri = {Tue, Wed, Thu, Fri} = 4.
    // All 4 are paused (Mon excluded from clip). Result = 0.
    // Streak engine reads 0 → consecutive across pause → increments.
    const windows: PauseWindow[] = [{ start: '2026-05-04', end: '2026-05-08' }];
    expect(nonPausedDaysBetween('2026-05-04', '2026-05-08', windows)).toBe(0);
  });

  it('counts a pause day overlapping `end` (today) the normal way', () => {
    // start = 2026-05-04, end = 2026-05-08. Pause 05-06 → 05-08 includes today.
    // Days in (Mon, Fri] = {Tue, Wed, Thu, Fri} = 4 calendar days. Paused: Wed, Thu, Fri = 3.
    // Result = 4 - 3 = 1.
    const windows: PauseWindow[] = [{ start: '2026-05-06', end: '2026-05-08' }];
    expect(nonPausedDaysBetween('2026-05-04', '2026-05-08', windows)).toBe(1);
  });

  it('handles multiple non-overlapping pause windows', () => {
    // Range 01 → 20 = 19. Pause 03–05 (3) + 10–12 (3) = 6. Result 13.
    const windows: PauseWindow[] = [
      { start: '2026-05-03', end: '2026-05-05' },
      { start: '2026-05-10', end: '2026-05-12' },
    ];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-20', windows)).toBe(13);
  });

  it('deduplicates overlapping pause windows (no double-subtract)', () => {
    // Range 01 → 10 = 9. Two overlapping windows 03-06 (4) and 05-08 (4) → union 03-08 (6). Result 3.
    const windows: PauseWindow[] = [
      { start: '2026-05-03', end: '2026-05-06' },
      { start: '2026-05-05', end: '2026-05-08' },
    ];
    expect(nonPausedDaysBetween('2026-05-01', '2026-05-10', windows)).toBe(3);
  });

  it('treats negative ranges as zero (no negative days when end < start)', () => {
    expect(nonPausedDaysBetween('2026-05-10', '2026-05-08', NO_PAUSE)).toBe(0);
  });
});

// Compile-time guard: ISODate must be exported and assignable from a string literal.
const _isoDateGuard: ISODate = '2026-05-08';
void _isoDateGuard;
