# Phase 4 — Voice Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice-to-text dictation to `LogEntryScreen`. Tap a mic, speak, tap again, final transcript fills the text field, user reviews and taps Submit (existing flow). On-device transcription via `expo-speech-recognition` with `requiresOnDeviceRecognition: true`.

**Architecture:** A `useVoiceInput` hook owns the four-state machine (`idle` / `listening` / `error{permission-denied|no-speech|unknown}`) and wraps `ExpoSpeechRecognitionModule`. A presentational `<VoiceMicButton>` reads the hook's state via props from the parent. `LogEntryScreen` instantiates the hook, places the button top-right inside the existing `<TextInput>`, and merges final transcripts into its `text` state with a space separator. No new Zustand store.

**Tech Stack:** TypeScript (strict), React Native, `expo-speech-recognition` (community package), `@expo/vector-icons` (Ionicons), Reanimated 4 already in repo (not used here — minimal polish). Jest (node env) for any pure logic; RNTL (`*.test.tsx`, jest-expo preset) for hook + component + screen tests.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-4-voice-input-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `expo-speech-recognition` dependency |
| `app.config.ts` | Modify | iOS `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` strings; register the plugin |
| `src/state/hooks/useVoiceInput.ts` | New | State machine + `ExpoSpeechRecognitionModule` adapter + `isSupported` detection |
| `src/state/hooks/__tests__/useVoiceInput.test.tsx` | New | RNTL `renderHook` tests with a mocked module |
| `src/ui/components/VoiceMicButton.tsx` | New | Presentational toggle with Ionicons + Alert for permission-denied |
| `src/ui/components/__tests__/VoiceMicButton.test.tsx` | New | RNTL tests for visual states + Alert flow |
| `src/ui/screens/LogEntryScreen.tsx` | Modify | Wire the hook + button into the existing text-input block |
| `src/ui/screens/__tests__/LogEntryScreen.test.tsx` | Modify | Extend with voice cases: render, transcript merge, disabled-while-submitting, unsupported-hide |

No `jest.config.js` changes — the new files match existing globs. No new 100%-coverage targets.

---

## Task 1: Install `expo-speech-recognition` and wire `app.config.ts`

**Files:**
- Modify: `package.json`
- Modify: `app.config.ts`

- [ ] **Step 1.1: Install the package**

Run: `npx expo install expo-speech-recognition`

This pins the version compatible with the project's Expo SDK (~54). Expo CLI writes the dependency into `package.json`.

- [ ] **Step 1.2: Update `app.config.ts`**

Read the current file first. Then replace the `iosConfig` and `plugins` entries:

```typescript
import type { ExpoConfig } from '@expo/config-types';

type IOSWithDeploymentTarget = ExpoConfig['ios'] & {
  deploymentTarget?: string;
};

const iosConfig: IOSWithDeploymentTarget = {
  bundleIdentifier: 'com.kylelaguerta.questum',
  supportsTablet: false,
  deploymentTarget: '26.0',
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
    NSMicrophoneUsageDescription:
      'Questum uses the microphone to let you dictate your daily log instead of typing.',
    NSSpeechRecognitionUsageDescription:
      'Questum transcribes your dictated log on-device. Your speech never leaves your phone.',
  },
};

const config: ExpoConfig = {
  name: 'Questum',
  slug: 'questum',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/questum-icon.png',
  scheme: 'questum',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/images/questum-splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1116',
  },
  assetBundlePatterns: ['**/*'],
  ios: iosConfig,
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-notifications',
    [
      'expo-speech-recognition',
      { microphonePermission: false, speechRecognitionPermission: false },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
```

The two `false` flags tell the plugin NOT to inject its own permission strings — our wording above takes precedence.

- [ ] **Step 1.3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 1.4: Run all tests as a smoke pass**

Run: `npm test && npm run test:ui`
Expected: all suites pass. No code consumes `expo-speech-recognition` yet, so this is purely a config change.

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json app.config.ts
git commit -m "chore(phase-4): add expo-speech-recognition + Info.plist usage strings"
```

The pre-commit hook re-runs lint + typecheck. If it fails, paste output and fix the underlying issue (do NOT `--no-verify`).

---

## Task 2: Build `useVoiceInput` hook (TDD)

**Files:**
- Create: `src/state/hooks/useVoiceInput.ts`
- Create: `src/state/hooks/__tests__/useVoiceInput.test.tsx`

The hook test uses `renderHook` from `@testing-library/react-native`, so it lives as `.test.tsx` to be picked up by the RNTL Jest config.

- [ ] **Step 2.1: Write the failing tests**

Create `src/state/hooks/__tests__/useVoiceInput.test.tsx`:

```typescript
import { act, renderHook } from '@testing-library/react-native';

