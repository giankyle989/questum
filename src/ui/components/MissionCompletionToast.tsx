import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface MissionCompletionToastProps {
  missionDescription: string;
  bonusXP: number;
  attribute: Attribute;
  onComplete: () => void;
}

const ENTER_MS = 200;
const HOLD_MS = 800;
const EXIT_MS = 200;
const REDUCED_MOTION_HOLD_MS = 800;

export function MissionCompletionToast({
  missionDescription,
  bonusXP,
  attribute,
  onComplete,
}: MissionCompletionToastProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(reducedMotion ? 0 : -100);

  useEffect(() => {
    haptics.success();
    if (!reducedMotion) {
      translateY.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    }
    const totalMs = reducedMotion ? REDUCED_MOTION_HOLD_MS : ENTER_MS + HOLD_MS + EXIT_MS;
    const exitTimer = reducedMotion
      ? null
      : setTimeout(() => {
          translateY.value = withTiming(-100, {
            duration: EXIT_MS,
            easing: Easing.in(Easing.cubic),
          });
        }, ENTER_MS + HOLD_MS);
    const completeTimer = setTimeout(onComplete, totalMs);
    return () => {
      if (exitTimer) clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, reducedMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Pressable
      testID="mission-completion-toast"
      onPress={onComplete}
      style={[styles.host, { paddingTop: insets.top + 8 }]}
      accessibilityRole="alert"
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={[styles.attrDot, { backgroundColor: ATTRIBUTE_COLORS[attribute] }]} />
        <Text style={styles.description} numberOfLines={1}>
          {missionDescription}
        </Text>
        <Text style={styles.bonus}>{`+${bonusXP} XP`}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F26',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  attrDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  description: {
    flex: 1,
    color: '#E6EDF3',
    fontSize: 14,
    fontWeight: '500',
  },
  bonus: {
    color: '#E8C547',
    fontSize: 13,
    fontWeight: '700',
  },
});
