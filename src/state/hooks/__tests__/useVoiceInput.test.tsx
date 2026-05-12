import { act, renderHook } from '@testing-library/react-native';

type Listener = (ev: unknown) => void;

const mockRequestPermissionsAsync = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
let mockListeners: Record<string, Listener[]> = {};

function fireSpeechEvent(eventName: string, payload: unknown): void {
  (mockListeners[eventName] ?? []).forEach((l) => l(payload));
}

jest.mock('expo-speech-recognition', () => ({
  __esModule: true,
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    start: (opts: unknown) => mockStart(opts),
    stop: () => mockStop(),
    addListener: (eventName: string, handler: Listener) => {
      mockListeners[eventName] = [...(mockListeners[eventName] ?? []), handler];
      return {
        remove: () => {
          mockListeners[eventName] = (mockListeners[eventName] ?? []).filter((h) => h !== handler);
        },
      };
    },
  },
}));

import { useVoiceInput } from '@/state/hooks/useVoiceInput';
import type * as VoiceInputModule from '@/state/hooks/useVoiceInput';

describe('useVoiceInput', () => {
  beforeEach(() => {
    mockRequestPermissionsAsync.mockReset();
    mockStart.mockReset();
    mockStop.mockReset();
    mockListeners = {};
  });

  it('starts in idle state and reports isSupported=true when the module is present', () => {
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    expect(result.current.status).toBe('idle');
    expect(result.current.errorReason).toBeNull();
    expect(result.current.isSupported).toBe(true);
  });

  it('transitions to listening after start() resolves with granted permissions', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    expect(result.current.status).toBe('listening');
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-US',
        interimResults: false,
        requiresOnDeviceRecognition: true,
      }),
    );
  });

  it('transitions to error/permission-denied when permission is not granted', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorReason).toBe('permission-denied');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('fires onResult once with the final transcript and returns to idle', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    act(() =>
      fireSpeechEvent('result', {
        isFinal: true,
        results: [{ transcript: 'ran five kilometers' }],
      }),
    );
    act(() => fireSpeechEvent('end', {}));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('ran five kilometers');
    expect(result.current.status).toBe('idle');
  });

  it('ignores non-final result events', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    act(() =>
      fireSpeechEvent('result', {
        isFinal: false,
        results: [{ transcript: 'ran' }],
      }),
    );
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.status).toBe('listening');
  });

  it('maps no-speech / speech-timeout errors to reason="no-speech"', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    act(() => fireSpeechEvent('error', { error: 'no-speech', message: '' }));
    expect(result.current.status).toBe('error');
    expect(result.current.errorReason).toBe('no-speech');
  });

  it('maps unknown errors to reason="unknown"', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    act(() => fireSpeechEvent('error', { error: 'audio-capture', message: 'mic busy' }));
    expect(result.current.status).toBe('error');
    expect(result.current.errorReason).toBe('unknown');
  });

  it('stop() calls module.stop() and is idempotent', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    act(() => result.current.stop());
    act(() => result.current.stop());
    expect(mockStop).toHaveBeenCalledTimes(2);
  });

  it('removes every listener on unmount', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onResult = jest.fn();
    const { result, unmount } = renderHook(() => useVoiceInput({ onResult }));
    await act(async () => {
      await result.current.start();
    });
    act(() => fireSpeechEvent('start', {}));
    unmount();
    act(() =>
      fireSpeechEvent('result', { isFinal: true, results: [{ transcript: 'late event' }] }),
    );
    expect(onResult).not.toHaveBeenCalled();
  });
});

describe('useVoiceInput when module is missing', () => {
  beforeAll(() => {
    jest.resetModules();
    jest.doMock('expo-speech-recognition', () => ({ __esModule: true }));
  });

  afterAll(() => {
    jest.dontMock('expo-speech-recognition');
    jest.resetModules();
  });

  // Skipped per the plan's escape hatch: `jest.resetModules()` causes the
  // freshly-required hook to load a separate React copy from the one
  // `renderHook` uses, producing "Cannot read properties of null (reading
  // 'useRef')" no matter how the hook is imported (dynamic import() or
  // require()). The isSupported=false branch is manually verifiable: it
  // returns false whenever `ExpoSpeechRecognitionModule` is absent. The
  // calling component (LogEntryScreen) hides voice affordances when
  // isSupported is false, and the integration test there exercises both
  // paths via a different mocking strategy.
  it.skip('reports isSupported=false', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/state/hooks/useVoiceInput') as typeof VoiceInputModule;
    const useVoiceInputUnmocked = mod.useVoiceInput;
    const { result } = renderHook(() => useVoiceInputUnmocked({ onResult: jest.fn() }));
    expect(result.current.isSupported).toBe(false);
  });
});
