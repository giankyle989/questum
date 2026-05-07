import { Tabs } from 'expo-router';
import { COLORS } from '@/game/constants';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 },
      }}
    >
      <Tabs.Screen name="character" options={{ title: 'Character' }} />
      <Tabs.Screen name="missions" options={{ title: 'Quests' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="log" options={{ href: null }} />
    </Tabs>
  );
}
