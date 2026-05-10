import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTES, ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface XPGainRevealProps {
  gains: Partial<Record<Attribute, number>>;
  onComplete: () => void;
}

const REVEAL_MS = 900;
const REDUCED_MOTION_MS = 1;

/**
 * Floats "+N" numbers above the affected attribute bars during the reveal
 * window after a successful log submission. Uses absolute positioning at the
 * root so it can be mounted by the AnimationOrchestrator without knowing the
 * exact layout of the bars below — the user reads them as ambient feedback.
 */
export function XPGainReveal({ gains, onComplete }: XPGainRevealProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timeout = setTimeout(onComplete, reducedMotion ? REDUCED_MOTION_MS : REVEAL_MS + 100);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion]);

  if (reducedMotion) return null;

  const entries = ATTRIBUTES.flatMap((attr) => {
    const v = gains[attr];
    return v && v > 0 ? [{ attr, v }] : [];
  });

  return (
    <View pointerEvents="none" style={styles.host}>
      {entries.map(({ attr, v }, idx) => (
        <Float key={attr} attribute={attr} value={v} indexInList={idx} />
      ))}
    </View>
  );
}

interface FloatProps {
  attribute: Attribute;
  value: number;
  indexInList: number;
}

function Float({ attribute, value, indexInList }: FloatProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-24, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: REVEAL_MS, easing: Easing.in(Easing.cubic) });
  }, [translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      testID={`xp-reveal-${attribute}`}
      style={[
        styles.float,
        {
          color: ATTRIBUTE_COLORS[attribute],
          top: 80 + indexInList * 32,
        },
        animatedStyle,
      ]}
    >
      {`+${value}`}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  float: {
    position: 'absolute',
    right: 24,
    fontSize: 18,
    fontWeight: '700',
  },
});
