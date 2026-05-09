import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ATTRIBUTES, type Attribute } from '@/game/constants';
import { characterLevel, xpToReachLevel } from '@/game/xp';
import { useCharacterStore } from '@/state/characterStore';
import { AttributeBar } from '@/ui/components/AttributeBar';
import { StreakIndicator } from '@/ui/components/StreakIndicator';

/**
 * Home tab — character sheet. Pulls character + attribute states + streak from
 * the character store, computes the character level via the pure game engine,
 * and renders the six attribute bars + a "+" FAB to open the log entry sheet.
 *
 * Mission preview is wired in Task 5.4; this screen renders only the bars and
 * FAB for now (Slice 1 scope).
 */
export default function CharacterSheetScreen() {
  const router = useRouter();
  const character = useCharacterStore((s) => s.character);
  const attributeStates = useCharacterStore((s) => s.attributeStates);
  const streak = useCharacterStore((s) => s.streak);

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

  const initial = character?.name?.charAt(0)?.toUpperCase() ?? '?';
  const displayName = character?.name ?? '';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-4 pb-32 pt-12">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              testID="avatar-placeholder"
              className="h-14 w-14 items-center justify-center rounded-full bg-surface-2"
            >
              <Text className="font-manrope-bold text-text" style={{ fontSize: 22 }}>
                {initial}
              </Text>
            </View>
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
              />
            );
          })}
        </View>
      </ScrollView>

      <TouchableOpacity
        testID="fab-log"
        accessibilityRole="button"
        accessibilityLabel="Log activity"
        onPress={() => router.push('/(main)/log')}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-accent"
      >
        <Text className="font-manrope-bold text-bg" style={{ fontSize: 28, lineHeight: 30 }}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}
