# Phase 4 — Sub-project 4: First-Decay Explainer & Decay-Shimmer Wiring

**Date:** 2026-05-11
**Phase:** 4 (Polish)
**Scope:** Fourth of five Phase 4 sub-projects. Sub-projects 1 (AI factory + availability banner), 2 (animations + haptics), and 3 (local notifications) are already merged.

## Goal

Wire the deferred decay-shimmer animation to live state and ship the one-time first-decay explainer modal:

- Track which attributes had non-zero decay applied during the most recent foreground decay run.
- Thread that set into `<AttributeBar decayedToday>` so the shimmer animation (already built in sub-project 2) actually appears.
- Show a one-time full-screen modal explaining the decay mechanic the first time it applies. Dismissed via an explicit button.

## Non-goals

- **Mission generation algorithm changes.** The PHASES.md Phase-4 task "weighted toward weak attributes" is already met by `threeLowestAttributes` (daily) and `lowestAttribute` (weekly) from Phase 2. No anti-repeat, no probabilistic weighting in this sub-project.
- **First-decay explainer copy localization.** Single set of English strings, hardcoded in the component.
- **Decay history tracking across days.** `decayedAttributesToday` reflects only the most recent foreground decay run; previous days are not preserved.
- **Voice input.** Deferred to Phase 5.
- **App icon / splash / store metadata.** Phase 4 sub-project 5.

## Architecture

### Module layout

```
src/
  state/
    characterStore.ts                                  EDIT — add decayedAttributesToday + setter
  state/hooks/
    useAppForegroundDecay.ts                           EDIT — track reduced attrs; remove auto-set of firstDecayShown
  ui/components/
    FirstDecayModal.tsx                                NEW — one-time explainer modal
    __tests__/FirstDecayModal.test.tsx                 NEW
  ui/screens/
    CharacterSheetScreen.tsx                           EDIT — thread decayedToday prop; render modal conditionally
    __tests__/CharacterSheetScreen.test.tsx            EDIT — extend with shimmer + modal cases
```

### Dependency rules

Preserves `docs/ARCHITECTURE.md` §"Dependency rules":

- `characterStore` adds a runtime field; no new external imports.
- `useAppForegroundDecay` continues to import `state/`, `storage/`, `game/decay`, `lib/clock`. No new imports.
- `FirstDecayModal` is pure presentational: imports React Native, `useReducedMotion`, and nothing else from state/.
- `CharacterSheetScreen` already imports both stores; adds the modal component import.

## Key semantic change to `firstDecayShown`

The flag's purpose is being clarified.

**Before this sub-project:**
- `useAppForegroundDecay` sets `firstDecayShown=true` *the moment* decay first applies.
- Result: by the time any UI mounts after decay, the flag is `true`. No UI can ever see the false-to-true transition.

**After this sub-project:**
- `firstDecayShown` means "the user has been shown the first-decay explainer modal."
- Initially `false`. Set to `true` only when the modal's `onDismiss` fires.
- `useAppForegroundDecay` no longer touches the flag.

The modal trigger condition in `CharacterSheetScreen`:

```typescript
const showModal = !firstDecayShown && decayedAttributesToday.length > 0;
```

This re-evaluates on every render. As soon as the dismiss handler flips `firstDecayShown` to `true`, `showModal` becomes `false` and the modal unmounts. No session-level flag needed.

## `characterStore` extension

```typescript
interface CharacterStoreState {
  // ... existing fields ...
  decayedAttributesToday: Attribute[];
  setDecayedAttributesToday: (attrs: Attribute[]) => void;
}
```

- Initial value: `[]`.
- Not persisted to SQLite — runtime-only. Decay state is recomputed on every foreground.
- Setter is synchronous (no DB write): `set({ decayedAttributesToday: attrs })`. Direct write; no async because there's nothing to persist.

The setter does NOT belong on `settingsStore` because decay state is character state (the attribute bars belong to the character), not a user preference. Matches the existing pattern of `attributeStates`, `streak`.

## `useAppForegroundDecay` modifications

The hook's decay block changes from:

```typescript
if (eff > 0) {
  const states = await characterRepo.getAttributeStates(db);
  const decayed = states.map((s) => ({
    ...s,
    inProgressXp: applyDecay({ level: s.level, inProgressXp: s.inProgressXp }, eff).inProgressXp,
  }));
  await characterRepo.updateAttributeStates(db, decayed);
  await useCharacterStore.getState().hydrate();

  if (!useSettingsStore.getState().firstDecayShown) {
    await settingsRepo.setSetting(db, 'first_decay_shown', 'true');
    await useSettingsStore.getState().setFirstDecayShown(true);
  }
}
```

