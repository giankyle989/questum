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
