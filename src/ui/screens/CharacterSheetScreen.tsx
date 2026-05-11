import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { ATTRIBUTES, type Attribute } from '@/game/constants';
import { characterLevel, xpToReachLevel } from '@/game/xp';
import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';
import { useCharacterStore } from '@/state/characterStore';
import { useMissionsStore } from '@/state/missionsStore';
import { useSettingsStore } from '@/state/settingsStore';
import { haptics } from '@/lib/haptics';
import { AttributeBar } from '@/ui/components/AttributeBar';
import { AvatarBadge } from '@/ui/components/AvatarBadge';
import { FirstDecayModal } from '@/ui/components/FirstDecayModal';
import { MissionCard } from '@/ui/components/MissionCard';
import { StreakIndicator } from '@/ui/components/StreakIndicator';

/**
 * Home tab — character sheet. Pulls character + attribute states + streak from
 * the character store, computes the character level via the pure game engine,
 * and renders the six attribute bars + a "+" FAB to open the log entry sheet.
 *
 * Mission preview shows up to 3 active missions (dailies first, weekly last,
 * matching the canonical order in `missionsStore.active`). The full Missions
 * tab still owns the completed list, expiry text, etc. — this is just a
 * glanceable card on the home screen.
 */
export default function CharacterSheetScreen() {
  const router = useRouter();
  const character = useCharacterStore((s) => s.character);
  const attributeStates = useCharacterStore((s) => s.attributeStates);
  const streak = useCharacterStore((s) => s.streak);
  const decayedAttributesToday = useCharacterStore((s) => s.decayedAttributesToday);
  const activeMissions = useMissionsStore((s) => s.active);
  const aiAvailable = useAIAvailabilityStore((s) => s.available);
  const firstDecayShown = useSettingsStore((s) => s.firstDecayShown);
  const setFirstDecayShown = useSettingsStore((s) => s.setFirstDecayShown);
  const previewMissions = useMemo(() => activeMissions.slice(0, 3), [activeMissions]);

  // Build a Record<Attribute, number> of levels for `characterLevel`. If the
  // store hasn't hydrated an attribute (shouldn't happen post-onboarding, but
  // guarded so the screen never crashes), default it to level 1.
  const attributeLevels = useMemo<Record<Attribute, number>>(() => {
    const levels = {} as Record<Attribute, number>;
    for (const attr of ATTRIBUTES) {
      levels[attr] = 1;
    }
    for (const state of attributeStates) {
      levels[state.attribute] = state.level;
    }
    return levels;
  }, [attributeStates]);

  const charLevel = useMemo(() => characterLevel(attributeLevels), [attributeLevels]);

  // Index attribute states by attribute so we can render bars in the canonical
  // ATTRIBUTES order regardless of how the store sorted them.
  const stateByAttribute = useMemo(() => {
    const map = {} as Record<Attribute, { level: number; inProgressXp: number }>;
    for (const attr of ATTRIBUTES) {
      map[attr] = { level: 1, inProgressXp: 0 };
    }
    for (const state of attributeStates) {
      map[state.attribute] = { level: state.level, inProgressXp: state.inProgressXp };
    }
    return map;
  }, [attributeStates]);

  const decayedSet = useMemo(() => new Set(decayedAttributesToday), [decayedAttributesToday]);

  const displayName = character?.name ?? '';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-4 pb-32 pt-12">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <AvatarBadge avatarId={character?.avatarId} size={56} />

            <View>
              <Text className="font-manrope-bold text-text" style={{ fontSize: 20 }}>
                {displayName}
              </Text>
              <Text className="font-manrope text-text-mute" style={{ fontSize: 13 }}>
                {`Level ${charLevel}`}
              </Text>
            </View>
          </View>
          <StreakIndicator streakDays={streak.currentLength} />
        </View>

        <View className="mt-8 gap-4">
          {ATTRIBUTES.map((attr) => {
            const s = stateByAttribute[attr];
            return (
              <AttributeBar
                key={attr}
                attribute={attr}
                level={s.level}
                inProgressXp={s.inProgressXp}
                xpThreshold={xpToReachLevel(s.level + 1)}
                decayedToday={decayedSet.has(attr)}
              />
            );
          })}
        </View>

        <View testID="mission-preview" className="mt-10">
          <Text className="font-manrope-bold text-text" style={{ fontSize: 18 }}>
            Today&apos;s Missions
          </Text>

          <View className="mt-3 gap-3">
            {activeMissions.length === 0 ? (
              <Text
                testID="mission-preview-empty"
                className="font-manrope text-text-mute"
                style={{ fontSize: 14 }}
              >
                No missions yet — submit your first log to generate missions.
              </Text>
            ) : (
              previewMissions.map((m) => <MissionCard key={m.id} mission={m} />)
            )}
          </View>
        </View>
      </ScrollView>

      <Pressable
        testID="fab-log"
        accessibilityRole="button"
        accessibilityLabel={aiAvailable ? 'Log activity' : 'Open Settings'}
        accessibilityState={{ disabled: !aiAvailable }}
        onPress={() => {
          if (!aiAvailable) {
            void Linking.openSettings();
            return;
          }
          haptics.tap();
          router.push('/(main)/log');
        }}
        className={`absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full ${
          aiAvailable ? 'bg-accent' : 'bg-surface-2 opacity-40'
        }`}
      >
        <Text
          className={aiAvailable ? 'font-manrope-bold text-bg' : 'font-manrope-bold text-text-mute'}
          style={{ fontSize: 28, lineHeight: 30 }}
        >
          +
        </Text>
      </Pressable>

      {!firstDecayShown && decayedAttributesToday.length > 0 ? (
        <FirstDecayModal
          onDismiss={() => {
            void setFirstDecayShown(true);
          }}
        />
      ) : null}
    </View>
  );
}
