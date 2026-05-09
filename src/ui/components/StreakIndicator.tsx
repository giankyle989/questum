import { Text, View } from 'react-native';

export interface StreakIndicatorProps {
  streakDays: number;
}

/**
 * Tiny presentational streak indicator: flame emoji + day count.
 * Returns `null` when `streakDays` is 0 so callers don't have to gate it.
 */
export function StreakIndicator({ streakDays }: StreakIndicatorProps) {
  if (streakDays === 0) {
    return null;
  }

  const label = `${streakDays} day${streakDays !== 1 ? 's' : ''}`;

  return (
    <View testID="streak-indicator" className="flex-row items-center gap-1">
      <Text style={{ fontSize: 14 }}>{'\u{1F525}'}</Text>
      <Text className="font-manrope-medium text-text" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}