To:

```typescript
const reducedAttrs: Attribute[] = [];
if (eff > 0) {
  const states = await characterRepo.getAttributeStates(db);
  const decayed = states.map((s) => {
    const nextXp = applyDecay({ level: s.level, inProgressXp: s.inProgressXp }, eff).inProgressXp;
    if (nextXp < s.inProgressXp) reducedAttrs.push(s.attribute);
    return { ...s, inProgressXp: nextXp };
  });
  await characterRepo.updateAttributeStates(db, decayed);
  await useCharacterStore.getState().hydrate();
}
useCharacterStore.getState().setDecayedAttributesToday(reducedAttrs);
```

Important behavioral details:

- An attribute with `inProgressXp === 0` entering decay leaves with `inProgressXp === 0` (no reduction). It is NOT pushed into `reducedAttrs`. The shimmer represents "this got hit" — a no-op decay isn't a hit.
- The `setDecayedAttributesToday` call runs **even when `eff === 0`**. On a same-day reopen or within-grace foreground, it writes `[]`, clearing any previous list. This guarantees the shimmer turns off when the user has logged today.
- The removed `firstDecayShown=true` write is intentional. Sub-project 4 owns that flag's lifecycle now (set by modal dismissal).

## `<FirstDecayModal>`

Pure presentational component.

```typescript
interface FirstDecayModalProps {
  onDismiss: () => void;
}
```

**Layout:**

- Full-screen `Pressable` host with `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`.
- Semi-transparent backdrop (`rgba(14, 17, 22, 0.85)` — matches existing overlays).
- Centered card containing:
  - Hourglass emoji (⏳), large.
  - Title: `"Your XP just decayed."`
  - Body: `"Inactive days slowly drain your in-progress XP — never your level. Log something today to stop it."`
  - Single "Got it" button (accent gold background, dark text) that calls `onDismiss`.

**Interaction:**

- **Tap the "Got it" button** → fires `onDismiss`.
- **Tap the backdrop** → does NOT dismiss. This is informational onboarding, not an interruption — require deliberate ack.
- The host `Pressable` exists only for accessibility role + visual layout; its `onPress` is a no-op (or undefined). Only the button is interactive.

**Reduce-motion:**

- When `useReducedMotion()` is true: skip the backdrop fade-in and the icon scale-in. The modal renders fully visible from the first frame.
- Otherwise: backdrop fades in over ~200ms; hourglass icon springs from 0.5 → 1.0 over ~250ms.

**Why not React Native `<Modal>`:** consistent with `LevelUpOverlay` and `StreakMilestoneOverlay` already in this codebase — those use `Pressable` overlays. The `<Modal>` component would over-engineer this.

## `CharacterSheetScreen` integration

Two changes:

1. **Thread `decayedToday` to each `<AttributeBar>`:**

```typescript
const decayedSet = new Set(decayedAttributesToday);
// ...
<AttributeBar
  attribute={attr}
  ...
  decayedToday={decayedSet.has(attr)}
/>
```

This is the deferred wiring from sub-project 2. The shimmer animation in `AttributeBar` is already built and tested; this is the live-data connection.

2. **Render `<FirstDecayModal>` conditionally:**

```tsx
{!firstDecayShown && decayedAttributesToday.length > 0 ? (
  <FirstDecayModal
    onDismiss={() => {
      void setFirstDecayShown(true);
    }}
  />
) : null}
```

Placed at the end of the screen's render tree (after the FAB) so it overlays everything.

