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
    // Optional native module: require() lets us swallow the absence in
    // Expo Go (where expo-speech-recognition isn't linked) and surface
    // isSupported=false to the caller. A static `import` would crash the
    // bundle there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // `loadModule()` is itself memoized via `cachedModule` at module scope, so
  // calling it on every render is constant-time and returns a stable
  // reference. We deliberately avoid `useRef(loadModule()).current` here
  // (which would trip ESLint's react-hooks/refs rule because reading
  // `.current` during render is brittle) and avoid `useState(loadModule)`
  // (which lints fine but pretends the module is reactive — it isn't).
  const mod = loadModule();
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
