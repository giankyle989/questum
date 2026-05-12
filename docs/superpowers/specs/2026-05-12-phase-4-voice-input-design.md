# Phase 4 — Sub-project 6: Voice Input

**Date:** 2026-05-12
**Phase:** 4 (Polish) — closes out Phase 4 alongside the App Store listing draft.
**Scope:** Add voice-to-text dictation to the existing `LogEntryScreen` text input. Phase 4 task #10 per `docs/PHASES.md`. The Log Entry surface already accepts typed input; voice is an alternate input method that fills the same `text` state and uses the existing Submit flow.

## Goal

Let the user dictate a log instead of typing. Tap the mic, speak, tap the mic again, see the transcript in the input field, edit if needed, tap Submit. The downstream AI / XP / mission flow is unchanged.

## Non-goals

- **Voice-driven submit.** The user always reviews the transcript and taps Submit explicitly. Speech mishears would otherwise turn into wrong logs with no chance to correct.
- **Live / interim transcription UI.** No streaming text appearing as the user speaks. Final transcript only.
- **Waveform / pulse / animated mic.** Minimal polish — mic icon toggles color between idle and listening, nothing else.
- **Voice anywhere outside `LogEntryScreen`.** Not on Missions, not in Settings, not for editing existing logs.
- **Locales other than en-US.** A locale setting is post-MVP; an English-only launch is acceptable.
- **Voice as a standalone screen or modal-over-modal.** The listening state lives in-place on the existing screen.

## Architecture

### File layout

```
src/state/hooks/useVoiceInput.ts                       NEW
src/state/hooks/__tests__/useVoiceInput.test.ts        NEW
src/ui/components/VoiceMicButton.tsx                   NEW
src/ui/components/__tests__/VoiceMicButton.test.tsx    NEW
src/ui/screens/LogEntryScreen.tsx                      MODIFY (mic placement + transcript merge)
src/ui/screens/__tests__/LogEntryScreen.test.tsx       MODIFY (extend with voice cases)
app.config.ts                                          MODIFY (Info.plist + plugin entry)
package.json                                           MODIFY (add expo-speech-recognition)
docs/superpowers/specs/2026-05-12-phase-4-voice-input-design.md   NEW (this spec)
docs/superpowers/plans/2026-05-12-phase-4-voice-input.md          NEW (impl plan)
```

No new Zustand store. Voice state is component-scoped via the hook. The existing `logsStore` only ever sees a `text` value at submit time — same as keyboard-typed input.

### Library

`expo-speech-recognition` (community package by jamsch). This is what CLAUDE.md's tech stack refers to and the only viable choice that works with Expo's managed workflow without ejecting. Configured with `requiresOnDeviceRecognition: true` so the transcription happens entirely on the device. This matches the privacy story committed in `docs/STORE_LISTING.md` §4 and §11 caption #6 ("On-device AI. Your logs never leave your phone.").

A custom dev build is required — Expo Go cannot load the native module. The hook's `isSupported` flag returns `false` when the native module is missing, hiding the mic button and leaving the existing keyboard-only flow intact.

### `useVoiceInput` hook

Single state-machine source of truth:

```typescript
type VoiceState =
  | { status: 'idle' }
  | { status: 'listening' }
  | { status: 'error'; reason: 'permission-denied' | 'no-speech' | 'unknown' };

export interface UseVoiceInputResult {
  status: VoiceState['status'];
  errorReason: 'permission-denied' | 'no-speech' | 'unknown' | null;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoiceInput(opts: {
  onResult: (transcript: string) => void;
}): UseVoiceInputResult;
```

**Lifecycle**

1. `start()` calls `ExpoSpeechRecognitionModule.requestPermissionsAsync()`. On denial → `status='error', reason='permission-denied'`. The hook does not itself open Settings; the button does.
2. On grant: `ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, requiresOnDeviceRecognition: true })`.
3. Subscribe to `"start"`, `"result"`, `"error"`, `"end"` events. Transition `status='listening'` on `"start"`.
4. On `"result"` with `isFinal: true`: invoke `opts.onResult(transcript)` once, then transition `idle`.
5. On `"error"`: map iOS error codes — `error.no-speech` / `error.speech-timeout` → `'no-speech'`, everything else → `'unknown'`. Transition error state.
6. `stop()` calls `ExpoSpeechRecognitionModule.stop()`. The final `"result"` is delivered before `"end"` fires; the hook still routes it through `onResult`.
7. Cleanup on unmount: call `stop()` (idempotent) and remove every listener. Aborts in-flight recognition cleanly.

