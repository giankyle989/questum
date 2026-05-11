import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockCharacterState: {
  character: { id: number; name: string; avatarId: string; createdAt: string } | null;
  attributeStates: Array<{ attribute: string; level: number; inProgressXp: number }>;
  streak: { currentLength: number; longestLength: number };
  decayedAttributesToday: string[];
  loading: boolean;
};

const defaultCharacterState = {
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
  decayedAttributesToday: [],
  loading: false,
};

mockCharacterState = { ...defaultCharacterState };

jest.mock('@/state/characterStore', () => ({
  useCharacterStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockCharacterState)),
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

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
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

const mockSetFirstDecayShown = jest.fn().mockResolvedValue(undefined);

let mockSettingsState: {
  firstDecayShown: boolean;
  setFirstDecayShown: jest.Mock;
};

const defaultSettingsState = {
  firstDecayShown: false,
  setFirstDecayShown: mockSetFirstDecayShown,
};

mockSettingsState = { ...defaultSettingsState };

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockSettingsState)),
}));

import CharacterSheetScreen from '@/ui/screens/CharacterSheetScreen';

describe('CharacterSheetScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetFirstDecayShown.mockClear();
    mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
    mockSettingsState = { ...defaultSettingsState };
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

  describe('FAB haptics', () => {
    beforeEach(() => {
      mockImpactAsync.mockClear();
      mockAvailabilityState = { available: true, displayName: 'Mock (development)' };
    });

    it('fires a light impact on FAB press when AI is available', () => {
      const { getByTestId } = render(<CharacterSheetScreen />);
      fireEvent.press(getByTestId('fab-log'));
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith('light');
    });

    it('does NOT fire haptics on disabled FAB press', () => {
      mockAvailabilityState = { available: false, displayName: 'Mock (development)' };
      const { getByTestId } = render(<CharacterSheetScreen />);
      fireEvent.press(getByTestId('fab-log'));
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });
  });

  describe('FirstDecayModal trigger', () => {
    beforeEach(() => {
      mockSetFirstDecayShown.mockClear();
    });

    it('renders the modal when firstDecayShown=false AND decayedAttributesToday is non-empty', () => {
      mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
      mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
      const { getByTestId } = render(<CharacterSheetScreen />);
      expect(getByTestId('first-decay-modal')).toBeTruthy();
    });

    it('does NOT render the modal when firstDecayShown=true', () => {
      mockSettingsState = { ...defaultSettingsState, firstDecayShown: true };
      mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
      const { queryByTestId } = render(<CharacterSheetScreen />);
      expect(queryByTestId('first-decay-modal')).toBeNull();
    });

    it('does NOT render the modal when decayedAttributesToday is empty', () => {
      mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
      mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
      const { queryByTestId } = render(<CharacterSheetScreen />);
      expect(queryByTestId('first-decay-modal')).toBeNull();
    });

    it('dismissing the modal calls setFirstDecayShown(true)', () => {
      mockSettingsState = { ...defaultSettingsState, firstDecayShown: false };
      mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: ['STR'] };
      const { getByTestId } = render(<CharacterSheetScreen />);
      fireEvent.press(getByTestId('first-decay-modal-dismiss'));
      expect(mockSetFirstDecayShown).toHaveBeenCalledWith(true);
    });
  });

  describe('Decay shimmer wiring', () => {
    it('passes decayedToday=true to bars in decayedAttributesToday', () => {
      mockCharacterState = {
        ...defaultCharacterState,
        decayedAttributesToday: ['STR', 'CON'],
      };
      const { getByTestId } = render(<CharacterSheetScreen />);
      // The shimmer overlay testID is `attribute-bar-shimmer-<ATTR>` per AttributeBar.
      expect(getByTestId('attribute-bar-shimmer-STR')).toBeTruthy();
      expect(getByTestId('attribute-bar-shimmer-CON')).toBeTruthy();
    });

    it('does NOT render shimmer for bars not in decayedAttributesToday', () => {
      mockCharacterState = {
        ...defaultCharacterState,
        decayedAttributesToday: ['STR'],
      };
      const { queryByTestId } = render(<CharacterSheetScreen />);
      expect(queryByTestId('attribute-bar-shimmer-DEX')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
    });

    it('does NOT render any shimmer when decayedAttributesToday is empty', () => {
      mockCharacterState = { ...defaultCharacterState, decayedAttributesToday: [] };
      const { queryByTestId } = render(<CharacterSheetScreen />);
      expect(queryByTestId('attribute-bar-shimmer-STR')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-DEX')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-CON')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-INT')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-WIS')).toBeNull();
      expect(queryByTestId('attribute-bar-shimmer-CHA')).toBeNull();
    });
  });
});
