import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

const mockCreateCharacter = jest.fn(async () => {});
const mockSubmitLog = jest.fn(async () => {});
const mockCancelSubmit = jest.fn();
const mockSetOnboardingComplete = jest.fn(async () => {});

interface MockCharacterState {
  createCharacter: typeof mockCreateCharacter;
}

interface MockLogsState {
  submitting: boolean;
  lowConfidence: boolean;
  error: 'storage-error' | 'unknown' | null;
  errorDetail: string | null;
  submitLog: typeof mockSubmitLog;
  cancelSubmit: typeof mockCancelSubmit;
}

interface MockSettingsState {
  setOnboardingComplete: typeof mockSetOnboardingComplete;
}

const defaultCharacterState: MockCharacterState = {
  createCharacter: mockCreateCharacter,
};

const defaultLogsState: MockLogsState = {
  submitting: false,
  lowConfidence: false,
  error: null,
  errorDetail: null,
  submitLog: mockSubmitLog,
  cancelSubmit: mockCancelSubmit,
};

const defaultSettingsState: MockSettingsState = {
  setOnboardingComplete: mockSetOnboardingComplete,
};

let mockCharacterState: MockCharacterState = { ...defaultCharacterState };
let mockLogsState: MockLogsState = { ...defaultLogsState };
let mockSettingsState: MockSettingsState = { ...defaultSettingsState };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

jest.mock('@/state/characterStore', () => {
  const useCharacterStore = jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockCharacterState),
  ) as jest.Mock & { getState: () => MockCharacterState };
  useCharacterStore.getState = () => mockCharacterState;
  return { useCharacterStore };
});

jest.mock('@/state/logsStore', () => {
  const useLogsStore = jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockLogsState),
  ) as jest.Mock & { getState: () => MockLogsState };
  useLogsStore.getState = () => mockLogsState;
  return { useLogsStore };
});

jest.mock('@/state/settingsStore', () => {
  const useSettingsStore = jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockSettingsState),
  ) as jest.Mock & { getState: () => MockSettingsState };
  useSettingsStore.getState = () => mockSettingsState;
  return { useSettingsStore };
});

import AIConfirmScreen from '@/ui/screens/onboarding/AIConfirmScreen';
import CharacterCreationScreen from '@/ui/screens/onboarding/CharacterCreationScreen';
import FirstLogScreen from '@/ui/screens/onboarding/FirstLogScreen';

function setLogsState(partial: Partial<MockLogsState>): void {
  mockLogsState = { ...defaultLogsState, ...partial };
}

describe('AIConfirmScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  it('renders the on-device privacy note and Continue navigates to creation', () => {
    const { getByTestId, getByText } = render(<AIConfirmScreen />);
    expect(getByText(/Your logs stay on your device/i)).toBeTruthy();
    expect(getByText(/No data leaves your phone/i)).toBeTruthy();

    fireEvent.press(getByTestId('ai-confirm-continue'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/onboarding/creation');
  });
});

describe('CharacterCreationScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockCreateCharacter.mockClear();
    mockCharacterState = { ...defaultCharacterState };
  });

  it('disables Create Character on empty name; enables after typing; create + navigate on press', async () => {
    const { getByTestId } = render(<CharacterCreationScreen />);

    const button = getByTestId('character-create-button');
    expect(button).toBeDisabled();

    fireEvent.changeText(getByTestId('character-name-input'), 'Zara');
    expect(getByTestId('character-create-button')).not.toBeDisabled();

    await act(async () => {
      fireEvent.press(getByTestId('character-create-button'));
    });

    expect(mockCreateCharacter).toHaveBeenCalledTimes(1);
    expect(mockCreateCharacter).toHaveBeenCalledWith('Zara', 'avatar_1');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/first-log');
  });
});

describe('FirstLogScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSetOnboardingComplete.mockClear();
    mockSubmitLog.mockClear();
    mockLogsState = { ...defaultLogsState };
    mockSettingsState = { ...defaultSettingsState };
  });

  it('shows the low-confidence inline message and preserves the input value', () => {
    setLogsState({ lowConfidence: true });
    const { getByTestId, getByText } = render(<FirstLogScreen />);

    fireEvent.changeText(getByTestId('first-log-text-input'), 'did the thing');
    expect(getByText(/couldn't categorize/i)).toBeTruthy();
    expect(getByTestId('first-log-text-input').props.value).toBe('did the thing');
  });

  it('completes onboarding and replaces with /(main)/character on successful submit', async () => {
    setLogsState({ submitting: true });
    const { rerender } = render(<FirstLogScreen />);

    // Falling edge: submitting transitions true → false with no error and no
    // low-confidence flag, which is exactly the "clean success" branch that
    // FirstLogScreen treats as "first log accepted, finish onboarding".
    setLogsState({ submitting: false });
    await act(async () => {
      rerender(<FirstLogScreen />);
    });

    expect(mockSetOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(mockSetOnboardingComplete).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(main)/character');
  });
});
