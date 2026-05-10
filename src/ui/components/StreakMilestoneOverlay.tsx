import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface StreakMilestoneOverlayProps {
  threshold: 3 | 7 | 30;
  multiplier: number;
  onComplete: () => void;
}

const TOTAL_MS = 1500;
const REDUCED_MOTION_HOLD_MS = 800;

export function StreakMilestoneOverlay({
  threshold,
  multiplier,
  onComplete,
}: StreakMilestoneOverlayProps) {
  const reducedMotion = useReducedMotion();
  const flameScale = useSharedValue(reducedMotion ? 1 : 0.6);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    haptics.success();
    if (!reducedMotion) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      flameScale.value = withSequence(
        withSpring(1.2, { damping: 6, stiffness: 140 }),
        withTiming(1, { duration: 120 }),
      );
    }
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : TOTAL_MS;
    const timeout = setTimeout(onComplete, totalMs);
    return () => clearTimeout(timeout);
  }, [onComplete, reducedMotion, flameScale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  const multiplierText = `Streak multiplier now ${multiplier.toFixed(2)}×`;

  return (
    <Pressable
      testID="streak-milestone-overlay"
      onPress={onComplete}
      style={StyleSheet.absoluteFill}
      accessibilityRole="alert"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Animated.Text style={[styles.flame, animatedFlameStyle]}>{'\u{1F525}'}</Animated.Text>
          <Text style={styles.title}>{`${threshold}-day streak!`}</Text>
          <Text style={styles.subtitle}>{multiplierText}</Text>
        </View>
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
  card: {
    backgroundColor: '#1A1F26',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 260,
  },
  flame: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9AA4AE',
    fontSize: 14,
    marginTop: 6,
  },
});
