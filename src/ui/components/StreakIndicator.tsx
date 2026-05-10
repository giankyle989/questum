import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface StreakIndicatorProps {
  streakDays: number;
}

const PULSE_HALF_MS = 90;

/**
 * Tiny presentational streak indicator: flame emoji + day count. The flame
 * pulses (scale 1 → 1.2 → 1) whenever `streakDays` changes — gives the user
 * a small confirmation moment when their streak ticks over. Returns `null`
 * when `streakDays` is 0 so callers don't have to gate it.
 */
export function StreakIndicator({ streakDays }: StreakIndicatorProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(1.2, { duration: PULSE_HALF_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.in(Easing.cubic) }),
    );
  }, [streakDays, reducedMotion, scale]);

  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (streakDays === 0) {
    return null;
  }

  const label = `${streakDays} day${streakDays !== 1 ? 's' : ''}`;

  return (
    <View testID="streak-indicator" className="flex-row items-center gap-1">
      <Animated.Text style={[{ fontSize: 14 }, animatedFlameStyle]}>{'\u{1F525}'}</Animated.Text>
      <Text className="font-manrope-medium text-text" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}
