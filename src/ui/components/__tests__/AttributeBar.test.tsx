import { render } from '@testing-library/react-native';

const mockUseReducedMotion = jest.fn(() => false);
jest.mock('@/state/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { AttributeBar } from '@/ui/components/AttributeBar';

describe('AttributeBar', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders the attribute label and level', () => {
    const { getByText } = render(
      <AttributeBar attribute="STR" level={3} inProgressXp={50} xpThreshold={100} />,
    );
    expect(getByText('STR')).toBeTruthy();
    expect(getByText('Lv 3')).toBeTruthy();
  });

  it('exposes a fill testID', () => {
    const { getByTestId } = render(
      <AttributeBar attribute="DEX" level={2} inProgressXp={30} xpThreshold={100} />,
    );
    expect(getByTestId('attribute-bar-fill-DEX')).toBeTruthy();
  });

  it('renders the shimmer overlay when decayedToday is true', () => {
    const { getByTestId } = render(
      <AttributeBar attribute="CON" level={4} inProgressXp={20} xpThreshold={100} decayedToday />,
    );
    expect(getByTestId('attribute-bar-shimmer-CON')).toBeTruthy();
  });

  it('does not render the shimmer overlay when decayedToday is false', () => {
    const { queryByTestId } = render(
      <AttributeBar attribute="CON" level={4} inProgressXp={20} xpThreshold={100} />,
    );
    expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
  });

  it('renders the shimmer testID even with reduced motion (animation disabled)', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { getByTestId } = render(
      <AttributeBar attribute="INT" level={1} inProgressXp={10} xpThreshold={100} decayedToday />,
    );
    expect(getByTestId('attribute-bar-shimmer-INT')).toBeTruthy();
  });
});
