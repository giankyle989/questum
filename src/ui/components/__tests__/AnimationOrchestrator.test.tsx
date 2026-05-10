import { act, render } from '@testing-library/react-native';

interface MockLogsState {
  lastSubmitResult: {
    gains: Record<string, number>;
    levelUps: Array<{ attribute: string; newLevel: number }>;
    missionCompletions: string[];
    prevStreak: number;
    newStreak: number;
  } | null;
  clearLastSubmitResult: jest.Mock;
}

let mockLogsState: MockLogsState = {
  lastSubmitResult: null,
  clearLastSubmitResult: jest.fn(),
};

jest.mock('@/state/logsStore', () => ({
  useLogsStore: Object.assign(
    jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
    { getState: () => mockLogsState },
  ),
}));

interface MockMissionsState {
  active: Array<{ id: string; description: string; bonusXp: number; attribute: string }>;
}
const mockMissionsState: MockMissionsState = {
  active: [
    {
      id: 'daily_con_cardio_2026-05-10',
      description: 'Move 20 minutes',
      bonusXp: 50,
      attribute: 'CON',
    },
  ],
};
jest.mock('@/state/missionsStore', () => ({
  useMissionsStore: Object.assign(
    jest.fn((selector: (s: unknown) => unknown) => selector(mockMissionsState)),
    { getState: () => mockMissionsState },
  ),
}));

// Use jest.fn() stubs so we can inspect calls without needing JSX in factories.
const mockXPGainReveal = jest.fn();
const mockLevelUpOverlay = jest.fn();
const mockMissionCompletionToast = jest.fn();
const mockStreakMilestoneOverlay = jest.fn();

jest.mock('@/ui/components/XPGainReveal', () => ({
  XPGainReveal: (props: Record<string, unknown>) => mockXPGainReveal(props),
}));
jest.mock('@/ui/components/LevelUpOverlay', () => ({
  LevelUpOverlay: (props: Record<string, unknown>) => mockLevelUpOverlay(props),
}));
jest.mock('@/ui/components/MissionCompletionToast', () => ({
  MissionCompletionToast: (props: Record<string, unknown>) => mockMissionCompletionToast(props),
}));
jest.mock('@/ui/components/StreakMilestoneOverlay', () => ({
  StreakMilestoneOverlay: (props: Record<string, unknown>) => mockStreakMilestoneOverlay(props),
}));

import { AnimationOrchestrator } from '@/ui/components/AnimationOrchestrator';

/** Call the onComplete prop for each stub immediately after it's recorded. */
function setupStub(mockFn: jest.Mock) {
  mockFn.mockImplementation((props: Record<string, unknown>) => {
    setTimeout(() => (props.onComplete as () => void)(), 0);
    return null;
  });
}

