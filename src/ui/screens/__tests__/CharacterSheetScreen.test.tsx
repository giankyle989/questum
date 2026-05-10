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

const mockOpenSettings = jest.fn(async () => {});
jest.mock('expo-linking', () => ({
  __esModule: true,
  openSettings: () => mockOpenSettings(),
}));

interface MockAvailabilityState {
  available: boolean;
  displayName: string;
}
let mockAvailabilityState: MockAvailabilityState = {
  available: true,
  displayName: 'Mock (development)',
};
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockAvailabilityState),
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

  describe('FAB when AI is unavailable', () => {
    beforeEach(() => {
      mockOpenSettings.mockClear();
      mockPush.mockClear();
      mockAvailabilityState = { available: false, displayName: 'Mock (development)' };
    });

    afterEach(() => {
      mockAvailabilityState = { available: true, displayName: 'Mock (development)' };
    });

    it('exposes accessibilityState.disabled = true', () => {
      const { getByTestId } = render(<CharacterSheetScreen />);
      const fab = getByTestId('fab-log');
      expect(fab.props.accessibilityState?.disabled).toBe(true);
    });

    it('opens system Settings on tap, does not navigate to /log', () => {
      const { getByTestId } = render(<CharacterSheetScreen />);
      fireEvent.press(getByTestId('fab-log'));
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
