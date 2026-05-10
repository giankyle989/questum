import { act, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { XPGainReveal } from '@/ui/components/XPGainReveal';

describe('XPGainReveal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
    jest.useRealTimers();
  });

  it('renders one entry per non-zero gain', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <XPGainReveal gains={{ STR: 30, CON: 15 }} onComplete={onComplete} />,
    );
    expect(getByTestId('xp-reveal-STR').props.children).toBe('+30');
    expect(getByTestId('xp-reveal-CON').props.children).toBe('+15');
  });

  it('calls onComplete after the animation window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<XPGainReveal gains={{ STR: 10 }} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips render and fires onComplete when reduced motion is on', () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);
    const onComplete = jest.fn();
    const { queryByTestId } = render(<XPGainReveal gains={{ STR: 10 }} onComplete={onComplete} />);
    expect(queryByTestId('xp-reveal-STR')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