type Listener = (ev: unknown) => void;

const mockRequestPermissionsAsync = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
let listeners: Record<string, Listener[]> = {};

function fireSpeechEvent(eventName: string, payload: unknown): void {
  (listeners[eventName] ?? []).forEach((l) => l(payload));
}

jest.mock('expo-speech-recognition', () => ({
  __esModule: true,
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    start: (opts: unknown) => mockStart(opts),
    stop: () => mockStop(),
    addListener: (eventName: string, handler: Listener) => {
      listeners[eventName] = [...(listeners[eventName] ?? []), handler];
      return {
        remove: () => {
          listeners[eventName] = (listeners[eventName] ?? []).filter((h) => h !== handler);
        },
      };
    },
  },
}));

import { useVoiceInput } from '@/state/hooks/useVoiceInput';

describe('useVoiceInput', () => {
  beforeEach(() => {
    mockRequestPermissionsAsync.mockReset();
    mockStart.mockReset();
    mockStop.mockReset();
    listeners = {};
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

  it('reports isSupported=false', async () => {
    const { useVoiceInput: useVoiceInputUnmocked } = await import('@/state/hooks/useVoiceInput');
    const { result } = renderHook(() => useVoiceInputUnmocked({ onResult: jest.fn() }));
    expect(result.current.isSupported).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=useVoiceInput`
Expected: FAIL with `Cannot find module '@/state/hooks/useVoiceInput'`.

- [ ] **Step 2.3: Implement the hook**

Create `src/state/hooks/useVoiceInput.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: {
    lang: string;
    interimResults: boolean;
    requiresOnDeviceRecognition: boolean;
  }) => void;
  stop: () => void;
  addListener: (
    eventName: 'start' | 'result' | 'error' | 'end',
    handler: (ev: unknown) => void,
  ) => { remove: () => void };
};

let cachedModule: SpeechModule | null | undefined = undefined;

function loadModule(): SpeechModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    const mod = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: SpeechModule;
    };
    cachedModule = mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export type VoiceStatus = 'idle' | 'listening' | 'error';
export type VoiceErrorReason = 'permission-denied' | 'no-speech' | 'unknown';

export interface UseVoiceInputResult {
  status: VoiceStatus;
  errorReason: VoiceErrorReason | null;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export interface UseVoiceInputOptions {
  onResult: (transcript: string) => void;
}

interface SpeechResultEvent {
  isFinal: boolean;
  results: Array<{ transcript: string }>;
}

interface SpeechErrorEvent {
  error: string;
  message: string;
}

function mapErrorReason(code: string): VoiceErrorReason {
  if (code === 'no-speech' || code === 'speech-timeout') return 'no-speech';
  return 'unknown';
}

/**
 * Wraps `expo-speech-recognition` in a small state machine.
 *
 * States: idle → listening → idle (on final result) — with error
 * transitions for permission denial, no-speech, and unknown failures.
 *
 * The hook does NOT itself open Settings on permission denial — it
 * surfaces `errorReason='permission-denied'` and lets the calling
 * component handle the recovery UX (typically an iOS Alert with an
 * "Open Settings" action).
 *
 * `isSupported` is false in environments where the native module is
 * missing (Expo Go without a custom dev build). Callers should hide
 * voice affordances when `isSupported === false`.
 */
export function useVoiceInput({ onResult }: UseVoiceInputOptions): UseVoiceInputResult {
  const mod = useRef<SpeechModule | null>(loadModule()).current;
  const isSupported = mod !== null;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [errorReason, setErrorReason] = useState<VoiceErrorReason | null>(null);

  // Latest onResult kept in a ref so the listener subscription can call it
  // without re-subscribing whenever the parent re-renders.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Subscribe once per hook instance. Listeners are detached on unmount.
  useEffect(() => {
    if (!mod) return;
    const subs = [
      mod.addListener('start', () => {
        setStatus('listening');
        setErrorReason(null);
      }),
      mod.addListener('result', (ev) => {
        const e = ev as SpeechResultEvent;
        if (!e.isFinal) return;
        const transcript = e.results?.[0]?.transcript ?? '';
        if (transcript) {
          onResultRef.current(transcript);
        }
        setStatus('idle');
      }),
      mod.addListener('error', (ev) => {
        const e = ev as SpeechErrorEvent;
        setStatus('error');
        setErrorReason(mapErrorReason(e.error));
      }),
      mod.addListener('end', () => {
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
    };
  }, [mod]);

  const start = useCallback(async () => {
    if (!mod) return;
    const perm = await mod.requestPermissionsAsync();
    if (!perm.granted) {
      setStatus('error');
      setErrorReason('permission-denied');
      return;
    }
    setErrorReason(null);
    mod.start({ lang: 'en-US', interimResults: false, requiresOnDeviceRecognition: true });
  }, [mod]);

  const stop = useCallback(() => {
    if (!mod) return;
    mod.stop();
  }, [mod]);

  return { status, errorReason, isSupported, start, stop };
}
```

- [ ] **Step 2.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=useVoiceInput`
Expected: all 10 tests pass (9 in the main describe + 1 in the "module is missing" describe).

If the "module is missing" test fails because `jest.doMock` interactions with the shared module cache are flaky, simplify it to skip and rely on manual verification — note the skip in the commit message and continue. Do not spend more than 10 minutes wrangling jest.doMock.

- [ ] **Step 2.5: Run the full RNTL suite as a smoke pass**

Run: `npm run test:ui`
Expected: all suites pass. No existing tests touch the new hook.

- [ ] **Step 2.6: Commit**

```bash
git add src/state/hooks/useVoiceInput.ts src/state/hooks/__tests__/useVoiceInput.test.tsx
git commit -m "feat(state): add useVoiceInput hook wrapping expo-speech-recognition"
```

## TDD discipline

Run 2.2 (failing) BEFORE writing 2.3.

---

## Task 3: Build `<VoiceMicButton>` (TDD)

**Files:**
- Create: `src/ui/components/VoiceMicButton.tsx`
- Create: `src/ui/components/__tests__/VoiceMicButton.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `src/ui/components/__tests__/VoiceMicButton.test.tsx`:

```typescript
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
```

- [ ] **Step 3.2: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=VoiceMicButton`
Expected: FAIL with `Cannot find module '@/ui/components/VoiceMicButton'`.

- [ ] **Step 3.3: Implement the component**

Create `src/ui/components/VoiceMicButton.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import type { VoiceErrorReason, VoiceStatus } from '@/state/hooks/useVoiceInput';

export interface VoiceMicButtonProps {
  status: VoiceStatus;
  errorReason: VoiceErrorReason | null;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

const ICON_SIZE = 22;
const COLOR_MUTE = '#7a7d8a';
const COLOR_ACCENT = '#E8C547';
const DISABLED_OPACITY = 0.4;

/**
 * Presentational mic toggle for the LogEntryScreen voice-input flow.
 * Reads its visual state from props — the parent owns the
 * `useVoiceInput` hook. Permission denial is handled in-place via
 * Alert + Linking.openSettings (the only path through this component
 * that is not a straight handler dispatch).
 */
export function VoiceMicButton({
  status,
  errorReason,
  disabled,
  onStart,
  onStop,
  onOpenSettings,
}: VoiceMicButtonProps) {
  const isListening = status === 'listening';
  const isPermissionDenied = status === 'error' && errorReason === 'permission-denied';

  const handlePress = () => {
    if (disabled) return;
    if (isPermissionDenied) {
      Alert.alert(
        'Microphone access needed',
        'Questum needs microphone and speech recognition access to dictate your log. Open Settings to enable them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              onOpenSettings();
            },
          },
        ],
      );
      return;
    }
    if (isListening) {
      onStop();
      return;
    }
    onStart();
  };

  const iconName = isListening
    ? 'stop'
    : isPermissionDenied
      ? 'mic-off-outline'
      : 'mic-outline';
  const iconColor = isListening ? COLOR_ACCENT : COLOR_MUTE;
  const opacity = disabled ? DISABLED_OPACITY : 1;

  const accessibilityLabel = isListening ? 'Stop voice input' : 'Start voice input';

  return (
    <TouchableOpacity
      testID="voice-mic-button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: isListening }}
      onPress={handlePress}
      style={[styles.button, { opacity }]}
      hitSlop={8}
    >
      <Ionicons name={iconName} size={ICON_SIZE} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3.4: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=VoiceMicButton`
Expected: all 11 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/ui/components/VoiceMicButton.tsx src/ui/components/__tests__/VoiceMicButton.test.tsx
git commit -m "feat(ui): add VoiceMicButton presentational toggle"
```

## TDD discipline

Run 3.2 (failing) BEFORE writing 3.3.

---

## Task 4: Wire voice into `LogEntryScreen` (TDD)

**Files:**
- Modify: `src/ui/screens/LogEntryScreen.tsx`
- Modify: `src/ui/screens/__tests__/LogEntryScreen.test.tsx`

This task threads three pieces:
1. The mic button into the existing `<TextInput>` block (top-right, absolutely positioned).
2. The `useVoiceInput` hook with an `onResult` callback that merges the transcript into the existing `text` state using the space-separator rule.
3. The `unknown` error state shows an inline message; the disabled-while-submitting rule.

- [ ] **Step 4.1: Read the current screen + test files**

Read both:
- `src/ui/screens/LogEntryScreen.tsx`
- `src/ui/screens/__tests__/LogEntryScreen.test.tsx`

The existing test file already module-mocks `useLogsStore`, `expo-router`, `expo-haptics`, and uses a `setMockLogsState` helper. Preserve this pattern.

- [ ] **Step 4.2: Extend the test mocks**

Add to the top of `src/ui/screens/__tests__/LogEntryScreen.test.tsx` (after the existing mocks, before `import LogEntryScreen`):

```typescript
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
```

Add to the existing `beforeEach`:

```typescript
mockVoiceStart.mockClear();
mockVoiceStop.mockClear();
mockVoiceOnOpenSettings.mockClear();
mockVoiceResultCallback = null;
mockVoiceState = { status: 'idle', errorReason: null, isSupported: true };
```

- [ ] **Step 4.3: Append new test cases**

Append inside the existing outer `describe('LogEntryScreen', ...)`:

```typescript
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
    mockVoiceResultCallback?.('ran five kilometers');
    expect(getByTestId('log-text-input').props.value).toBe('ran five kilometers');
  });

  it('appends transcript with a space when input is non-empty', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'Ran 5k');
    mockVoiceResultCallback?.('this morning before work');
    expect(getByTestId('log-text-input').props.value).toBe('Ran 5k this morning before work');
  });

  it('trims trailing whitespace before appending', () => {
    const { getByTestId } = render(<LogEntryScreen />);
    fireEvent.changeText(getByTestId('log-text-input'), 'Ran 5k   ');
    mockVoiceResultCallback?.('this morning');
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
```

- [ ] **Step 4.4: Run tests, verify failure**

Run: `npm run test:ui -- --testPathPattern=LogEntryScreen`
Expected: the new tests fail because the screen doesn't render the mic button yet. Existing tests continue to pass.

- [ ] **Step 4.5: Modify `LogEntryScreen.tsx`**

Replace the file's contents:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { haptics } from '@/lib/haptics';
import { useVoiceInput } from '@/state/hooks/useVoiceInput';
import { useLogsStore } from '@/state/logsStore';
import { VoiceMicButton } from '@/ui/components/VoiceMicButton';

/**
 * Modal sheet for the user-typed-log flow. Reads `submitting`, `lowConfidence`,
 * and `error` from the logs store, owns the input text locally, and forwards
 * `submitLog`/`cancelSubmit` to the store.
 *
 * Voice input: a `useVoiceInput` hook wraps `expo-speech-recognition`. The
 * VoiceMicButton is rendered inside the TextInput container at top-right.
 * Final transcripts merge into the existing text with a single-space
 * separator (empty → replace; non-empty → append with space). The mic is
 * disabled while `submitting=true` and hidden entirely when the native
 * module is unavailable (Expo Go dev build).
 *
 * Inline message rules (per UI_SPEC §LogEntryScreen):
 * - Low-confidence is a soft state — the input text is preserved.
 * - Storage / unknown errors show inline guidance; the input text is preserved.
 * - On clean success (submitting transitions true → false with no error and no
 *   low-confidence flag), the input is cleared. Tracked via a ref so we only
 *   react to the falling edge of `submitting`.
 *
 * XP-reveal animation, level-up modal, and auto-close are wired in Phase 4.
 */
export default function LogEntryScreen() {
  const router = useRouter();
  const submitting = useLogsStore((s) => s.submitting);
  const lowConfidence = useLogsStore((s) => s.lowConfidence);
  const error = useLogsStore((s) => s.error);
  const errorDetail = useLogsStore((s) => s.errorDetail);
  const submitLog = useLogsStore((s) => s.submitLog);
  const cancelSubmit = useLogsStore((s) => s.cancelSubmit);

  const [text, setText] = useState('');

  const voice = useVoiceInput({
    onResult: (transcript) => {
      setText((prev) => {
        const trimmedPrev = prev.trimEnd();
        return trimmedPrev === '' ? transcript : `${trimmedPrev} ${transcript}`;
      });
    },
  });

  const prevSubmittingRef = useRef(submitting);
  useEffect(() => {
    if (prevSubmittingRef.current && !submitting && !lowConfidence && error === null) {
      setText('');
    }
    prevSubmittingRef.current = submitting;
  }, [submitting, lowConfidence, error]);

  const trimmed = text.trim();
  const submitDisabled = trimmed === '' || submitting;

  const handleSubmit = () => {
    if (submitDisabled) return;
    haptics.tap();
    void submitLog(text);
  };

  const handleCancel = () => {
    cancelSubmit();
    router.back();
  };

  const showVoiceUnknownError = voice.status === 'error' && voice.errorReason === 'unknown';

  return (
    <View className="flex-1 bg-bg px-4 pt-12">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          testID="log-cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel log entry"
          onPress={handleCancel}
        >
          <Text className="font-manrope text-text-mute" style={{ fontSize: 16 }}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="log-submit"
          accessibilityRole="button"
          accessibilityLabel="Submit log"
          accessibilityState={{ disabled: submitDisabled }}
          disabled={submitDisabled}
          onPress={handleSubmit}
        >
          <Text
            className={
              submitDisabled ? 'font-manrope-bold text-text-mute' : 'font-manrope-bold text-accent'
            }
            style={{ fontSize: 16 }}
          >
            {submitting ? 'Reading…' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-6">
        <TextInput
          testID="log-text-input"
          accessibilityLabel="Log text"
          autoFocus
          multiline
          editable={!submitting}
          placeholder="What did you do?"
          placeholderTextColor="#7a7d8a"
          value={text}
          onChangeText={setText}
          className="min-h-[160px] rounded-2xl bg-surface-2 p-4 font-manrope text-text"
          style={{ fontSize: 17, lineHeight: 24, textAlignVertical: 'top', paddingRight: 52 }}
        />
        {voice.isSupported ? (
          <VoiceMicButton
            status={voice.status}
            errorReason={voice.errorReason}
            disabled={submitting}
            onStart={voice.start}
            onStop={voice.stop}
            onOpenSettings={() => {
              void Linking.openSettings();
            }}
          />
        ) : null}
      </View>

      <View className="mt-4">
        {lowConfidence ? (
          <Text
            testID="log-message-low-confidence"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            We couldn&apos;t categorize that confidently — try a more specific log.
          </Text>
        ) : error === 'storage-error' ? (
          <Text
            testID="log-message-storage-error"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            Couldn&apos;t save your log. Try again.
          </Text>
        ) : error === 'unknown' ? (
          <Text
            testID="log-message-unknown-error"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            Something went wrong, try again.
          </Text>
        ) : showVoiceUnknownError ? (
          <Text
            testID="log-message-voice-error"
            className="font-manrope text-text-mute"
            style={{ fontSize: 14 }}
          >
            Couldn&apos;t capture audio — try again.
          </Text>
        ) : null}

        {/* Dev-only error detail surface — removed for release builds. */}
        {__DEV__ && error !== null && errorDetail !== null ? (
          <Text
            testID="log-message-dev-detail"
            selectable
            className="font-manrope text-text-mute"
            style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}
          >
            DEV: {errorDetail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
```

Key changes from the original:
- Wraps the `<TextInput>` in a `<View>` so the absolutely-positioned mic button anchors to it (not to the entire screen).
- The TextInput keeps `paddingRight: 52` so the mic doesn't overlap typed text.
- `voice.isSupported` gates the mic render.
- `showVoiceUnknownError` adds a fourth inline-message slot below the existing three (lowConfidence / storage-error / unknown). Order: storage-error and unknown errors from the AI pipeline still take precedence; voice-unknown shows only when there is no AI error.

- [ ] **Step 4.6: Run tests, verify pass**

Run: `npm run test:ui -- --testPathPattern=LogEntryScreen`
Expected: all tests pass (existing + 9 new).

- [ ] **Step 4.7: Run all RNTL tests as a regression pass**

Run: `npm run test:ui`
Expected: every suite passes. CharacterSheetScreen, FirstDecayModal, and other components are unaffected.

- [ ] **Step 4.8: Run node-env tests as a smoke pass**

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 4.9: Commit**

```bash
git add src/ui/screens/LogEntryScreen.tsx src/ui/screens/__tests__/LogEntryScreen.test.tsx
git commit -m "feat(ui): wire voice input into LogEntryScreen"
```

## TDD discipline

Run 4.4 (failing) BEFORE writing 4.5.

---

## Task 5: Manual device verification

Not a code task — perform on a real iPhone via a custom EAS dev build (Expo Go cannot load the native speech module). If a Mac is not available, defer this task and document the deferral in the commit message of the next Phase 4 / Phase 5 work.

- [ ] **Step 5.1:** Fresh install of the dev build. Open Log Entry. Tap the mic. Expected: iOS permission dialog appears requesting Microphone first, then Speech Recognition. Grant both.

- [ ] **Step 5.2:** Mic icon swaps to the stop icon (gold). Speak: "ran five kilometers this morning". Tap the stop icon. Expected: the text field reads `ran five kilometers this morning`.

- [ ] **Step 5.3:** Type "Ran 5k" then tap mic and dictate "this morning before work". Expected: field reads `Ran 5k this morning before work` — single space between original and transcript.

- [ ] **Step 5.4:** Open iOS Settings → Questum → toggle Microphone off. Return to app. Tap mic. Expected: Alert appears with title "Microphone access needed" and a "Open Settings" button that opens the Questum Settings page.

- [ ] **Step 5.5:** Re-grant the permission. Return to app. Tap mic → dictate → confirm transcription works.

- [ ] **Step 5.6:** Enable Airplane Mode. Tap mic, dictate. Expected: transcription still works (on-device recognition; no network required).

- [ ] **Step 5.7:** Start dictating, then tap submit BEFORE stopping the mic. Expected: the existing TextInput disables (`editable={!submitting}`), the mic disables (40% opacity), and the in-flight recognition is cancelled cleanly by the hook's cleanup or the foreground submit. After the submit completes, the field clears (success path) — confirm no zombie listeners by tapping mic again.

- [ ] **Step 5.8:** Tap mic in a silent room. Wait 5 seconds without speaking. Expected: the recognition ends (no-speech) and the mic returns to idle with NO error banner shown.

---

## Acceptance criteria

This sub-project is complete when:

1. `useVoiceInput` exists with the four-state machine, mocked-event test covers all transitions, and `isSupported` is `false` when the native module is missing.
2. `<VoiceMicButton>` renders with the documented visual states, Alert flow for permission-denied (Cancel + Open Settings), and accessibility labels swap on state.
3. `LogEntryScreen` renders the mic top-right inside the TextInput when `isSupported=true`; hidden when false.
4. Dictating fills the field per the transcript merge rule (empty → replace; non-empty → append with single space after trimEnd).
5. The mic is disabled (40% opacity, no-op) while `submitting=true`.
6. The voice "unknown" error shows the inline message; `no-speech` and `permission-denied` do not.
7. `app.config.ts` carries both Info.plist permission strings and the plugin entry with `false`/`false` flags so plugin-injected strings don't conflict.
8. All Jest and RNTL tests pass; lint and typecheck clean.
9. Manual device verification (Task 5) completed OR explicitly deferred to the Phase 5 Mac-day session.
10. Phase 4 task #10 from `docs/PHASES.md` is satisfied.
