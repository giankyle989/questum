import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useMissionsStore } from '@/state/missionsStore';
import { MissionCard } from '@/ui/components/MissionCard';

/**
 * Missions tab — shows active dailies + weekly quest, plus a list of recently
 * completed missions. Pulls everything from `missionsStore`. No game rules
 * here; the store + game engine own those.
 */
export default function MissionsScreen() {
  const active = useMissionsStore((s) => s.active);
  const recentlyCompleted = useMissionsStore((s) => s.recentlyCompleted);

  // Render dailies before weeklies for stable, predictable ordering.
  const orderedActive = useMemo(() => {
    const dailies = active.filter((m) => m.type === 'daily');
    const weeklies = active.filter((m) => m.type === 'weekly');
    return [...dailies, ...weeklies];
  }, [active]);

  return (
    <View testID="missions-screen" className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-4 pb-12 pt-12">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 22 }}>
          Active
        </Text>

        <View className="mt-4 gap-3">
          {orderedActive.length === 0 ? (
            <Text className="font-manrope text-text-mute" style={{ fontSize: 14 }}>
              No active missions
            </Text>
          ) : (
            orderedActive.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </View>

        <Text className="mt-10 font-manrope-bold text-text" style={{ fontSize: 22 }}>
          Completed
        </Text>

        <View className="mt-4 gap-3">
          {recentlyCompleted.length === 0 ? (
            <Text className="font-manrope text-text-mute" style={{ fontSize: 14 }}>
              No completed missions yet
            </Text>
          ) : (
            recentlyCompleted.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}
