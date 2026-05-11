import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { fireTestDaily, fireTestNudge } from '@/notifications/notifications';
import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';
import { useCharacterStore } from '@/state/characterStore';
import { useSettingsStore } from '@/state/settingsStore';

const AI_SOURCE_LABEL: Record<'apple' | 'gemini' | 'mock' | 'none', string> = {
  apple: 'Apple Intelligence',
  gemini: 'Gemini Nano',
  mock: 'Mock (development)',
  none: 'Not yet used',
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View className="mt-8">
      <Text
        className="font-manrope-bold uppercase text-text-mute"
        style={{ fontSize: 12, letterSpacing: 1.2 }}
      >
        {title}
      </Text>
      <View className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-2">
        {children}
      </View>
    </View>
  );
}

interface RowProps {
  label: string;
  value?: React.ReactNode;
  testID?: string;
}

function Row({ label, value, testID }: RowProps) {
  return (
    <View
      testID={testID}
      className="flex-row items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
    >
      <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text className="font-manrope text-text-mute" style={{ fontSize: 15 }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/**
 * Settings tab — read/write user preferences. Reads `character` from
 * `characterStore` (read-only here in Phase 3) and `notificationsEnabled`,
 * `decayPaused`, `aiSourceLastUsed` from `settingsStore`. The two switches
 * call back into the store setters, which persist to SQLite.
 */
export default function SettingsScreen() {
  const character = useCharacterStore((s) => s.character);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const decayPaused = useSettingsStore((s) => s.decayPaused);
  const aiSourceLastUsed = useSettingsStore((s) => s.aiSourceLastUsed);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const setDecayPaused = useSettingsStore((s) => s.setDecayPaused);
  const devForceAIUnavailable = useSettingsStore((s) => s.devForceAIUnavailable);
  const setDevForceAIUnavailable = useSettingsStore((s) => s.setDevForceAIUnavailable);
  const notificationMorningTime = useSettingsStore((s) => s.notificationMorningTime);
  const setNotificationMorningTime = useSettingsStore((s) => s.setNotificationMorningTime);
  const inactivityNudgeEnabled = useSettingsStore((s) => s.inactivityNudgeEnabled);
  const setInactivityNudgeEnabled = useSettingsStore((s) => s.setInactivityNudgeEnabled);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const characterName = character?.name ?? 'Unknown';
  const aiSourceLabel = AI_SOURCE_LABEL[aiSourceLastUsed];
  const version = Constants.expoConfig?.version ?? '';

  const formatMorningTime = (hhmm: string): string => {
    const [hStr, mStr] = hhmm.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };

  return (
    <View testID="settings-screen" className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-4 pb-12 pt-12">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 22 }}>
          Settings
        </Text>

        <Section title="Profile">
          <Row label="Name" value={characterName} testID="settings-profile-name" />
        </Section>

        <Section title="AI Source">
          <Row label="Last used" value={aiSourceLabel} testID="settings-ai-source" />
        </Section>

        <Section title="Notifications">
          <Row
            label="Daily missions reminder"
            testID="settings-notifications-row"
            value={
              <Switch
                testID="settings-notifications-switch"
                value={notificationsEnabled}
                onValueChange={(v) => {
                  void (async () => {
                    const result = await setNotificationsEnabled(v);
                    setPermissionDenied(result.permissionDenied);
                  })();
                }}
              />
            }
          />
          <Pressable
            testID="settings-morning-time-row"
            accessibilityRole="button"
            accessibilityState={{ disabled: !notificationsEnabled }}
            disabled={!notificationsEnabled}
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
          >
            <Text
              className={`font-manrope ${notificationsEnabled ? 'text-text' : 'text-text-mute'}`}
              style={{ fontSize: 15 }}
            >
              Morning time
            </Text>
            <Text
              className={`font-manrope ${notificationsEnabled ? 'text-text-mute' : 'text-text-dim'}`}
              style={{ fontSize: 15 }}
            >
              {formatMorningTime(notificationMorningTime)}
            </Text>
          </Pressable>
          <Row
            label="Inactivity nudge (day 3+)"
            testID="settings-inactivity-nudge-row"
            value={
              <Switch
                testID="settings-inactivity-nudge-switch"
                value={inactivityNudgeEnabled}
                disabled={!notificationsEnabled}
                onValueChange={(v) => {
                  void setInactivityNudgeEnabled(v);
                }}
              />
            }
          />
          {permissionDenied ? (
            <Text
              testID="settings-notifications-permission-denied"
              className="px-4 pb-3 pt-1 font-manrope text-text-mute"
              style={{ fontSize: 13, lineHeight: 18 }}
            >
              Enable in iOS Settings → Notifications → Questum to receive reminders.
            </Text>
          ) : null}
          {pickerOpen ? (
            <DateTimePicker
              testID="datetimepicker"
              mode="time"
              display="spinner"
              value={(() => {
                const [hStr, mStr] = notificationMorningTime.split(':');
                const d = new Date();
                d.setHours(Number(hStr), Number(mStr), 0, 0);
                return d;
              })()}
              onChange={(event, selected) => {
                setPickerOpen(false);
                if (event.type === 'set' && selected) {
                  const hh = String(selected.getHours()).padStart(2, '0');
                  const mm = String(selected.getMinutes()).padStart(2, '0');
                  void setNotificationMorningTime(`${hh}:${mm}`);
                }
              }}
            />
          ) : null}
        </Section>

        <Section title="Decay">
          <Row
            label="Pause decay"
            testID="settings-decay-row"
            value={
              <Switch
                testID="settings-decay-switch"
                value={decayPaused}
                onValueChange={(v) => {
                  void setDecayPaused(v);
                }}
              />
            }
          />
        </Section>

        <Section title="About">
          <Row label="App version" value={version} testID="settings-version" />
        </Section>

        {__DEV__ ? (
          <Section title="Developer">
            <Pressable
              testID="settings-reset-character"
              accessibilityRole="button"
              onPress={() => {
                // Phase 3: stub. Real implementation arrives in a later phase.
                // eslint-disable-next-line no-console
                console.log('TODO: reset character');
              }}
              className="px-4 py-3"
            >
              <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
                Reset character
              </Text>
            </Pressable>
            <Row
              label="Force AI unavailable"
              testID="settings-dev-force-ai-unavailable-row"
              value={
                <Switch
                  testID="settings-dev-force-ai-unavailable"
                  value={devForceAIUnavailable}
                  onValueChange={(v) => {
                    void (async () => {
                      await setDevForceAIUnavailable(v);
                      await useAIAvailabilityStore.getState().runProbe();
                    })();
                  }}
                />
              }
            />
            <Pressable
              testID="settings-dev-test-daily"
              accessibilityRole="button"
              onPress={() => {
                void fireTestDaily();
              }}
              className="px-4 py-3"
            >
              <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
                Send test daily notification (5s)
              </Text>
            </Pressable>
            <Pressable
              testID="settings-dev-test-nudge"
              accessibilityRole="button"
              onPress={() => {
                void fireTestNudge();
              }}
              className="px-4 py-3"
            >
              <Text className="font-manrope text-text" style={{ fontSize: 15 }}>
                Send test inactivity nudge (5s)
              </Text>
            </Pressable>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