The modal is rendered **inside `CharacterSheetScreen`** (not in the root layout) for two reasons:
- The user is most likely to land here first (it's the home tab). If they go to Missions or History before Character, no modal — fine. They'll see it next time they land on Character.
- Decay shimmer is on `CharacterSheetScreen` too. Co-locating keeps the decay UX in one render tree.

## Testing

### Pure / engine tests

None. The change is a hook-level edit + a presentational component + a screen integration.

### Component tests (RNTL, jest-expo)

- `src/ui/components/__tests__/FirstDecayModal.test.tsx` (NEW)
  - Renders title, body, and "Got it" button.
  - Tapping the "Got it" button fires `onDismiss`.
  - Tapping the backdrop does NOT fire `onDismiss`.
  - `accessibilityRole="alert"` is on the host.
  - Reduced-motion variant: renders content without animation, still fires `onDismiss` on button tap.

- `src/ui/screens/__tests__/CharacterSheetScreen.test.tsx` (EXTEND)
  - **Modal appears when `firstDecayShown=false` AND `decayedAttributesToday` is non-empty.** Mock both stores with these values; assert `getByTestId('first-decay-modal')`.
  - **Modal does NOT appear when `firstDecayShown=true`.** Even with decayed attrs.
  - **Modal does NOT appear when `decayedAttributesToday` is empty.** Even with `firstDecayShown=false`.
  - **Dismissing the modal calls `setFirstDecayShown(true)`.** Mock the setter; tap "Got it"; assert call.
  - **`AttributeBar` receives `decayedToday=true` for attributes in `decayedAttributesToday`.** Render with `decayedAttributesToday: ['STR', 'CON']`; assert each bar's `decayedToday` prop via the existing testID + prop inspection pattern.

### `useAppForegroundDecay` test

No new RNTL test — the hook already follows the codebase convention of being manually verified (per the hook file's existing comment: "depends on AppState (native). Verified manually"). The new logic is a small comparison line and is structurally simple. Manual device verification (below) covers it.

### Mocking conventions

`CharacterSheetScreen.test.tsx` already mocks `useCharacterStore`. Extend the mocked state shape with:

```typescript
decayedAttributesToday: Attribute[];
setDecayedAttributesToday: (attrs: Attribute[]) => void;
```

Add a `useSettingsStore` mock (if not already present in this test file) for:

```typescript
firstDecayShown: boolean;
setFirstDecayShown: (v: boolean) => Promise<void>;
```

## Manual device verification

1. Fresh install. Submit one log. Background app. Wait 3+ days (or change device clock forward 3 days). Reopen app.
2. **Expected:** All six bars dim slightly (existing 60% opacity) + shimmer animation runs left-to-right; first-decay modal appears.
3. Tap "Got it" → modal dismisses with no animation hiccup.
4. Force-quit and reopen → modal does NOT reappear (one-time).
5. Wait another 3 days inactive → bars decay again, shimmer animates, modal does NOT reappear.
6. Submit a log → next foreground (within the grace window again), shimmer turns off because `setDecayedAttributesToday([])` is called.
7. Toggle iOS Settings → Accessibility → Reduce Motion ON → repeat #1. Shimmer is off (per sub-project 2 spec); modal still appears (content visible, no animation).

## Acceptance criteria

This sub-project is complete when:

1. `characterStore.decayedAttributesToday` exists and is updated by `useAppForegroundDecay` on every foreground.
2. `useAppForegroundDecay` no longer sets `firstDecayShown=true`.
3. `<AttributeBar>` receives `decayedToday=true` for the attributes that actually had non-zero decay on the most recent foreground.
4. `<FirstDecayModal>` renders only when `firstDecayShown=false` AND `decayedAttributesToday.length > 0`.
5. The modal's "Got it" button persists `firstDecayShown=true`; the backdrop is non-interactive.
6. All Jest and RNTL tests pass; lint and typecheck clean.

## Risks and open questions

- **Existing-user migration.** Users who installed before this sub-project may have `firstDecayShown=true` already (set by the old hook behavior on their first decay). They will never see the modal. Acceptable: they've already experienced decay; the modal would be redundant for them. Documented but not "migrated" — this is a one-time UX feature, not a critical user signal.
- **Setting `setDecayedAttributesToday([])` on every no-decay foreground.** This is a synchronous Zustand write that re-renders any subscriber, even when the array reference equals the existing empty one. Trivial perf cost (~one re-render per foreground); not worth memoizing.
- **`firstDecayShown` semantic flip.** Existing tests for the old behavior in `useAppForegroundDecay` (if any) become invalid. There are no such tests — the hook is manually verified per the codebase convention.

## Out of scope (tracked elsewhere)

- App icon, splash screen, store metadata — Phase 4 sub-project 5.
- Real `AppleAIService` and voice input — Phase 5.
- Android distribution — Phase 6.
- Mission generation algorithm improvements (anti-repeat, probabilistic weighting) — post-MVP if user feedback indicates the current behavior is too mechanical.
