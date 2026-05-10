import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useLogsStore } from '@/state/logsStore';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Final onboarding step — same submit pipeline as `LogEntryScreen`, with
 * onboarding-specific copy and a different terminal action: on success, mark
 * onboarding complete and `replace` the navigator with the main app so the
 * user can't back-swipe into the pitch flow.
 *
 * Inline message rules match `LogEntryScreen`:
 *   - Low-confidence: keep the input, do NOT complete onboarding.
 *   - Storage / unknown errors: keep the input, do NOT complete onboarding.
 *   - Clean success (`submitting` true → false, no error, no low-confidence)
 *     fires `setOnboardingComplete(true)` then `router.replace`.
 *
 * Falling-edge detection uses a `useRef` so re-renders triggered by typing
 * don't double-fire the success effect. Same pattern as LogEntryScreen.
 */
export default function FirstLogScreen() {
  const router = useRouter();
  const submitting = useLogsStore((s) => s.submitting);
  const lowConfidence = useLogsStore((s) => s.lowConfidence);
  const error = useLogsStore((s) => s.error);
  const errorDetail = useLogsStore((s) => s.errorDetail);
  const submitLog = useLogsStore((s) => s.submitLog);

  const [text, setText] = useState('');

  const prevSubmittingRef = useRef(submitting);
  useEffect(() => {
    if (prevSubmittingRef.current && !submitting && !lowConfidence && error === null) {
      void (async () => {
        await useSettingsStore.getState().setOnboardingComplete(true);
        router.replace('/(main)/character');
      })();
    }
    prevSubmittingRef.current = submitting;
  }, [submitting, lowConfidence, error, router]);

  const trimmed = text.trim();
  const submitDisabled = trimmed === '' || submitting;

  const handleSubmit = () => {
    if (submitDisabled) return;
    void submitLog(text);
  };

  return (
    <KeyboardAvoidingView
      testID="first-log-screen"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-bg"
    >
      <View className="flex-1 px-6 pt-16">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 28, lineHeight: 34 }}>
          First Log
        </Text>
        <Text className="mt-3 font-manrope text-text-mute" style={{ fontSize: 15, lineHeight: 22 }}>
          Tell us one thing you did today to get started.
        </Text>

        <TextInput
          testID="first-log-text-input"
          accessibilityLabel="First log text"
          autoFocus
          multiline
          editable={!submitting}
          placeholder="Tell us one thing you did today to get started."
          placeholderTextColor="#7a7d8a"
          value={text}
          onChangeText={setText}
          className="mt-8 min-h-[160px] rounded-2xl bg-surface-2 p-4 font-manrope text-text"
          style={{ fontSize: 17, lineHeight: 24, textAlignVertical: 'top' }}
        />

        <View className="mt-4">
          {lowConfidence ? (
            <Text
              testID="first-log-message-low-confidence"
              className="font-manrope text-text-mute"
              style={{ fontSize: 14 }}
            >
              We couldn&apos;t categorize that confidently — try a more specific log.
            </Text>
          ) : error === 'storage-error' ? (
            <Text
              testID="first-log-message-storage-error"
              className="font-manrope text-text-mute"
              style={{ fontSize: 14 }}
            >
              Couldn&apos;t save your log. Try again.
            </Text>
          ) : error === 'unknown' ? (
            <Text
              testID="first-log-message-unknown-error"
              className="font-manrope text-text-mute"
              style={{ fontSize: 14 }}
            >
              Something went wrong, try again.
            </Text>
          ) : null}

          {__DEV__ && error !== null && errorDetail !== null ? (
            <Text
              testID="first-log-message-dev-detail"
              selectable
              className="font-manrope text-text-mute"
              style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}
            >
              DEV: {errorDetail}
            </Text>
          ) : null}
        </View>

        <View className="flex-1" />

        <View className="mb-12">
          <TouchableOpacity
            testID="first-log-submit"
            accessibilityRole="button"
            accessibilityLabel="Submit first log"
            accessibilityState={{ disabled: submitDisabled }}
            disabled={submitDisabled}
            onPress={handleSubmit}
            className="rounded-2xl py-4"
            style={{ backgroundColor: submitDisabled ? '#2A2F36' : '#E8C547' }}
          >
            <Text
              className="text-center font-manrope-bold"
              style={{ fontSize: 16, color: submitDisabled ? '#7D8590' : '#0E1116' }}
            >
              {submitting ? 'Reading…' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
