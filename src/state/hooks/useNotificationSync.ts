import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getPermissionStatus } from '@/notifications/notifications';
import { reconcileNotifications } from '@/notifications/reconcileNotifications';
import { useLogsStore } from '@/state/logsStore';
import { useSettingsStore } from '@/state/settingsStore';
import { getDb } from '@/storage/db';
import * as logRepo from '@/storage/repositories/logRepo';

/**
 * Mounted once in the root layout. Keeps the OS notification schedule aligned
 * with the current settings store + last-log-day state. Re-runs on:
 *   - mount (after settings hydrate)
 *   - any change to the four settings fields the reconciler cares about
 *   - logsStore.lastSubmitResult change (proxy for "log just landed")
 *   - AppState transition to 'active' (catches OS-level permission revocation)
 *
 * The hook never throws — reconcileNotifications absorbs notification errors
 * silently via the wrapper layer.
 */
export function useNotificationSync(): void {
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const inactivityNudgeEnabled = useSettingsStore((s) => s.inactivityNudgeEnabled);
  const morningTime = useSettingsStore((s) => s.notificationMorningTime);
  const lastSubmitResult = useLogsStore((s) => s.lastSubmitResult);

  const sync = useCallback(async () => {
    const db = await getDb();
    const lastLogDay = await logRepo.getLastLogDay(db);
    const permissionGranted = await getPermissionStatus();
    await reconcileNotifications({
      notificationsEnabled,
      inactivityNudgeEnabled,
      morningTime,
      lastLogDay,
      permissionGranted,
    });
  }, [notificationsEnabled, inactivityNudgeEnabled, morningTime]);

  useEffect(() => {
    void sync();
  }, [sync, lastSubmitResult]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void sync();
      }
    });
    return () => subscription.remove();
  }, [sync]);
}
