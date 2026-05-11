import { fireEvent, render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { FirstDecayModal } from '@/ui/components/FirstDecayModal';

describe('FirstDecayModal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders the title and body copy', () => {
    const { getByText } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByText('Your XP just decayed.')).toBeTruthy();
    expect(
      getByText(
        'Inactive days slowly drain your in-progress XP — never your level. Log something today to stop it.',
      ),
    ).toBeTruthy();
  });

  it('renders the "Got it" button', () => {
    const { getByTestId } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByTestId('first-decay-modal-dismiss')).toBeTruthy();
  });

  it('fires onDismiss when the button is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('first-decay-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onDismiss when the backdrop is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('first-decay-modal'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('exposes accessibilityRole="alert" on the host', () => {
    const { getByTestId } = render(<FirstDecayModal onDismiss={() => {}} />);
    expect(getByTestId('first-decay-modal').props.accessibilityRole).toBe('alert');
  });

  it('reduced-motion variant still renders and fires onDismiss on button tap', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const onDismiss = jest.fn();
    const { getByText, getByTestId } = render(<FirstDecayModal onDismiss={onDismiss} />);
    expect(getByText('Your XP just decayed.')).toBeTruthy();
    fireEvent.press(getByTestId('first-decay-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
