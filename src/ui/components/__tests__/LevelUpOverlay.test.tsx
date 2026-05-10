import { act, fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { LevelUpOverlay } from '@/ui/components/LevelUpOverlay';

describe('LevelUpOverlay', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    mockImpactAsync.mockClear();
  });

  it('renders the attribute and level', () => {
    const { getByText } = render(
      <LevelUpOverlay attribute="STR" newLevel={4} onComplete={() => {}} />,
    );
    expect(getByText('STR')).toBeTruthy();
    expect(getByText('Lv 4')).toBeTruthy();
  });

  it('fires haptics.levelUp (heavy impact) on mount', () => {
    render(<LevelUpOverlay attribute="DEX" newLevel={2} onComplete={() => {}} />);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('heavy');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<LevelUpOverlay attribute="CON" newLevel={3} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tap-to-skip fires onComplete early', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <LevelUpOverlay attribute="INT" newLevel={5} onComplete={onComplete} />,
    );
    fireEvent.press(getByTestId('level-up-overlay'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion variant fires onComplete after a short window', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    render(<LevelUpOverlay attribute="WIS" newLevel={2} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
