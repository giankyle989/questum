# UI Specification

This document describes screen-level behavior and component contracts. Design polish (exact colors, animations, micro-interactions) is decided during Phase 4. This is what each screen does, not what each pixel looks like.

## Navigation structure

Expo Router file-based routing.

```
/onboarding            → OnboardingScreen (3 pitch slides + character creation)
/waitlist              → WaitlistScreen (soft gate)
/(main)/character      → CharacterSheetScreen (home tab)
/(main)/log            → LogEntryScreen (modal sheet)
/(main)/missions       → MissionsScreen (tab)
/(main)/history        → HistoryScreen (tab)
/(main)/settings       → SettingsScreen
```

Tab bar: Character / Missions / History / Settings. Log entry is a floating button on Character screen, opens as modal.

## Routing decisions on app open

```
1. Load settings.onboarding_complete
2. If false → /onboarding
3. Probe AI availability
4. If not available AND onboarding_complete → /waitlist
5. Otherwise → /(main)/character
```

## Screens

### OnboardingScreen

Three pitch slides + character creation flow.

**Slide 1:** "Turn your life into an RPG" — hero visual, short tagline.
**Slide 2:** "AI parses what you did. You just type." — show example log + result.
**Slide 3:** "Six attributes. One you. Level up." — show six attribute bars.

Then: AI capability check screen showing "Apple Intelligence detected" / "Gemini Nano detected" / "Your device doesn't support on-device AI yet" with privacy explainer.

Then: character creation — name input + 6 preset avatars in a grid.

Then: first-log walkthrough — "Tell us one thing you did today to get started."

After first log submitted: set `onboarding_complete = true`, navigate to character sheet.

**Skippable:** Slides 1-3 have a "Skip" button. Character creation and first log are required.

### CharacterSheetScreen (home)

The most-visited screen. Must be alive — animations on every load.

Layout, top to bottom:
- Avatar + character name + total level (large)
- Streak indicator (small, top-right): "🔥 7 days"
- Six attribute bars, each showing: attribute name, level, XP progress to next level, faint shimmer if decayed today
- Daily missions card (3 items, with progress dots)
- Recent logs preview (last 3 entries, swipe for full history)
- Floating "+" button to open Log Entry

Pull-to-refresh: re-runs decay calculation, regenerates daily missions if a new day.

### LogEntryScreen (modal)

Opens as a bottom sheet from the floating button.

- Single text input, autofocus, "What did you do?" placeholder
- Voice input button (Phase 4)
- Submit button (disabled until text is non-empty)
- After submit:
  - Show loading state ("Reading your log...")
  - On AI response: show XP gain reveal animation (numbers animating up on each affected bar)
  - If level-up triggered: show level-up modal over the reveal
  - If mission completed: show completion celebration after level-up
  - Auto-close back to character sheet after ~2 seconds

Error states:
- Empty input: button disabled, no error
- AI fails twice: show "We couldn't categorize that — try being more specific" toast, keep input populated for editing
- Network/storage error: "Something went wrong, try again" toast

### MissionsScreen

Two sections: Active and Completed.

**Active:**
- Daily missions (today's 3) with progress bars
- Weekly quest with progress bar
- Time remaining for each ("expires in 8h" / "expires Sunday")

**Completed:**
- List of recently completed missions, last 30 days
- Each shows description, completion date, bonus XP earned

### HistoryScreen

Chronological list of all logs.

Each row:
- Date + time
- AI summary (e.g., "Morning run + algorithms reading")
- Total XP earned
- Primary attribute icon
- Tap to expand: full log text, per-attribute XP breakdown

Filter pill row at top: All / STR / DEX / CON / INT / WIS / CHA

Infinite scroll with pagination (50 logs per page).

### SettingsScreen

Sectioned list:

**Profile**
- Character name (tap to edit)
- Avatar (tap to change)

**AI Source**
- Read-only display: "Apple Intelligence" / "Gemini Nano" / "Mock (development)"
- Privacy info link

**Notifications**
- Toggle: Daily missions reminder
- Time picker for morning notification
- Toggle: Inactivity nudge (day 3+)

**Decay**
- Toggle: Pause decay
- If paused: show "X / 14 days used this year"
- Resume button

**About**
- App version
- Privacy policy link
- Restore purchase button

**Developer (debug builds only)**
- Reset character button
- Switch AI source dropdown
- View raw logs DB

### WaitlistScreen

Shown when on-device AI is unavailable.

- Headline: "Questum isn't ready for your device yet"
- Body: Brief explanation that the app uses on-device AI and the user's phone doesn't support it
- Email input + submit button
- "We'll let you know when we expand support."
- After submit: "You're on the list" confirmation, no further interaction

User can re-open the app and the screen still appears. Email is stored locally and re-shown if already submitted.

## Components

Built in `src/ui/components/`. Each is a pure presentational component receiving props.

### `<AttributeBar>`
Props: attribute name, level, in-progress XP, threshold, decayedToday boolean. Renders bar + label + level indicator.

### `<XPGainReveal>`
Props: gains object (attribute → XP delta). Animates numbers ticking up on each affected bar.

### `<LevelUpModal>`
Props: attribute, newLevel. Full-screen celebration overlay, dismissable.

### `<MissionCard>`
Props: mission object, onTap. Renders description, attribute icon, progress dots/bar, expiry.

### `<StreakIndicator>`
Props: streak length. Renders flame icon + day count.

### `<LogRow>`
Props: log object, onTap. Used in history list.

## Animations

Phase 4 priority. Use Reanimated 3 + Moti.

Critical animations (must feel good before launch):
- XP gain reveal (numbers tick up smoothly)
- Bar fill (animates from old XP to new)
- Level-up burst (radial particle effect, sound effect optional)
- Decay shimmer (faint downward gradient, slow loop)

## Accessibility

- All tappable elements ≥ 44pt
- Color is never the only signal (use icons + text alongside attribute colors)
- Voice-over labels on all interactive elements
- Reduce-motion respected for all animations (fall back to instant transitions)

## Theming

Single dark theme for MVP. Light theme optional in Phase 4 if time permits.

Color palette (defined in NativeWind config):
- Background: deep navy
- Surface: slightly lighter navy
- Primary: gold accent (level-up moments)
- Attribute colors: each attribute gets a distinct hue (defined in `src/game/constants.ts`)
- Text: warm off-white
