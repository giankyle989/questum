import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<void>): void {
  if (!isHapticPlatform) return;
  void fn().catch(() => {
    // Haptics failures are silent — the user's experience is the haptic itself,
    // and a missing haptic should never throw an error to higher layers.
  });
}

/**
 * Small surface for the four haptic moments the app uses. Each call is
 * fire-and-forget — the wrapper never throws, and platforms that don't
 * support haptics (web, future platforms) are no-ops.
 */
export const haptics = {
  /** Light tap — FAB press, button presses. */
  tap: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium impact — log submit success. */
  submit: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Heavy impact — level-up moment. */
  levelUp: (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Success notification — mission completion, streak milestone. */
  success: (): void =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
