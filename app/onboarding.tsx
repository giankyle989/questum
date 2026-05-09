import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCharacterStore } from '@/state/characterStore';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Phase 3 placeholder. Slice 5 will replace this with the real pitch +
 * character creation flow. The "Dev: skip onboarding" button is temporary
 * scaffolding so Slice 1 (main app surface) is reachable on iPhone before
 * Slice 5 lands. Remove this entire file when Task 5.x ships.
 */
export default function Onboarding() {
  const router = useRouter();
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const character = useCharacterStore((s) => s.character);

  async function handleSkip() {
    if (!character) {
      await createCharacter('Dev', 'avatar_1');
    }
    await setOnboardingComplete(true);
    router.replace('/(main)/character');
  }

  return (
    <View className="flex-1 items-center justify-center bg-bg" style={{ padding: 24 }}>
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Onboarding
      </Text>
      <Text
        className="font-manrope text-text-mute"
        style={{ fontSize: 12, marginTop: 6, textAlign: 'center' }}
      >
        Slice 5 will replace this with the pitch + character creation.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={handleSkip}
        style={{
          marginTop: 32,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 8,
          backgroundColor: '#3B82F6',
        }}
      >
        <Text className="font-manrope-bold" style={{ fontSize: 14, color: 'white' }}>
          Dev: skip onboarding
        </Text>
      </Pressable>
      <Text
        className="font-manrope text-text-mute"
        style={{ fontSize: 11, marginTop: 12, textAlign: 'center', opacity: 0.7 }}
      >
        Creates a placeholder character and routes to the main app.{'\n'}
        Removed when real onboarding ships in Slice 5.
      </Text>
    </View>
  );
}
