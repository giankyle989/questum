import { Slot } from 'expo-router';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { applyMigrations } from '@/storage/migrationRunner';
import { MIGRATIONS } from '@/storage/migrations';
import { getDb } from '@/storage/db';
import { logger } from '@/lib/logger';
import { useSettingsStore } from '@/state/settingsStore';
import { useCharacterStore } from '@/state/characterStore';
import { useMissionsStore } from '@/state/missionsStore';
import { useLogsStore } from '@/state/logsStore';
import { useAppForegroundDecay } from '@/state/hooks/useAppForegroundDecay';
import { useAIAvailabilityProbe } from '@/state/hooks/useAIAvailabilityProbe';
import { AIUnavailableBanner } from '@/ui/components/AIUnavailableBanner';
import '../global.css';

/**
 * Mounts after migrations + store hydration are complete (gated by `dbReady`).
 * Holds the decay hook so its initial AppState listener and cold-start
 * `runDecay()` only fire AFTER tables exist — otherwise `getLastLogDay` runs
 * a SELECT on `logs` before migration 001 has applied and crashes with
 * "no such table: logs" on a fresh install.
 * Also mounts the AI availability probe, which polls on-device AI support and
 * surfaces an inline banner when AI is unavailable.
 */
function PostBootShell(): React.JSX.Element {
  useAppForegroundDecay();
  useAIAvailabilityProbe();
  return (
    <>
      <AIUnavailableBanner />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const [dbReady, setDbReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const settingsLoading = useSettingsStore((s) => s.loading);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const driver = await getDb();
        await applyMigrations(driver, [...MIGRATIONS]);
        // Hydrate stores in series — characterStore/missionsStore may read state
        // populated by settingsStore, and logsStore depends on logRepo state.
        await useSettingsStore.getState().hydrate();
        await useCharacterStore.getState().hydrate();
        await useMissionsStore.getState().hydrate();
        await useLogsStore.getState().hydrate();
        if (!cancelled) setDbReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('DB init failed', msg);
        if (!cancelled) setBootError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1116',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: '#E6EDF3', fontSize: 16, textAlign: 'center' }}>
          Database failed to initialize. Reinstall the app to retry.
        </Text>
        <Text style={{ color: '#7D8590', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
          {bootError}
        </Text>
      </View>
    );
  }

  if (!fontsLoaded || !dbReady || settingsLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1116',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#9AA4AE', fontSize: 14 }}>Loading…</Text>
      </View>
    );
  }

  return <PostBootShell />;
}
