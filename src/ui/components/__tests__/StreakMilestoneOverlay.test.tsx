import { act, fireEvent, render } from '@testing-library/react-native';

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

import { StreakMilestoneOverlay } from '@/ui/components/StreakMilestoneOverlay';

describe('StreakMilestoneOverlay', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockNotificationAsync.mockClear();
  });

  it('renders threshold and multiplier text', () => {
    const { getByText } = render(
      <StreakMilestoneOverlay threshold={7} multiplier={1.2} onComplete={() => {}} />,
    );
    expect(getByText('7-day streak!')).toBeTruthy();
    expect(getByText('Streak multiplier now 1.20×')).toBeTruthy();
  });

  it('fires haptics.success on mount', () => {
    render(<StreakMilestoneOverlay threshold={3} multiplier={1.05} onComplete={() => {}} />);
    expect(mockNotificationAsync).toHaveBeenCalledWith('success');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<StreakMilestoneOverlay threshold={30} multiplier={1.2} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <StreakMilestoneOverlay threshold={3} multiplier={1.05} onComplete={onComplete} />,
    );
    fireEvent.press(getByTestId('streak-milestone-overlay'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(<StreakMilestoneOverlay threshold={7} multiplier={1.2} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
