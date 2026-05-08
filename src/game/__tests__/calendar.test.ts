import { addDays, daysBetween, type ISODate } from '@/game/calendar';

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

// Compile-time guard: ISODate must be exported and assignable from a string literal.
const _isoDateGuard: ISODate = '2026-05-08';
void _isoDateGuard;
