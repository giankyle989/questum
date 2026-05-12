import { act, fireEvent, render } from '@testing-library/react-native';

const mockSubmitLog = jest.fn();
const mockCancelSubmit = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();

interface MockLogsState {
  submitting: boolean;
  lowConfidence: boolean;
  error: 'storage-error' | 'unknown' | null;
  submitLog: typeof mockSubmitLog;
  cancelSubmit: typeof mockCancelSubmit;
}

const defaultState: MockLogsState = {
  submitting: false,
  lowConfidence: false,
  error: null,
  submitLog: mockSubmitLog,
  cancelSubmit: mockCancelSubmit,
};

let mockLogsState: MockLogsState = { ...defaultState };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@/state/logsStore', () => ({
  useLogsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
}));

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mockVoiceStart = jest.fn();
const mockVoiceStop = jest.fn();
const mockVoiceOnOpenSettings = jest.fn();

let mockVoiceResultCallback: ((transcript: string) => void) | null = null;

interface MockVoiceState {
  status: 'idle' | 'listening' | 'error';
  errorReason: 'permission-denied' | 'no-speech' | 'unknown' | null;
  isSupported: boolean;
}

let mockVoiceState: MockVoiceState = {
  status: 'idle',
  errorReason: null,
  isSupported: true,
};

jest.mock('@/state/hooks/useVoiceInput', () => ({
  useVoiceInput: ({ onResult }: { onResult: (t: string) => void }) => {
    mockVoiceResultCallback = onResult;
    return {
      status: mockVoiceState.status,
      errorReason: mockVoiceState.errorReason,
      isSupported: mockVoiceState.isSupported,
      start: mockVoiceStart,
      stop: mockVoiceStop,
    };
  },
}));

import LogEntryScreen from '@/ui/screens/LogEntryScreen';

function setMockLogsState(partial: Partial<MockLogsState>): void {
  mockLogsState = { ...defaultState, ...partial };
}

describe('LogEntryScreen', () => {
  beforeEach(() => {
    mockSubmitLog.mockClear();
    mockCancelSubmit.mockClear();
    mockBack.mockClear();
    mockPush.mockClear();
    mockLogsState = { ...defaultState };
    mockVoiceStart.mockClear();
    mockVoiceStop.mockClear();
    mockVoiceOnOpenSettings.mockClear();
    mockVoiceResultCallback = null;
    mockVoiceState = { status: 'idle', errorReason: null, isSupported: true };
  });

  it('renders text input with the "What did you do?" placeholder', () => {
    const { getByPlaceholderText } = render(<LogEntryScreen />);
    expect(getByPlaceholderText('What did you do?')).toBeTruthy();
  });

  it('disables the submit button when input is empty', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    expect(getByTestId('log-submit')).toBeDisabled();
  });

  it('enables the submit button after typing text', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'ran 5km');
    expect(getByTestId('log-submit')).not.toBeDisabled();
  });

  it('calls submitLog once with the typed text on submit', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'ran 5km this morning');
    fireEvent.press(getByTestId('log-submit'));
    expect(mockSubmitLog).toHaveBeenCalledTimes(1);
    expect(mockSubmitLog).toHaveBeenCalledWith('ran 5km this morning');
  });

  it('does not call submitLog when input is empty', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.press(getByTestId('log-submit'));
    expect(mockSubmitLog).not.toHaveBeenCalled();
  });

  it('disables submit and makes the input read-only while submitting', () => {
    setMockLogsState({ submitting: true });
    const { getByTestId } = render(<LogEntryScreen />);
    expect(getByTestId('log-submit')).toBeDisabled();
    expect(getByTestId('log-text-input').props.editable).toBe(false);
  });

  it('shows the low-confidence inline message and preserves input text', () => {
    setMockLogsState({ lowConfidence: true });
    const { getByTestId, getByText } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'did the thing');
    expect(getByText(/couldn't categorize/i)).toBeTruthy();
    expect(getByTestId('log-text-input').props.value).toBe('did the thing');
  });

  it('shows a "Couldn\'t save" message when error is "storage-error"', () => {
    setMockLogsState({ error: 'storage-error' });
    const { getByText } = render(<LogEntryScreen />);
    expect(getByText(/Couldn't save/)).toBeTruthy();
  });

  it('shows a "went wrong" message when error is "unknown"', () => {
    setMockLogsState({ error: 'unknown' });
    const { getByText } = render(<LogEntryScreen />);
    expect(getByText(/went wrong/)).toBeTruthy();
  });

  describe('submit haptics', () => {
    beforeEach(() => {
      mockImpactAsync.mockClear();
    });

    it('fires a light impact when Submit is pressed with non-empty text', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      fireEvent.changeText(getByTestId('log-text-input'), 'ran 5km');
      fireEvent.press(getByTestId('log-submit'));
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith('light');
    });

    it('does not fire haptics when Submit is disabled', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      fireEvent.press(getByTestId('log-submit'));
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });
  });

  describe('Voice input', () => {
    it('renders the voice mic button when isSupported=true', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      expect(getByTestId('voice-mic-button')).toBeTruthy();
    });

    it('does NOT render the mic button when isSupported=false', () => {
      mockVoiceState = { status: 'idle', errorReason: null, isSupported: false };
      const { queryByTestId } = render(<LogEntryScreen />);
      expect(queryByTestId('voice-mic-button')).toBeNull();
    });

    it('replaces empty input with the transcript on onResult', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      expect(mockVoiceResultCallback).not.toBeNull();
      fireEvent.changeText(getByTestId('log-text-input'), '');
      act(() => {
        mockVoiceResultCallback?.('ran five kilometers');
      });
      expect(getByTestId('log-text-input').props.value).toBe('ran five kilometers');
    });

    it('appends transcript with a space when input is non-empty', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      fireEvent.changeText(getByTestId('log-text-input'), 'Ran 5k');
      act(() => {
        mockVoiceResultCallback?.('this morning before work');
      });
      expect(getByTestId('log-text-input').props.value).toBe('Ran 5k this morning before work');
    });

    it('trims trailing whitespace before appending', () => {
      const { getByTestId } = render(<LogEntryScreen />);
      fireEvent.changeText(getByTestId('log-text-input'), 'Ran 5k   ');
      act(() => {
        mockVoiceResultCallback?.('this morning');
      });
      expect(getByTestId('log-text-input').props.value).toBe('Ran 5k this morning');
    });

    it('disables the mic button while submitting=true', () => {
      setMockLogsState({ submitting: true });
      const { getByTestId } = render(<LogEntryScreen />);
      expect(getByTestId('voice-mic-button').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('shows an inline "Couldn\'t capture audio" message on unknown error', () => {
      mockVoiceState = { status: 'error', errorReason: 'unknown', isSupported: true };
      const { getByTestId } = render(<LogEntryScreen />);
      expect(getByTestId('log-message-voice-error')).toBeTruthy();
    });

    it('does NOT show the voice-error inline message on no-speech', () => {
      mockVoiceState = { status: 'error', errorReason: 'no-speech', isSupported: true };
      const { queryByTestId } = render(<LogEntryScreen />);
      expect(queryByTestId('log-message-voice-error')).toBeNull();
    });

    it('does NOT show the voice-error inline message on permission-denied', () => {
      mockVoiceState = { status: 'error', errorReason: 'permission-denied', isSupported: true };
      const { queryByTestId } = render(<LogEntryScreen />);
      expect(queryByTestId('log-message-voice-error')).toBeNull();
    });
  });
});