**`isSupported` detection.** At module top-level, dynamically import `ExpoSpeechRecognitionModule`; if the import returns `undefined` or throws (which it does in Expo Go without the native module), set `isSupported = false`. Otherwise `true`. The hook does not crash in environments where the native module is missing.

### `<VoiceMicButton>` component

Pure presentational toggle. Owns no state — reads everything from props the parent passes from the hook.

**Props:**

```typescript
export interface VoiceMicButtonProps {
  status: 'idle' | 'listening' | 'error';
  errorReason: 'permission-denied' | 'no-speech' | 'unknown' | null;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}
```

**Visual states**

| Status | Icon | Color | Tap behavior |
|---|---|---|---|
| idle | `Ionicons name="mic-outline"` | `#7a7d8a` (`text-text-mute`) | `onStart()` |
| listening | `Ionicons name="stop"` | `#E8C547` (`text-accent`) | `onStop()` |
| error / permission-denied | `Ionicons name="mic-off-outline"` | `#7a7d8a` | Show `Alert.alert("Microphone access needed", body, [Cancel, Open Settings])`. The "Open Settings" button invokes `Linking.openSettings()` via `onOpenSettings`. |
| error / no-speech, unknown | `Ionicons name="mic-outline"` (idle look) | `#7a7d8a` | `onStart()` (retry) |
| disabled (any status) | `Ionicons name="mic-outline"` | `#7a7d8a` at 40% opacity | no-op |

**Icon library:** `@expo/vector-icons` (already in `package.json`). Ionicons is the first icon family adopted by the project — other components currently use unicode glyphs (the FAB renders a literal `+`, the FirstDecayModal uses `⏳`). The icon size is 22pt to fit the 36×36 hit box.

**Layout.** Absolutely positioned 36×36 `TouchableOpacity` at `top: 12, right: 12` inside the existing `TextInput` block. The input gets `paddingRight: 52` to keep typed text from running under the button. No animation, no pulse.

**Accessibility:**
- `accessibilityRole="button"`
- `accessibilityLabel` swaps between `"Start voice input"` and `"Stop voice input"`
- `accessibilityState={{ disabled, selected: status === 'listening' }}`
- `testID="voice-mic-button"`

### LogEntryScreen integration

Inside `LogEntryScreen`:

```typescript
const [text, setText] = useState('');
const submitting = useLogsStore((s) => s.submitting);

const voice = useVoiceInput({
  onResult: (transcript) => {
    setText((prev) => {
      const trimmedPrev = prev.trimEnd();
      return trimmedPrev === '' ? transcript : `${trimmedPrev} ${transcript}`;
    });
  },
});
```

**Transcript merging rule.** If the field is empty (after trimEnd), replace. Otherwise append with a single space separator. Example: user types `"Ran 5k"` then dictates `"this morning before work"` → final text `"Ran 5k this morning before work"`. No stomp, no missing space.

**Mic placement.** Inside the existing `<TextInput>` block, top-right. Submit and Cancel header stays where it is.

**Disabled coordination**

| Condition | Mic button | Reason |
|---|---|---|
| `submitting === true` | disabled (40% opacity) | AI is parsing the previous text — can't change input mid-submit. |
| `voice.isSupported === false` | not rendered | Expo Go dev build without the native module. |
| Default | enabled | — |

The existing `TextInput`'s `editable={!submitting}` already locks typing during submit; mic disabled matches.

**Inline error surfacing**

Voice errors do NOT use the existing low-confidence / storage-error message slot.

- `permission-denied` → `Alert.alert` from the button (one-shot, modal, iOS-native).
- `no-speech` → no UI message; button returns to idle. (Speech recognition fires "no-match" on quiet rooms and paused starts; surfacing it would feel naggy.)
- `unknown` → inline `Text` below the input: `"Couldn't capture audio — try again."` Same `text-text-mute` style as the other inline messages. Clears on the next successful start.

### `app.config.ts` changes

```typescript
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
```

Plugin entry:

