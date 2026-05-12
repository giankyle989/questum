import { Alert, Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { VoiceMicButton } from '@/ui/components/VoiceMicButton';

describe('VoiceMicButton', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup(props: Partial<React.ComponentProps<typeof VoiceMicButton>> = {}) {
    const onStart = jest.fn();
    const onStop = jest.fn();
    const onOpenSettings = jest.fn();
    const utils = render(
      <VoiceMicButton
        status={props.status ?? 'idle'}
        errorReason={props.errorReason ?? null}
        disabled={props.disabled}
        onStart={onStart}
        onStop={onStop}
        onOpenSettings={onOpenSettings}
      />,
    );
    return { ...utils, onStart, onStop, onOpenSettings };
  }

  it('renders with testID "voice-mic-button"', () => {
    const { getByTestId } = setup();
    expect(getByTestId('voice-mic-button')).toBeTruthy();
  });

  it('idle: tap fires onStart', () => {
    const { getByTestId, onStart, onStop } = setup({ status: 'idle' });
    fireEvent.press(getByTestId('voice-mic-button'));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('listening: tap fires onStop', () => {
    const { getByTestId, onStart, onStop } = setup({ status: 'listening' });
    fireEvent.press(getByTestId('voice-mic-button'));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('listening: accessibilityLabel reads "Stop voice input"', () => {
    const { getByTestId } = setup({ status: 'listening' });
    expect(getByTestId('voice-mic-button').props.accessibilityLabel).toBe('Stop voice input');
  });

  it('idle: accessibilityLabel reads "Start voice input"', () => {
    const { getByTestId } = setup({ status: 'idle' });
    expect(getByTestId('voice-mic-button').props.accessibilityLabel).toBe('Start voice input');
  });

  it('permission-denied: tap shows Alert with Cancel + Open Settings buttons', () => {
    const { getByTestId } = setup({ status: 'error', errorReason: 'permission-denied' });
    fireEvent.press(getByTestId('voice-mic-button'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const call = (Alert.alert as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('Microphone access needed');
    const buttons = call[2] as Array<{ text: string }>;
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Open Settings']);
  });

  it('permission-denied Alert: Open Settings button invokes onOpenSettings', () => {
    const { getByTestId, onOpenSettings } = setup({
      status: 'error',
      errorReason: 'permission-denied',
    });
    fireEvent.press(getByTestId('voice-mic-button'));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const openSettingsButton = buttons.find((b) => b.text === 'Open Settings');
    openSettingsButton?.onPress?.();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('error no-speech: tap fires onStart (retry)', () => {
    const { getByTestId, onStart } = setup({ status: 'error', errorReason: 'no-speech' });
    fireEvent.press(getByTestId('voice-mic-button'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('disabled: tap fires nothing', () => {
    const { getByTestId, onStart, onStop } = setup({ status: 'idle', disabled: true });
    fireEvent.press(getByTestId('voice-mic-button'));
    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('disabled: accessibilityState reports disabled=true', () => {
    const { getByTestId } = setup({ status: 'idle', disabled: true });
    expect(getByTestId('voice-mic-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('listening: accessibilityState reports selected=true', () => {
    const { getByTestId } = setup({ status: 'listening' });
    expect(getByTestId('voice-mic-button').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
