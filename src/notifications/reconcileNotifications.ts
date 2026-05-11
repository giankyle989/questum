import type { ISODate } from '@/game/calendar';
import { parseHHMM } from '@/notifications/notificationCopy';
import {
  cancelDailyMorning,
  cancelInactivityNudge,
  scheduleDailyMorning,
  scheduleInactivityNudge,
} from '@/notifications/notifications';

export interface ReconcileInput {
  notificationsEnabled: boolean;
  inactivityNudgeEnabled: boolean;
  /** "HH:MM" format. */
  morningTime: string;
  lastLogDay: ISODate | null;
  permissionGranted: boolean;
}

/**
 * Brings the OS notification schedule into alignment with the current settings.
 *
 * Always cancels both notifications first, then re-schedules whichever should
 * exist. This is wasteful in the no-change case (one extra cancel each), but
 * the simplicity is worth it — there's no cheap way to inspect existing
 * scheduled triggers, so we treat each call as authoritative.
 *
 * Pure-ish: every external effect is mocked at the `notifications` boundary.
 */
export async function reconcileNotifications(input: ReconcileInput): Promise<void> {
  // No permission OR master toggle off → cancel everything.
  if (!input.permissionGranted || !input.notificationsEnabled) {
    await cancelDailyMorning();
    await cancelInactivityNudge();
    return;
  }

  // Daily morning: always cancel + reschedule.
  await cancelDailyMorning();
  await scheduleDailyMorning(input.morningTime);

  // Inactivity nudge: only when enabled AND we have a lastLogDay.
  await cancelInactivityNudge();
  if (!input.inactivityNudgeEnabled || input.lastLogDay === null) {
    return;
  }

  const target = computeInactivityTarget(input.lastLogDay, input.morningTime);
  if (target.getTime() <= Date.now()) {
    // Stale target — don't fire a notification for a date already past.
    return;
  }

  await scheduleInactivityNudge(target);
}

/**
 * Computes the Date at which the inactivity nudge should fire:
 * `lastLogDay + 3 calendar days` at `morningTime` in device local TZ.
 */
function computeInactivityTarget(lastLogDay: ISODate, morningTime: string): Date {
  const { hour, minute } = parseHHMM(morningTime);
  const [yStr, mStr, dStr] = lastLogDay.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1; // 0-indexed
  const day = Number(dStr);
  return new Date(year, month, day + 3, hour, minute, 0, 0);
}
