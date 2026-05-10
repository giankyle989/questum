import { fireEvent, render } from '@testing-library/react-native';

import type { Character } from '@/storage/repositories/characterRepo';

interface MockCharacterState {
  character: Character | null;
}

interface MockSettingsState {
  notificationsEnabled: boolean;
  decayPaused: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setDecayPaused: (value: boolean) => Promise<void>;
}

const mockSetNotificationsEnabled = jest.fn(async () => {});
const mockSetDecayPaused = jest.fn(async () => {});

const defaultCharacterState: MockCharacterState = {
  character: {
    id: 1,
    name: 'Zara',
    avatarId: 'avatar_1',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
};

const defaultSettingsState: MockSettingsState = {
  notificationsEnabled: false,
  decayPaused: false,
  aiSourceLastUsed: 'mock',
  setNotificationsEnabled: mockSetNotificationsEnabled,
  setDecayPaused: mockSetDecayPaused,
};

let mockCharacterState: MockCharacterState = { ...defaultCharacterState };
let mockSettingsState: MockSettingsState = { ...defaultSettingsState };

jest.mock('@/state/characterStore', () => ({
  useCharacterStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockCharacterState)),
}));

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockSettingsState)),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));

import SettingsScreen from '@/ui/screens/SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockSetNotificationsEnabled.mockClear();
    mockSetDecayPaused.mockClear();
    mockCharacterState = {
      character: defaultCharacterState.character ? { ...defaultCharacterState.character } : null,
    };
    mockSettingsState = {
      ...defaultSettingsState,
      setNotificationsEnabled: mockSetNotificationsEnabled,
      setDecayPaused: mockSetDecayPaused,
    };
  });

  it('renders the character name from characterStore', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Zara')).toBeTruthy();
  });

  it('renders "Mock (development)" as the AI source label', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Mock (development)')).toBeTruthy();
  });

  it('renders the Notifications switch and toggling it calls setNotificationsEnabled', () => {
    const { getByTestId } = render(<SettingsScreen />);
    const switchEl = getByTestId('settings-notifications-switch');
    expect(switchEl).toBeTruthy();
    fireEvent(switchEl, 'valueChange', true);
    expect(mockSetNotificationsEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetNotificationsEnabled).toHaveBeenCalledWith(true);
  });

  it('renders the Decay switch and toggling it calls setDecayPaused', () => {
    const { getByTestId } = render(<SettingsScreen />);
    const switchEl = getByTestId('settings-decay-switch');
    expect(switchEl).toBeTruthy();
    fireEvent(switchEl, 'valueChange', true);
    expect(mockSetDecayPaused).toHaveBeenCalledTimes(1);
    expect(mockSetDecayPaused).toHaveBeenCalledWith(true);
  });

  it('renders the app version string from expo-constants', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('0.1.0')).toBeTruthy();
  });
});
