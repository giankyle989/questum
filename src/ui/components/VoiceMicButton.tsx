import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import type { VoiceErrorReason, VoiceStatus } from '@/state/hooks/useVoiceInput';

export interface VoiceMicButtonProps {
  status: VoiceStatus;
  errorReason: VoiceErrorReason | null;
  disabled?: boolean | undefined;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

const ICON_SIZE = 22;
const COLOR_MUTE = '#7a7d8a';
const COLOR_ACCENT = '#E8C547';
const DISABLED_OPACITY = 0.4;

/**
 * Presentational mic toggle for the LogEntryScreen voice-input flow.
 * Reads its visual state from props — the parent owns the
 * `useVoiceInput` hook. Permission denial is handled in-place via
 * Alert + Linking.openSettings (the only path through this component
 * that is not a straight handler dispatch).
 */
export function VoiceMicButton({
  status,
  errorReason,
  disabled,
  onStart,
  onStop,
  onOpenSettings,
}: VoiceMicButtonProps) {
  const isListening = status === 'listening';
  const isPermissionDenied = status === 'error' && errorReason === 'permission-denied';

  const handlePress = () => {
    if (disabled) return;
    if (isPermissionDenied) {
      Alert.alert(
        'Microphone access needed',
        'Questum needs microphone and speech recognition access to dictate your log. Open Settings to enable them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              onOpenSettings();
            },
          },
        ],
      );
      return;
    }
    if (isListening) {
      onStop();
      return;
    }
    onStart();
  };

  const iconName = isListening ? 'stop' : isPermissionDenied ? 'mic-off-outline' : 'mic-outline';
  const iconColor = isListening ? COLOR_ACCENT : COLOR_MUTE;
  const opacity = disabled ? DISABLED_OPACITY : 1;

  const accessibilityLabel = isListening ? 'Stop voice input' : 'Start voice input';

  return (
    <TouchableOpacity
      testID="voice-mic-button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: isListening }}
      onPress={handlePress}
      style={[styles.button, { opacity }]}
      hitSlop={8}
    >
      <Ionicons name={iconName} size={ICON_SIZE} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
