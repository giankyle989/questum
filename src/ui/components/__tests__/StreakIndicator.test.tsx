import { render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { StreakIndicator } from '@/ui/components/StreakIndicator';

describe('StreakIndicator', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders nothing when streakDays is 0', () => {
    const { queryByTestId } = render(<StreakIndicator streakDays={0} />);
    expect(queryByTestId('streak-indicator')).toBeNull();
  });

  it('renders the flame and label when streakDays > 0', () => {
    const { getByTestId, getByText } = render(<StreakIndicator streakDays={5} />);
    expect(getByTestId('streak-indicator')).toBeTruthy();
    expect(getByText('5 days')).toBeTruthy();
  });

  it('uses the singular form for streakDays === 1', () => {
    const { getByText } = render(<StreakIndicator streakDays={1} />);
    expect(getByText('1 day')).toBeTruthy();
  });

  it('still renders content when reduced motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { getByText } = render(<StreakIndicator streakDays={3} />);
    expect(getByText('3 days')).toBeTruthy();
  });
});