describe('AnimationOrchestrator', () => {
  beforeEach(() => {
    mockLogsState = {
      lastSubmitResult: null,
      clearLastSubmitResult: jest.fn(),
    };
    setupStub(mockXPGainReveal);
    setupStub(mockLevelUpOverlay);
    setupStub(mockMissionCompletionToast);
    setupStub(mockStreakMilestoneOverlay);
    mockXPGainReveal.mockClear();
    mockLevelUpOverlay.mockClear();
    mockMissionCompletionToast.mockClear();
    mockStreakMilestoneOverlay.mockClear();
  });

  it('renders nothing when lastSubmitResult is null', () => {
    render(<AnimationOrchestrator />);
    expect(mockXPGainReveal).not.toHaveBeenCalled();
    expect(mockLevelUpOverlay).not.toHaveBeenCalled();
  });

  it('processes a queue with all four item kinds in order', async () => {
    jest.useFakeTimers();
    mockLogsState = {
      lastSubmitResult: {
        gains: { STR: 30, CON: 15 },
        levelUps: [
          { attribute: 'STR', newLevel: 4 },
          { attribute: 'CON', newLevel: 3 },
        ],
        missionCompletions: ['daily_con_cardio_2026-05-10'],
        prevStreak: 6,
        newStreak: 7,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    // Advance through the queue. Each item fires onComplete via setTimeout(0).
    // We need one act per queue item to flush the timer + the React re-render.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
      });
    }
    jest.useRealTimers();
    // xp-reveal called once
    expect(mockXPGainReveal).toHaveBeenCalledTimes(1);
    // level-up called twice, in attribute order
    expect(mockLevelUpOverlay).toHaveBeenCalledTimes(2);
    expect(mockLevelUpOverlay.mock.calls[0]![0].attribute).toBe('STR');
    expect(mockLevelUpOverlay.mock.calls[1]![0].attribute).toBe('CON');
    // mission toast called once
    expect(mockMissionCompletionToast).toHaveBeenCalledTimes(1);
    // streak overlay called once with correct props
    expect(mockStreakMilestoneOverlay).toHaveBeenCalledTimes(1);
    expect(mockStreakMilestoneOverlay.mock.calls[0]![0].threshold).toBe(7);
    expect(mockStreakMilestoneOverlay.mock.calls[0]![0].multiplier).toBe(1.2);
    // clearLastSubmitResult called once when the new result was enqueued
    expect(mockLogsState.clearLastSubmitResult).toHaveBeenCalledTimes(1);
  });

  it('skips the streak overlay when no milestone was crossed', async () => {
    jest.useFakeTimers();
    mockLogsState = {
      lastSubmitResult: {
        gains: { STR: 10 },
        levelUps: [],
        missionCompletions: [],
        prevStreak: 7,
        newStreak: 8,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
      });
    }
    jest.useRealTimers();
    expect(mockXPGainReveal).toHaveBeenCalledTimes(1);
    expect(mockStreakMilestoneOverlay).not.toHaveBeenCalled();
  });

  it('appends items to the queue when a second submit arrives mid-animation', async () => {
    jest.useFakeTimers();

    // Track how many times advance (onComplete) is actually called — not how many times
    // the component renders the same item. Each stub re-render reschedules onComplete,
    // so we override the xp-reveal stub to fire onComplete only once (deduplicate timers).
    let xpRevealTimerId: ReturnType<typeof setTimeout> | null = null;
    mockXPGainReveal.mockImplementation((props: Record<string, unknown>) => {
      if (xpRevealTimerId !== null) clearTimeout(xpRevealTimerId);
      xpRevealTimerId = setTimeout(() => {
        xpRevealTimerId = null;
        (props.onComplete as () => void)();
      }, 0);
      return null;
    });

    // First submit: one xp-reveal.
    const firstClear = jest.fn(() => {
      mockLogsState = { ...mockLogsState, lastSubmitResult: null };
    });
    mockLogsState = {
      lastSubmitResult: {
        gains: { STR: 10 },
        levelUps: [],
        missionCompletions: [],
        prevStreak: 1,
        newStreak: 1,
      },
      clearLastSubmitResult: firstClear,
    };

    const { rerender } = render(<AnimationOrchestrator />);

    // After render: the enqueue useEffect has run.
    //  - firstResult enqueued → current = xp-reveal, queue = []
    //  - firstClear called → mockLogsState.lastSubmitResult = null
    // One deduplicated timer pending for xp-reveal.onComplete.

    // Inject the second submit BEFORE draining the xp-reveal timer.
    const secondClear = jest.fn(() => {
      mockLogsState = { ...mockLogsState, lastSubmitResult: null };
    });
    mockLogsState = {
      lastSubmitResult: {
        gains: {},
        levelUps: [{ attribute: 'CON', newLevel: 2 }],
        missionCompletions: [],
        prevStreak: 1,
        newStreak: 1,
      },
      clearLastSubmitResult: secondClear,
    };
    // rerender → useLogsStore returns secondResult → useEffect fires → enqueue CON level-up
    // (appended since current = xp-reveal) → secondClear called → lastSubmitResult = null.
    act(() => {
      rerender(<AnimationOrchestrator />);
    });

    // Drain: xp-reveal's timer fires once (deduplicated) → advance → level-up starts → advance.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
      });
    }
    jest.useRealTimers();

    // xp-reveal played (current from first submit); level-up played (queued from second submit).
    expect(mockXPGainReveal).toHaveBeenCalled();
    expect(mockLevelUpOverlay).toHaveBeenCalledTimes(1);
    expect(mockLevelUpOverlay.mock.calls[0]![0].attribute).toBe('CON');
    // Both results were consumed.
    expect(firstClear).toHaveBeenCalledTimes(1);
    expect(secondClear).toHaveBeenCalledTimes(1);
  });

  it('clears lastSubmitResult even when there is nothing to enqueue', async () => {
    mockLogsState = {
      lastSubmitResult: {
        gains: {},
        levelUps: [],
        missionCompletions: [],
        prevStreak: 1,
        newStreak: 1,
      },
      clearLastSubmitResult: jest.fn(),
    };
    render(<AnimationOrchestrator />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockXPGainReveal).not.toHaveBeenCalled();
    expect(mockLevelUpOverlay).not.toHaveBeenCalled();
    expect(mockMissionCompletionToast).not.toHaveBeenCalled();
    expect(mockStreakMilestoneOverlay).not.toHaveBeenCalled();
    expect(mockLogsState.clearLastSubmitResult).toHaveBeenCalledTimes(1);
  });
});
