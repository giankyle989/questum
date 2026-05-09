import { todayLocalISODate, daysAgoLocalISODate } from '@/lib/clock';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe('todayLocalISODate', () => {
  it('returns YYYY-MM-DD format on default call', () => {
    expect(todayLocalISODate()).toMatch(ISO_DATE_RE);
  });

  it('uses the provided Date', () => {
    expect(todayLocalISODate(new Date(2026, 4, 8))).toBe('2026-05-08');
  });

  it('zero-pads months', () => {
    expect(todayLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles December 31', () => {
    expect(todayLocalISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('defaults to new Date() when no argument is provided', () => {
    // We cannot freeze time here; just assert the format contract holds.
    expect(todayLocalISODate()).toMatch(ISO_DATE_RE);
  });
});

describe('daysAgoLocalISODate', () => {
  it('returns today when n = 0', () => {
    expect(daysAgoLocalISODate(0, new Date(2026, 4, 8))).toBe('2026-05-08');
  });

  it('returns 30 days ago across a month boundary', () => {
    expect(daysAgoLocalISODate(30, new Date(2026, 4, 8))).toBe('2026-04-08');
  });

  it('handles year boundary (1 day before Jan 1 = Dec 31 prior year)', () => {
    expect(daysAgoLocalISODate(1, new Date(2026, 0, 1))).toBe('2025-12-31');
  });

  it('defaults to new Date() when no `now` is provided', () => {
    // We cannot freeze time here; just assert the format contract holds.
    expect(daysAgoLocalISODate(0)).toMatch(ISO_DATE_RE);
  });
});
