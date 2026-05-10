import Constants from 'expo-constants';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

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

  const characterName = character?.name ?? 'Unknown';
  const aiSourceLabel = AI_SOURCE_LABEL[aiSourceLastUsed];
  const version = Constants.expoConfig?.version ?? '';

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
                  void setNotificationsEnabled(v);
                }}
              />
            }
          />
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
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