```typescript
plugins: [
  'expo-router',
  'expo-font',
  'expo-sqlite',
  'expo-notifications',
  ['expo-speech-recognition', { microphonePermission: false, speechRecognitionPermission: false }],
],
```

The two `false` flags tell the plugin NOT to inject its own permission strings; we write them above so the wording stays in our control. The permission strings explicitly promise on-device transcription — keeps the App Review story consistent with the listing draft.

## Testing & verification

| Layer | Approach |
|---|---|
| `useVoiceInput` (Jest, node env) | Mock `expo-speech-recognition` entirely with a hand-rolled event emitter. Fire `start`/`result`/`error`/`end` events through the mock. Assert: state-machine transitions cover idle → listening → idle; `onResult` fires exactly once on final result; `stop()` is idempotent; cleanup removes every listener; permission denial routes to error state with `reason='permission-denied'`. |
| `<VoiceMicButton>` (RNTL) | Render four prop combos (idle / listening / disabled / error-permission-denied). Assert testID, accessibilityLabel swap on state, color class, tap fires correct handler. For permission-denied, spy `Alert.alert` and `Linking.openSettings`. |
| `LogEntryScreen` (RNTL) | Extend existing test file. Mock `useVoiceInput` so the test drives `onResult` directly. Assert: (a) mic renders when `isSupported=true`, (b) mic is absent when `isSupported=false`, (c) transcript merges with existing text using the space rule (empty → replace; non-empty → append with space), (d) mic disabled while `submitting=true`. No real audio. |
| Manual on iPhone | Real dev build (Expo Go can't run this). Walk: first-time permission prompt → grant → dictate → see transcript → submit. Then: deny in Settings → tap mic → Alert → Open Settings opens Questum's settings page. Airplane mode → tap mic → on-device works without network. |

**Coverage targets.** `useVoiceInput.ts` should hit ≥85% line coverage (some native-error mapping branches may be hard to reach without real device events). No coverage target on `VoiceMicButton.tsx` beyond the rendered prop combos.

## Acceptance criteria

This sub-project is complete when:

1. `useVoiceInput` hook exists with the four-state machine, mocked-emitter test passes.
2. `<VoiceMicButton>` renders with the visual / accessibility states described.
3. The mic button appears inside the `LogEntryScreen` TextInput, top-right, when `isSupported=true`.
4. Dictating a log fills the text field per the transcript merge rule and lets the user tap Submit to follow the existing AI / XP flow unchanged.
5. Tapping mic while permission is denied shows the native Alert with an "Open Settings" button.
6. The mic is disabled and visibly so while `submitting=true`.
7. `app.config.ts` has both Info.plist usage descriptions and the plugin entry.
8. All Jest + RNTL tests pass; lint and typecheck clean.
9. Phase 4 task #10 ("Implement voice input (expo-speech-recognition)") in `docs/PHASES.md` is satisfied.

## Risks and open questions

- **`expo-speech-recognition` is community-maintained.** No Expo SDK support contract. If it breaks against a future Expo SDK upgrade, the fix is to upgrade the package, file an issue, or fall back to a custom native module. Acceptable risk for v1.
- **Custom dev build required.** Voice can't be tested in Expo Go. Until a Mac is available for Phase 5, the manual verification step blocks. The hook + button + LogEntryScreen wiring can still be unit-tested and merged.
- **On-device recognition coverage.** iOS supports on-device recognition for a subset of locales; `en-US` is included. Other locales may fall back to network — out of scope since v1 is en-US only.
- **Permission denial after grant.** If the user grants then revokes mic permission in iOS Settings, the hook surfaces `permission-denied` on the next `start()` and the Alert flow handles it. No need for a "permission revoked" state since iOS returns the same error code either way.

## Out of scope (tracked elsewhere)

- **Voice in onboarding's first-log walkthrough.** Phase 6 if at all — onboarding text-only is fine for v1.
- **Editing existing logs via voice.** Editable logs are a post-launch revisit per `docs/PRD.md` §12.
- **Speech-to-AI direct pipe.** Some apps stream voice directly to the LLM. Out of scope — Questum keeps voice as a text-entry method only.
- **Settings toggle to disable voice.** A user who doesn't want voice simply never taps the mic. No toggle needed for v1.
- **Custom EAS dev build steps to validate voice on hardware.** Documented separately as part of Phase 5's Mac-day plan.
