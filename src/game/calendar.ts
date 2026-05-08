/**
 * ISO date string in 'YYYY-MM-DD' form (device-local calendar day).
 * All game-engine functions that take a "day" expect this format.
 */
export type ISODate = string;

const MS_PER_DAY = 86_400_000;

/**
 * Calendar-day difference: `b - a`. Positive when `b` is later. Treats the
 * date as a UTC midnight to avoid DST drift; do not use this with timestamps.
 */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = parseParts(a);
  const [by, bm, bd] = parseParts(b);
  const aMs = Date.UTC(ay, am, ad);
  const bMs = Date.UTC(by, bm, bd);
  return Math.round((bMs - aMs) / MS_PER_DAY);
}

/**
 * Returns `date` shifted by `delta` calendar days (negative shifts backward).
 * UTC-based to avoid DST drift, mirroring `daysBetween`.
 */
export function addDays(date: ISODate, delta: number): ISODate {
  const [y, m, d] = parseParts(date);
  const ms = Date.UTC(y, m, d) + delta * MS_PER_DAY;
  const out = new Date(ms);
  const yyyy = String(out.getUTCFullYear()).padStart(4, '0');
  const mm = String(out.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(out.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseParts(d: ISODate): [number, number, number] {
  const [yStr, mStr, dStr] = d.split('-');
  return [Number(yStr), Number(mStr) - 1, Number(dStr)];
}

export interface PauseWindow {
  start: ISODate;
  /** null means "still paused; window extends to the calculation end date". */
  end: ISODate | null;
}

/**
 * Count of calendar days from `start` (exclusive) to `end` (inclusive) minus
 * any days falling inside any pause window. Pause windows are clipped to
 * `(start, end]` — a pause day on `start` itself does not count, because the
 * function counts non-paused days *between* start and end (the spec's
 * "exclusive of both" semantics in `GAME_RULES.md`). Overlapping windows are
 * merged. Returns 0 if `end` precedes `start`.
 */
export function nonPausedDaysBetween(start: ISODate, end: ISODate, windows: PauseWindow[]): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 0;

  // Clip pause windows to (start, end] by shifting the lower bound forward 1 day.
  // mergeWindows clips to [clipFrom, end] internally and filters degenerate windows,
  // so each `merged` entry already has start >= clipFrom and end <= `end`.
  const clipFrom = addDays(start, 1);
  const merged = mergeWindows(windows, clipFrom, end);
  let pausedDayCount = 0;
  for (const window of merged) {
    pausedDayCount += daysBetween(window.start, window.end) + 1;
  }

  return Math.max(0, total - pausedDayCount);
}

function mergeWindows(
  windows: PauseWindow[],
  rangeStart: ISODate,
  rangeEnd: ISODate,
): { start: ISODate; end: ISODate }[] {
  const normalized = windows
    .map((w) => ({
      start: laterDate(w.start, rangeStart),
      end: earlierDate(w.end ?? rangeEnd, rangeEnd),
    }))
    // Drop windows that don't overlap [rangeStart, rangeEnd] at all.
    .filter((w) => daysBetween(w.start, w.end) >= 0)
    // Sort ascending by start date: daysBetween(b.start, a.start) is `a - b` in days,
    // negative when a is earlier, which puts a before b.
    .sort((a, b) => daysBetween(b.start, a.start));

  const out: { start: ISODate; end: ISODate }[] = [];
  for (const window of normalized) {
    const last = out[out.length - 1];
    // Merge adjacent windows: 0 days apart (overlap) OR exactly 1 day apart
    // (back-to-back on calendar) are treated as one continuous pause.
    if (last && daysBetween(last.end, window.start) <= 1) {
      last.end = laterDate(last.end, window.end);
    } else {
      out.push({ ...window });
    }
  }
  return out;
}

function laterDate(a: ISODate, b: ISODate): ISODate {
  return daysBetween(a, b) >= 0 ? b : a;
}

function earlierDate(a: ISODate, b: ISODate): ISODate {
  return daysBetween(a, b) <= 0 ? b : a;
}
