import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getDb } from '@/storage/db';
import { todayLocalISODate } from '@/lib/clock';
import type { Attribute } from '@/game/constants';
import { useSettingsStore } from '@/state/settingsStore';
import { useCharacterStore } from '@/state/characterStore';
import { effectiveInactiveDays, applyDecay } from '@/game/decay';
import * as characterRepo from '@/storage/repositories/characterRepo';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import * as logRepo from '@/storage/repositories/logRepo';
import type { ISODate } from '@/game/calendar';

/**
 * Runs XP decay on app foreground transitions and on cold start.
 *
 * Behavior:
 * - Subscribes to `AppState` and runs decay on each `"active"` transition,
 *   plus once on mount (cold start).
 * - Idempotent within the same calendar day, guarded by a `useRef` holding
 *   the most recent run-day. The ref is initialized from `getState()` so
 *   the hook does not subscribe reactively — the guard only reads the value
 *   when runDecay fires.
 * - On a successful decay pass: writes attribute states to SQLite, calls
 *   `characterStore.hydrate()`, and records which attributes had non-zero
 *   in-progress XP reduced via `characterStore.setDecayedAttributesToday(...)`.
 * - On a no-decay foreground (within grace window, or user logged today),
 *   clears `decayedAttributesToday` to `[]` so the shimmer turns off and the
 *   first-decay modal trigger condition unsets.
 * - Does NOT set `firstDecayShown`. That flag is now owned by the
 *   FirstDecayModal dismiss handler (see CharacterSheetScreen).
 *
 * No unit test — depends on `AppState` (native). Verified manually.
 */
export function useAppForegroundDecay(): void {
  // Initialize from getState() (non-reactive) so we don't resubscribe on every
  // settings change — the guard only reads the value when runDecay fires.
  const lastDecayRunDayRef = useRef<ISODate | null>(useSettingsStore.getState().lastDecayRunDay);

  const runDecay = useCallback(async () => {
    const today = todayLocalISODate();
    if (lastDecayRunDayRef.current === today) return; // already ran today

    const db = await getDb();
    const lastLogDay = await logRepo.getLastLogDay(db);

    if (lastLogDay === null) {
      // No prior log — record the run-day to avoid re-running, then return.
      await settingsRepo.setSetting(db, 'last_decay_run_day', today);
      await useSettingsStore.getState().setLastDecayRunDay(today);
      lastDecayRunDayRef.current = today;
      useCharacterStore.getState().setDecayedAttributesToday([]);
      return;
    }

    // Inline daysSince — calendar.ts is frozen and does not export this helper.
    const daysSince = Math.round(
      (new Date(today).getTime() - new Date(lastLogDay).getTime()) / 86_400_000,
    );
    const eff = effectiveInactiveDays(daysSince, 0); // pauseWindows is Phase 4

    const reducedAttrs: Attribute[] = [];
    if (eff > 0) {
      const states = await characterRepo.getAttributeStates(db);
      const decayed = states.map((s) => {
        const nextXp = applyDecay(
          { level: s.level, inProgressXp: s.inProgressXp },
          eff,
        ).inProgressXp;
        if (nextXp < s.inProgressXp) reducedAttrs.push(s.attribute);
        return { ...s, inProgressXp: nextXp };
      });
      await characterRepo.updateAttributeStates(db, decayed);
      await useCharacterStore.getState().hydrate();
    }

    useCharacterStore.getState().setDecayedAttributesToday(reducedAttrs);

    await settingsRepo.setSetting(db, 'last_decay_run_day', today);
    await useSettingsStore.getState().setLastDecayRunDay(today);
    lastDecayRunDayRef.current = today; // update AFTER successful run
  }, []); // empty deps — ref is intentionally non-reactive

  useEffect(() => {
    // Run on mount (cold start)
    void runDecay();

    // Subscribe to foreground transitions. Modern RN returns an
    // EventSubscription whose `.remove()` is the cleanup; do not use the
    // legacy `removeEventListener` API.
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void runDecay();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runDecay]);
}
