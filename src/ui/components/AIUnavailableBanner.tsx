import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Top-anchored banner that appears when the on-device AI probe reports
 * unavailable. Reads `available` from `aiAvailabilityStore` and renders nothing
 * when AI is reachable. Tapping "Open Settings" dispatches to the OS app
 * settings page via `expo-linking`.
 *
 * Mounted once at the root layout (`app/_layout.tsx`) so it sits above both
 * onboarding and `(main)` route groups without per-screen wiring.
 */
export function AIUnavailableBanner(): React.JSX.Element | null {
  const available = useAIAvailabilityStore((s) => s.available);
  const insets = useSafeAreaInsets();

  if (available) return null;

  const handleOpenSettings = () => {
    void Linking.openSettings();
  };

  return (
    <View
      testID="ai-unavailable-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ paddingTop: insets.top }}
      className="bg-amber-900/40 border-b border-amber-700/60"
    >
      <View className="flex-row items-start gap-3 px-4 py-3">
        <View className="flex-1">
          <Text
            testID="ai-unavailable-banner-title"
            className="font-manrope-bold text-accent"
            style={{ fontSize: 13, lineHeight: 17 }}
          >
            On-device AI is currently unavailable
          </Text>
          <Text
            testID="ai-unavailable-banner-body"
            className="mt-0.5 font-manrope text-text"
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            Enable Apple Intelligence in Settings to log activities.
          </Text>
        </View>
        <TouchableOpacity
          testID="ai-unavailable-banner-open-settings"
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          onPress={handleOpenSettings}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text className="font-manrope-bold text-accent" style={{ fontSize: 13 }}>
            Open Settings →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
