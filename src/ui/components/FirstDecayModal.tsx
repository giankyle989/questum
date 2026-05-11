import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

export interface FirstDecayModalProps {
  onDismiss: () => void;
}

const ENTER_MS = 200;

/**
 * One-time explainer shown the first time decay reduces a user's in-progress
 * XP. Rendered by CharacterSheetScreen when `firstDecayShown=false` and
 * `decayedAttributesToday.length > 0`. Dismissed only via the explicit "Got it"
 * button — the backdrop is not tap-to-dismiss because this is informational
 * onboarding, not an interruption.
 */
export function FirstDecayModal({ onDismiss }: FirstDecayModalProps) {
  const reducedMotion = useReducedMotion();

  const iconScale = useSharedValue(reducedMotion ? 1 : 0.5);
  const backdropOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
    iconScale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 140 }),
      withTiming(1, { duration: 120 }),
    );
  }, [reducedMotion, iconScale, backdropOpacity]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <Pressable
      testID="first-decay-modal"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Animated.Text style={[styles.icon, animatedIconStyle]}>{'⏳'}</Animated.Text>
          <Text style={styles.title}>Your XP just decayed.</Text>
          <Text style={styles.body}>
            Inactive days slowly drain your in-progress XP — never your level. Log something today
            to stop it.
          </Text>
          <TouchableOpacity
            testID="first-decay-modal-dismiss"
            accessibilityRole="button"
            accessibilityLabel="Got it"
            onPress={onDismiss}
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>Got it</Text>
          </TouchableOpacity>
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
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1F26',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  icon: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  body: {
    color: '#9AA4AE',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#E8C547',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#0E1116',
    fontSize: 16,
    fontWeight: '800',
  },
});
