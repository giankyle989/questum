import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/state/characterStore', () => ({
  useCharacterStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      character: {
        id: 1,
        name: 'Zara',
        avatarId: 'avatar_1',
        createdAt: '2026-01-01T00:00:00Z',
      },
      attributeStates: [
        { attribute: 'STR', level: 1, inProgressXp: 50 },
        { attribute: 'DEX', level: 1, inProgressXp: 0 },
        { attribute: 'CON', level: 2, inProgressXp: 150 },
        { attribute: 'INT', level: 1, inProgressXp: 30 },
        { attribute: 'WIS', level: 1, inProgressXp: 10 },
        { attribute: 'CHA', level: 1, inProgressXp: 0 },
      ],
      streak: { currentLength: 3, longestLength: 5 },
      loading: false,
    }),
  ),
}));

jest.mock('@/state/missionsStore', () => ({
  useMissionsStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      active: [],
      recentlyCompleted: [],
      loading: false,
    }),
  ),
}));

import CharacterSheetScreen from '@/ui/screens/CharacterSheetScreen';

describe('CharacterSheetScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the character name', () => {
    const { getByText } = render(<CharacterSheetScreen />);
    expect(getByText('Zara')).toBeTruthy();
  });

  it('renders the streak as "3 days"', () => {
    const { getByText } = render(<CharacterSheetScreen />);
    expect(getByText('3 days')).toBeTruthy();
  });

  it('renders six attribute bars', () => {
    const { getByTestId } = render(<CharacterSheetScreen />);
    expect(getByTestId('attribute-bar-STR')).toBeTruthy();
    expect(getByTestId('attribute-bar-DEX')).toBeTruthy();
    expect(getByTestId('attribute-bar-CON')).toBeTruthy();
    expect(getByTestId('attribute-bar-INT')).toBeTruthy();
    expect(getByTestId('attribute-bar-WIS')).toBeTruthy();
    expect(getByTestId('attribute-bar-CHA')).toBeTruthy();
  });

  it('renders the "+" log FAB button', () => {
    const { getByTestId, getByText } = render(<CharacterSheetScreen />);
    expect(getByTestId('fab-log')).toBeTruthy();
    expect(getByText('+')).toBeTruthy();
  });

  it('navigates to the log entry route when the FAB is pressed', () => {
    const { getByTestId } = render(<CharacterSheetScreen />);
    fireEvent.press(getByTestId('fab-log'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(main)/log');
  });
});
