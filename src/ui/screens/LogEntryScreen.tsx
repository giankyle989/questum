import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { haptics } from '@/lib/haptics';
import { useLogsStore } from '@/state/logsStore';

/**
 * Modal sheet for the user-typed-log flow. Reads `submitting`, `lowConfidence`,
 * and `error` from the logs store, owns the input text locally, and forwards
 * `submitLog`/`cancelSubmit` to the store.
 *
 * Inline message rules (per UI_SPEC §LogEntryScreen):
 * - Low-confidence is a soft state — the input text is preserved so the user
 *   can edit and retry, and we do NOT clear the field.
 * - Storage / unknown errors show inline guidance; the input text is preserved.
 * - On clean success (submitting transitions true → false with no error and no
 *   low-confidence flag), the input is cleared. Tracked via a ref so we only
 *   react to the falling edge of `submitting`.
 *
 * XP-reveal animation, level-up modal, and auto-close are wired in Phase 4.
 * Slice 1 scope keeps this screen to the input → submit → inline-result loop.
 */
export default function LogEntryScreen() {
  const router = useRouter();
  const submitting = useLogsStore((s) => s.submitting);
  const lowConfidence = useLogsStore((s) => s.lowConfidence);
  const error = useLogsStore((s) => s.error);
  const errorDetail = useLogsStore((s) => s.errorDetail);
  const submitLog = useLogsStore((s) => s.submitLog);
  const cancelSubmit = useLogsStore((s) => s.cancelSubmit);

  const [text, setText] = useState('');

  // Falling edge of `submitting` with no error / low-confidence ⇒ success.
  // Use a ref so re-renders triggered by the user typing don't fire setText('').
  const prevSubmittingRef = useRef(submitting);
  useEffect(() => {
    if (prevSubmittingRef.current && !submitting && !lowConfidence && error === null) {
      setText('');
    }
    prevSubmittingRef.current = submitting;
  }, [submitting, lowConfidence, error]);

  const trimmed = text.trim();
  const submitDisabled = trimmed === '' || submitting;

  const handleSubmit = () => {
    if (submitDisabled) return;
    haptics.tap();
    void submitLog(text);
  };

  const handleCancel = () => {
    cancelSubmit();
    router.back();
  };

  return (
    <View className="flex-1 bg-bg px-4 pt-12">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          testID="log-cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel log entry"
          onPress={handleCancel}
        >
          <Text className="font-manrope text-text-mute" style={{ fontSize: 16 }}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="log-submit"
          accessibilityRole="button"
          accessibilityLabel="Submit log"
          accessibilityState={{ disabled: submitDisabled }}
          disabled={submitDisabled}
          onPress={handleSubmit}
        >
          <Text
            className={
              submitDisabled ? 'font-manrope-bold text-text-mute' : 'font-manrope-bold text-accent'
            }
            style={{ fontSize: 16 }}
          >
            {submitting ? 'Reading…' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        testID="log-text-input"
        accessibilityLabel="Log text"
        autoFocus
        multiline
        editable={!submitting}
        placeholder="What did you do?"
        placeholderTextColor="#7a7d8a"
        value={text}
        onChangeText={setText}
        className="mt-6 min-h-[160px] rounded-2xl bg-surface-2 p-4 font-manrope text-text"
        style={{ fontSize: 17, lineHeight: 24, textAlignVertical: 'top' }}
      />

      <View className="mt-4">
        {lowConfidence ? (
          <Text
            testID="log-message-low-confidence"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            We couldn&apos;t categorize that confidently — try a more specific log.
          </Text>
        ) : error === 'storage-error' ? (
          <Text
            testID="log-message-storage-error"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            Couldn&apos;t save your log. Try again.
          </Text>
        ) : error === 'unknown' ? (
          <Text
            testID="log-message-unknown-error"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            Something went wrong, try again.
          </Text>
        ) : null}

        {/* Dev-only error detail surface — removed for release builds. */}
        {__DEV__ && error !== null && errorDetail !== null ? (
          <Text
            testID="log-message-dev-detail"
            selectable
            className="font-manrope text-text-mute"
            style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}
          >
            DEV: {errorDetail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
