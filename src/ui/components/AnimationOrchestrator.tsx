import { useEffect, useReducer } from 'react';

import { ATTRIBUTES, type Attribute } from '@/game/constants';
import { crossedStreakMilestone, streakMultiplierAt } from '@/game/streakMilestone';
import { useLogsStore } from '@/state/logsStore';
import { useMissionsStore } from '@/state/missionsStore';

import { LevelUpOverlay } from '@/ui/components/LevelUpOverlay';
import { MissionCompletionToast } from '@/ui/components/MissionCompletionToast';
import { StreakMilestoneOverlay } from '@/ui/components/StreakMilestoneOverlay';
import { XPGainReveal } from '@/ui/components/XPGainReveal';

type QueueItem =
  | { kind: 'xp-reveal'; gains: Partial<Record<Attribute, number>> }
  | { kind: 'level-up'; attribute: Attribute; newLevel: number }
  | { kind: 'mission'; missionDescription: string; bonusXP: number; attribute: Attribute }
  | { kind: 'streak'; threshold: 3 | 7 | 30; multiplier: number };

interface OrchestratorState {
  queue: QueueItem[];
  current: QueueItem | null;
}

type OrchestratorAction = { type: 'enqueue'; items: QueueItem[] } | { type: 'advance' };

function reducer(state: OrchestratorState, action: OrchestratorAction): OrchestratorState {
  switch (action.type) {
    case 'enqueue': {
      const combined = [...state.queue, ...action.items];
      if (state.current !== null || combined.length === 0) {
        return { ...state, queue: combined };
      }
      // Nothing playing — start immediately.
      return { current: combined[0] ?? null, queue: combined.slice(1) };
    }
    case 'advance': {
      if (state.queue.length === 0) {
        return { ...state, current: null };
      }
      return { current: state.queue[0] ?? null, queue: state.queue.slice(1) };
    }
    default:
      return state;
  }
}

/**
 * Single sequencer for post-submit animations. Mounted once at the root
 * (`app/_layout.tsx`). Watches `lastSubmitResult` on the logs store; when a new
 * one arrives, builds a queue of overlay items and plays them one at a time.
 *
 * The orchestrator clears `lastSubmitResult` as soon as it has read it, so the
 * next subscriber update doesn't re-enqueue the same items. If a new submit
 * arrives mid-queue, its items are appended to the existing queue rather than
 * replacing it (so two submits in quick succession both get celebrated).
 */
export function AnimationOrchestrator(): React.JSX.Element | null {
  const lastSubmitResult = useLogsStore((s) => s.lastSubmitResult);
  const activeMissions = useMissionsStore((s) => s.active);

  const [state, dispatch] = useReducer(reducer, { queue: [], current: null });

  // Enqueue effect — runs whenever lastSubmitResult changes to a non-null value.
  useEffect(() => {
    if (!lastSubmitResult) return;

    const items: QueueItem[] = [];
    if (Object.keys(lastSubmitResult.gains).length > 0) {
      items.push({ kind: 'xp-reveal', gains: lastSubmitResult.gains });
    }

    // Level-ups in canonical ATTRIBUTES order, regardless of the order the
    // engine returned. Handles multi-attribute level-ups in a stable sequence.
    const sortedLevelUps = [...lastSubmitResult.levelUps].sort(
      (a, b) =>
        ATTRIBUTES.indexOf(a.attribute as Attribute) - ATTRIBUTES.indexOf(b.attribute as Attribute),
    );
    for (const lu of sortedLevelUps) {
      items.push({
        kind: 'level-up',
        attribute: lu.attribute as Attribute,
        newLevel: lu.newLevel,
      });
    }

    for (const id of lastSubmitResult.missionCompletions) {
      const m = activeMissions.find((x) => x.id === id);
      if (!m) continue;
      items.push({
        kind: 'mission',
        missionDescription: m.description,
        bonusXP: m.bonusXp,
        attribute: m.attribute as Attribute,
      });
    }

    const milestone = crossedStreakMilestone(
      lastSubmitResult.prevStreak,
      lastSubmitResult.newStreak,
    );
    if (milestone) {
      items.push({
        kind: 'streak',
        threshold: milestone,
        multiplier: streakMultiplierAt(milestone),
      });
    }

    dispatch({ type: 'enqueue', items });
    useLogsStore.getState().clearLastSubmitResult();
  }, [lastSubmitResult, activeMissions]);

  if (!state.current) return null;

  const advance = () => dispatch({ type: 'advance' });

  switch (state.current.kind) {
    case 'xp-reveal':
      return <XPGainReveal gains={state.current.gains} onComplete={advance} />;
    case 'level-up':
      return (
        <LevelUpOverlay
          attribute={state.current.attribute}
          newLevel={state.current.newLevel}
          onComplete={advance}
        />
      );
    case 'mission':
      return (
        <MissionCompletionToast
          missionDescription={state.current.missionDescription}
          bonusXP={state.current.bonusXP}
          attribute={state.current.attribute}
          onComplete={advance}
        />
      );
    case 'streak':
      return (
        <StreakMilestoneOverlay
          threshold={state.current.threshold}
          multiplier={state.current.multiplier}
          onComplete={advance}
        />
      );
  }
}
