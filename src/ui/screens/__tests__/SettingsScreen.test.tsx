import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import type { Character } from '@/storage/repositories/characterRepo';

interface MockCharacterState {
  character: Character | null;
}

interface MockSettingsState {
  notificationsEnabled: boolean;
  decayPaused: boolean;
  aiSourceLastUsed: 'apple' | 'gemini' | 'mock' | 'none';
  setNotificationsEnabled: (value: boolean) => Promise<{ permissionDenied: boolean }>;
  setDecayPaused: (value: boolean) => Promise<void>;
  devForceAIUnavailable: boolean;
  setDevForceAIUnavailable: (value: boolean) => Promise<void>;
  notificationMorningTime: string;
  setNotificationMorningTime: (value: string) => Promise<void>;
  inactivityNudgeEnabled: boolean;
  setInactivityNudgeEnabled: (value: boolean) => Promise<void>;
}

const mockSetNotificationsEnabled = jest.fn().mockResolvedValue({ permissionDenied: false });
const mockSetDecayPaused = jest.fn(async () => {});
const mockSetDevForceAIUnavailable = jest.fn(async () => {});
const mockSetNotificationMorningTime = jest.fn().mockResolvedValue(undefined);
const mockSetInactivityNudgeEnabled = jest.fn().mockResolvedValue(undefined);

const mockFireTestDaily = jest.fn().mockResolvedValue(undefined);
const mockFireTestNudge = jest.fn().mockResolvedValue(undefined);
jest.mock('@/notifications/notifications', () => ({
  fireTestDaily: () => mockFireTestDaily(),
  fireTestNudge: () => mockFireTestNudge(),
}));

// NativeWind's Babel plugin injects `_ReactNativeCSSInterop` at file scope.
// jest.mock factory functions are hoisted before that injection, so any factory
// that calls require('react-native') or uses JSX will fail with
// "Invalid variable access: _ReactNativeCSSInterop".
// Work-around: export a named spy from inside the factory so we can
// configure its implementation at runtime (in beforeEach) where NativeWind
// interop is fully initialised.
const mockDateTimePicker = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  // Return null by default; individual tests configure via mockImplementation.
  default: jest.fn().mockReturnValue(null),
}));

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
  devForceAIUnavailable: false,
  setDevForceAIUnavailable: mockSetDevForceAIUnavailable,
  notificationMorningTime: '08:00',
  setNotificationMorningTime: mockSetNotificationMorningTime,
  inactivityNudgeEnabled: false,
  setInactivityNudgeEnabled: mockSetInactivityNudgeEnabled,
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

const mockRunProbe = jest.fn(async () => {});
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: {
    getState: () => ({ runProbe: mockRunProbe }),
  },
}));

import DateTimePickerMock from '@react-native-community/datetimepicker';
import { View } from 'react-native';

import SettingsScreen from '@/ui/screens/SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockSetNotificationsEnabled.mockClear();
    mockSetDecayPaused.mockClear();
    mockSetDevForceAIUnavailable.mockClear();
    mockSetNotificationMorningTime.mockClear();
    mockSetInactivityNudgeEnabled.mockClear();
    mockFireTestDaily.mockClear();
    mockFireTestNudge.mockClear();
    mockDateTimePicker.mockClear();
    mockRunProbe.mockClear();
    // Configure the DateTimePicker mock to render a View with the testID.
    // This runs at test setup (not at jest.mock hoist time), so react-native is safe to use.
    (DateTimePickerMock as jest.Mock).mockImplementation((props: Record<string, unknown>) => {
      mockDateTimePicker(props);
      return React.createElement(View, { testID: 'datetimepicker' });
    });
    mockCharacterState = {
      character: defaultCharacterState.character ? { ...defaultCharacterState.character } : null,
    };
    mockSettingsState = {
      ...defaultSettingsState,
      setNotificationsEnabled: mockSetNotificationsEnabled,
      setDecayPaused: mockSetDecayPaused,
      setDevForceAIUnavailable: mockSetDevForceAIUnavailable,
      setNotificationMorningTime: mockSetNotificationMorningTime,
      setInactivityNudgeEnabled: mockSetInactivityNudgeEnabled,
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

  describe('Developer — Force AI unavailable', () => {
    it('renders the toggle in __DEV__', () => {
      const { getByTestId } = render(<SettingsScreen />);
      expect(getByTestId('settings-dev-force-ai-unavailable')).toBeTruthy();
    });

    it('flipping the toggle persists the value and re-runs the probe', async () => {
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent(getByTestId('settings-dev-force-ai-unavailable'), 'valueChange', true);
      // Wait one microtask for the async onValueChange handler to flush.
      await Promise.resolve();
      await Promise.resolve();
      expect(mockSetDevForceAIUnavailable).toHaveBeenCalledTimes(1);
      expect(mockSetDevForceAIUnavailable).toHaveBeenCalledWith(true);
      expect(mockRunProbe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notifications — morning time and nudge', () => {
    it('renders the morning time row in disabled state when notifications are off', () => {
      const { getByTestId } = render(<SettingsScreen />);
      const row = getByTestId('settings-morning-time-row');
      expect(row.props.accessibilityState?.disabled).toBe(true);
    });

    it('renders the morning time row enabled when notifications are on', () => {
      mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
      const { getByTestId } = render(<SettingsScreen />);
      const row = getByTestId('settings-morning-time-row');
      expect(row.props.accessibilityState?.disabled).toBe(false);
    });

    it('tapping the enabled morning time row opens the picker', () => {
      mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
      const { getByTestId, queryByTestId } = render(<SettingsScreen />);
      expect(queryByTestId('datetimepicker')).toBeNull();
      fireEvent.press(getByTestId('settings-morning-time-row'));
      expect(getByTestId('datetimepicker')).toBeTruthy();
    });

    it('renders the inactivity nudge toggle disabled when notifications are off', () => {
      const { getByTestId } = render(<SettingsScreen />);
      const switchEl = getByTestId('settings-inactivity-nudge-switch');
      expect(switchEl.props.disabled).toBe(true);
    });

    it('flipping the inactivity nudge toggle calls setInactivityNudgeEnabled', () => {
      mockSettingsState = { ...mockSettingsState, notificationsEnabled: true };
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent(getByTestId('settings-inactivity-nudge-switch'), 'valueChange', true);
      expect(mockSetInactivityNudgeEnabled).toHaveBeenCalledWith(true);
    });

    it('shows the permission-denied label when setNotificationsEnabled returns permissionDenied: true', async () => {
      mockSetNotificationsEnabled.mockResolvedValueOnce({ permissionDenied: true });
      const { getByTestId, queryByTestId } = render(<SettingsScreen />);
      expect(queryByTestId('settings-notifications-permission-denied')).toBeNull();
      await act(async () => {
        fireEvent(getByTestId('settings-notifications-switch'), 'valueChange', true);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getByTestId('settings-notifications-permission-denied')).toBeTruthy();
    });
  });

  describe('Developer — notification test buttons', () => {
    it('fires the test daily notification', () => {
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('settings-dev-test-daily'));
      expect(mockFireTestDaily).toHaveBeenCalledTimes(1);
    });

    it('fires the test inactivity nudge', () => {
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('settings-dev-test-nudge'));
      expect(mockFireTestNudge).toHaveBeenCalledTimes(1);
    });
  });
});
