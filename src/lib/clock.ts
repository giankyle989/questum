import type { ISODate } from '@/game/calendar';

/**
 * Returns the device-local calendar date as YYYY-MM-DD.
 * ALL calendar-day Date->ISODate conversions in app code go through this function.
 * Uses local-time getters (getFullYear/getMonth/getDate), NOT toISOString()
 * which returns UTC and gives the wrong date near midnight west of UTC.
 */
export function todayLocalISODate(now: Date = new Date()): ISODate {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the local calendar date N days before `now` as YYYY-MM-DD.
 * Use this instead of raw `new Date(Date.now() - n * 86_400_000).toISOString().slice(0,10)`.
 * Correctly handles DST and year boundaries.
 *
 * DST note: subtracting n * 86_400_000 ms is approximate around DST transitions
 * (a 23h or 25h day is possible). For the only current consumer — missionsStore's
 * 30-day `recentlyCompleted` window — a one-day drift is harmless. If a future
 * caller needs an exact day-count, construct the date in local time directly
 * instead of relying on this function.
 */
export function daysAgoLocalISODate(n: number, now: Date = new Date()): ISODate {
  const past = new Date(now.getTime() - n * 86_400_000);
  return todayLocalISODate(past);
}
