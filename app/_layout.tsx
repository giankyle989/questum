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
import { applyMigrations } from '@/storage/migrations';
import { MIGRATIONS } from '@/storage/migrations/index';
import { getDb } from '@/storage/db';
import { logger } from '@/lib/logger';
import '../global.css';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const driver = await getDb();
        await applyMigrations(driver, [...MIGRATIONS]);
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

  if (!fontsLoaded || !dbReady) {
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

  return <Slot />;
}
