import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Onboarding step 2 — confirms which AI engine the user is running and notes
 * the on-device privacy story. Phase 3 always shows "Mock (development)";
 * Phase 5 swaps in the real engine name (Apple Intelligence / Gemini Nano)
 * via a probe wired into the AIService factory.
 */
export default function AIConfirmScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/onboarding/creation');
  };

  return (
    <View testID="ai-confirm-screen" className="flex-1 bg-bg px-6 pt-16">
      <View className="flex-1">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 28, lineHeight: 34 }}>
          AI Engine
        </Text>

        <Text
          testID="ai-confirm-engine"
          className="mt-8 font-manrope-semibold text-accent"
          style={{ fontSize: 18 }}
        >
          Mock (development)
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
          accessibilityLabel="Continue"
          onPress={handleContinue}
          className="rounded-2xl bg-accent py-4"
        >
          <Text className="text-center font-manrope-bold text-bg" style={{ fontSize: 16 }}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
