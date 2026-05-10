import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface LevelUpOverlayProps {
  attribute: Attribute;
  newLevel: number;
  onComplete: () => void;
}

const ENTER_MS = 250;
const HOLD_MS = 1000;
const EXIT_MS = 250;
const REDUCED_MOTION_HOLD_MS = 800;

/**
 * Full-screen celebration overlay rendered for ~1.5s when an attribute levels
 * up. The orchestrator queues one of these per LevelUp from a successful log.
 * Tap anywhere to dismiss early and advance the queue.
 */
export function LevelUpOverlay({ attribute, newLevel, onComplete }: LevelUpOverlayProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    haptics.levelUp();
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : ENTER_MS + HOLD_MS + EXIT_MS;
    const timeout = setTimeout(onComplete, totalMs);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion]);

  const scale = useSharedValue(reducedMotion ? 1 : 0.5);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    scale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 140 }),
      withTiming(1, { duration: 120 }),
    );
  }, [reducedMotion, scale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      testID="level-up-overlay"
      onPress={onComplete}
      style={StyleSheet.absoluteFill}
      accessibilityRole="alert"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: ATTRIBUTE_COLORS[attribute] },
            animatedIconStyle,
          ]}
        >
          <Text style={styles.iconText}>{attribute}</Text>
        </Animated.View>
        <Text style={styles.levelText}>{`Lv ${newLevel}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(14, 17, 22, 0.85)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#0E1116',
    fontSize: 36,
    fontWeight: '800',
  },
  levelText: {
    color: '#E8C547',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
  },
});
