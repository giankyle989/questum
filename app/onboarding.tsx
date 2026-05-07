import { Text, View } from 'react-native';

export default function Onboarding() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Onboarding
      </Text>
      <Text className="font-manrope text-text-mute" style={{ fontSize: 12, marginTop: 6 }}>
        Phase 3 will replace this with the pitch + character creation.
      </Text>
    </View>
  );
}
