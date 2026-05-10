import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

/**
 * Onboarding step 2 — confirms which AI engine the user is running and notes
 * the on-device privacy story. Reads runtime availability from
 * `aiAvailabilityStore`; if the probe says unavailable (rare, since store-level
 * device filtering covers the common case), the headline switches and the
 * Continue button is disabled until the user resolves the issue (typically by
 * re-enabling Apple Intelligence in iOS Settings — the top-of-screen banner
 * already exposes the deep link).
 */
export default function AIConfirmScreen() {
  const router = useRouter();
  const available = useAIAvailabilityStore((s) => s.available);
  const displayName = useAIAvailabilityStore((s) => s.displayName);

  const handleContinue = () => {
    if (!available) return;
    router.push('/onboarding/creation');
  };

  const engineLabel = available ? displayName : 'Apple Intelligence unavailable';
  const continueLabel = available ? 'Continue' : 'Resolve to continue';

  return (
    <View testID="ai-confirm-screen" className="flex-1 bg-bg px-6 pt-16">
      <View className="flex-1">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 28, lineHeight: 34 }}>
          AI Engine
        </Text>

        <Text
          testID="ai-confirm-engine"
          className={`mt-8 font-manrope-semibold ${available ? 'text-accent' : 'text-text-mute'}`}
          style={{ fontSize: 18 }}
        >
          {engineLabel}
        </Text>

        <Text
          testID="ai-confirm-privacy"
          className="mt-4 font-manrope text-text-mute"
          style={{ fontSize: 15, lineHeight: 22 }}
        >
          Your logs stay on your device. No data leaves your phone.
        </Text>
      </View>

      <View className="mb-12">
        <TouchableOpacity
          testID="ai-confirm-continue"
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: !available }}
          disabled={!available}
          onPress={handleContinue}
          className={`rounded-2xl py-4 ${available ? 'bg-accent' : 'bg-surface-2'}`}
        >
          <Text
            testID="ai-confirm-continue-label"
            className={`text-center font-manrope-bold ${available ? 'text-bg' : 'text-text-mute'}`}
            style={{ fontSize: 16 }}
          >
            {continueLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
