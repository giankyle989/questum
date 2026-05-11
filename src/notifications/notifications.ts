import * as Notifications from 'expo-notifications';

import { dailyMorningCopy, inactivityNudgeCopy, parseHHMM } from '@/notifications/notificationCopy';

const ID_DAILY_MORNING = 'daily-morning';
const ID_INACTIVITY_NUDGE = 'inactivity-nudge';

export async function requestPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function getPermissionStatus(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function scheduleDailyMorning(morningTime: string): Promise<void> {
  const { hour, minute } = parseHHMM(morningTime);
  const { title, body } = dailyMorningCopy();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_DAILY_MORNING,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyMorning(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID_DAILY_MORNING);
}

export async function scheduleInactivityNudge(target: Date): Promise<void> {
  const { title, body } = inactivityNudgeCopy();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_INACTIVITY_NUDGE,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

export async function cancelInactivityNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID_INACTIVITY_NUDGE);
}

export async function cancelAll(): Promise<void> {
  await cancelDailyMorning();
  await cancelInactivityNudge();
}

/**
 * Dev-only: fires a daily-morning-style notification 5 seconds from now so the
 * developer can verify the flow without changing the system clock.
 */
export async function fireTestDaily(): Promise<void> {
  const { title, body } = dailyMorningCopy();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}

/** Dev-only: fires an inactivity-nudge-style notification 5 seconds from now. */
export async function fireTestNudge(): Promise<void> {
  const { title, body } = inactivityNudgeCopy();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}
