import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { MissionCompletionToast } from '@/ui/components/MissionCompletionToast';

describe('MissionCompletionToast', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockNotificationAsync.mockClear();
  });

  it('renders mission description and bonus XP', () => {
    const { getByText } = render(
      <MissionCompletionToast
        missionDescription="Move your body for 20 minutes"
        bonusXP={50}
        attribute="CON"
        onComplete={() => {}}
      />,
    );
    expect(getByText('Move your body for 20 minutes')).toBeTruthy();
    expect(getByText('+50 XP')).toBeTruthy();
  });

  it('fires haptics.success on mount', () => {
    render(
      <MissionCompletionToast
        missionDescription="Read 20 minutes"
        bonusXP={50}
        attribute="INT"
        onComplete={() => {}}
      />,
    );
    expect(mockNotificationAsync).toHaveBeenCalledWith('success');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(
      <MissionCompletionToast
        missionDescription="Read 20 minutes"
        bonusXP={50}
        attribute="INT"
        onComplete={onComplete}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <MissionCompletionToast
        missionDescription="x"
        bonusXP={50}
        attribute="STR"
        onComplete={onComplete}
      />,
    );
    fireEvent.press(getByTestId('mission-completion-toast'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(
      <MissionCompletionToast
        missionDescription="x"
        bonusXP={50}
        attribute="STR"
        onComplete={onComplete}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
