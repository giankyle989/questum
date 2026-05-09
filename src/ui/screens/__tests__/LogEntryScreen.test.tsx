import { fireEvent, render } from '@testing-library/react-native';

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
});
