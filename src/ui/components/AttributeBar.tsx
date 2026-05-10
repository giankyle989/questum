import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
  /** XP needed to reach the next level. Caller computes via `xpToReachLevel(level + 1)`. */
  xpThreshold: number;
  /**
   * When true, render a shimmer overlay that loops a soft white gradient across
   * the bar to indicate decay applied earlier today.
   */
  decayedToday?: boolean;
}

const FILL_ANIMATION_MS = 600;
const SHIMMER_LOOP_MS = 2500;

export function AttributeBar({
  attribute,
  level,
  inProgressXp,
  xpThreshold,
  decayedToday = false,
}: AttributeBarProps) {
  const reducedMotion = useReducedMotion();

  const safeThreshold = xpThreshold > 0 ? xpThreshold : 1;
  const targetProgress = Math.min(Math.max(inProgressXp, 0) / safeThreshold, 1);
  const fillColor = ATTRIBUTE_COLORS[attribute];

  // Bar fill — animates width on `targetProgress` change.
  const progress = useSharedValue(targetProgress);
  useEffect(() => {
    if (reducedMotion) {
      progress.value = targetProgress;
      return;
    }
    progress.value = withTiming(targetProgress, {
      duration: FILL_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetProgress, reducedMotion, progress]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Shimmer — only animates when decayedToday and reduced-motion is off.
  const shimmerOffset = useSharedValue(0);
  useEffect(() => {
    if (!decayedToday || reducedMotion) {
      shimmerOffset.value = 0;
      return;
    }
    shimmerOffset.value = 0;
    shimmerOffset.value = withRepeat(
      withTiming(1, { duration: SHIMMER_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [decayedToday, reducedMotion, shimmerOffset]);

  const animatedShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmerOffset.value * 100}%` }],
  }));

  return (
    <View testID={`attribute-bar-${attribute}`} className="w-full">
      <View className="flex-row items-center justify-between">
        <Text className="font-manrope-semibold text-text" style={{ fontSize: 14 }}>
          {attribute}
        </Text>
        <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
          {`Lv ${level}`}
        </Text>
      </View>
      <View
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: safeThreshold,
          now: Math.min(inProgressXp, safeThreshold),
        }}
      >
        <Animated.View
          testID={`attribute-bar-fill-${attribute}`}
          className="h-full rounded-full"
          style={[
            {
              backgroundColor: fillColor,
              opacity: decayedToday ? 0.6 : 1,
            },
            animatedFillStyle,
          ]}
        />
        {decayedToday ? (
          <Animated.View
            testID={`attribute-bar-shimmer-${attribute}`}
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: '-50%',
                width: '50%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.25)',
              },
              animatedShimmerStyle,
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}
