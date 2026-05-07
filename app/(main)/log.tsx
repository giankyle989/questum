import { Text, View } from 'react-native';

export default function Log() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
        Log Entry
      </Text>
    </View>
  );
}
