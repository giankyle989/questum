# Visual Design System — Questum

**Date:** 2026-05-07
**Status:** Approved — ready for implementation planning
**Scope:** Visual layer (palette, typography, components, motion). Pairs with [`UI_SPEC.md`](../../UI_SPEC.md) which defines screen behavior and navigation.

## Direction

**Modern minimalist · muted earthen palette · Manrope.**

The character sheet should read like a polished tool with subtle RPG cues — not a fantasy game, not a generic AI app. Each screen has lots of negative space, hairline bars, and a single gold accent reserved for "moments" (level-ups, streak chip, primary actions). The six attributes get distinct desaturated hues to support glance-readability without dominating the surface.

This is the "indie polish, deliberately minimal" wedge from `PRD.md` §11.5, expressed visually.

## Palette

All values are sRGB hex. Define once in `src/game/constants.ts` and consume via NativeWind's theme.

### Surfaces and text

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0E1116` | Screen background |
| `surface` | `#161B22` | Cards, missions, modals, mission rows |
| `surface-2` | `#1A1F26` | Bar tracks (empty XP), inset surfaces |
| `border` | `#2A2F36` | All hairline borders, dividers |
| `text` | `#E6EDF3` | Primary text |
| `text-mute` | `#9AA4AE` | Secondary text (descriptions, level numbers next to bars) |
| `text-dim` | `#7D8590` | Tertiary text (tiny labels, timestamps) |
| `accent` | `#E8C547` | Gold — streak chip, primary buttons, level-up moment, FAB. Reserved for moments. |

### Attribute colors

| Attribute | Hex | Notes |
|---|---|---|
| STR | `#C97A6E` | Terracotta |
| DEX | `#8FB29D` | Sage |
| CON | `#D49E63` | Amber |
| INT | `#7D9BC4` | Slate blue |
| WIS | `#A892C7` | Dusty violet |
| CHA | `#C786A4` | Rose |

These colors are the **single source of truth** for attribute-coded UI: bars, labels, icons, history rail, mission checkbox borders, recent-log XP numbers. Never substitute the gold accent for an attribute color.

### Accessibility

- Body text on `bg` and `surface` clears WCAG AA at the chosen sizes.
- Attribute color is never the only signal — every attribute use pairs with the three-letter label and an icon.
- Reduce-motion preference disables the reveal/level-up animations (see Motion section).

## Typography

**Manrope** (Google Fonts, loaded via expo-font). Weights: 400, 500, 600, 700, 800.

| Style | Size | Weight | Spacing | Use |
|---|---|---|---|---|
| Display | 26 px | 700 | -0.5 px | Pitch hero, screen-headline hero |
| Numeric | 32 px | 800 | -1 px | Level-up new level (the large "Intelligence 7") |
| Heading | 18 px | 700 | -0.4 px | Screen titles (Quests, History) |
| Title | 15 px | 700 | -0.3 px | Character name, log entry title |
| Body | 13 px | 600 | normal | Mission descriptions, history rows, reveal copy |
| Body-mute | 12 px | 500 | normal | Subtitles, descriptions in muted text |
| Caption | 11 px | 500 | 0.4 px | Bar level/XP numbers, FAB label, secondary copy |
| Caption-bold | 11 px | 700 | 0.4 px | Streak day count, "+34" XP-gain numbers |
| Tiny label | 9 px | 600 | 1.4 px, uppercase | Section labels ("Today", "Recent"), pitch hero kicker |

No serif fonts. No display fonts beyond Manrope. Bold + size differentiates hierarchy.

## Components

### `<AttributeBar>`
- Track: 4 px tall, `surface-2` background, 2 px corner radius
- Fill: attribute color, animated via Reanimated `withSpring` from old % to new %
- Label row above the bar: attribute three-letter name (left, attribute color, weight 700) + level/XP (right, `text-mute`, weight 500, e.g. "Lv 4 · 60/100")
- Icon (11 px) sits left of the three-letter name, attribute-colored line glyph
- Decayed-today variant: bar fill at 55% opacity + soft horizontal gradient overlay loop (the "decay shimmer")
- Reveal variant (transient): track grows to 6 px, fill gains a soft 12 px attribute-colored glow during the gain animation, then collapses back

### `<StreakIndicator>`
- Pill: `surface` background, 1 px `border`, 10 px corner radius
- Flame glyph 11×11 px in `accent` (gold), followed by integer day count in `accent` weight 700 caption size
- Live value computed at render time per `GAME_RULES.md` "Displayed streak" rule (zero shown when broken, even before next log)

### `<AvatarGlyph>`
- 40 px hex outline (1 px `border`) on `surface`
- Inner solid hex at one of the six attribute colors, 85% opacity
- Six preset variants for character creation. `character.avatar_id` stores one of: `'hex_str'`, `'hex_dex'`, `'hex_con'`, `'hex_int'`, `'hex_wis'`, `'hex_cha'`. The suffix selects which attribute color fills the inner hex.
- No human portraits. No photo upload. No customisation in MVP beyond preset selection.

### `<AttributeIcon>`
- Default size 11 px (used in `AttributeBar`); also 14 px for mission-row markers and the larger reveal context. Caller passes `size` prop.
- 1.4 px stroke width, `currentColor` (caller passes the attribute color via parent)
- Set: STR (barbell-like rectangle silhouette), DEX (triangle / arrowhead), CON (clock with hand), INT (book with two lines), WIS (concentric circles / target), CHA (heart-curve / wave). Icons are pictographs — readable at 11 px in monochrome.

### `<MissionRow>`
- `surface` background, 14 px corner radius, 1 px `border`
- Left: 18 px square checkbox. Incomplete: 1.4 px attribute-color outline. Complete: filled attribute color with white check glyph.
- Center: mission description (body, weight 600). Subtitle: "+50 ATTR" plus state ("expires Sun" / "earned").
- Completed rows have description strikethrough and overall opacity 0.55.
- Daily and weekly use the same component; weekly's border is gold-tinged (`#3D3122`) to distinguish at a glance.

### `<HistoryRow>`
- 3 px attribute-colored vertical rail (left, full row height)
- Title (body, weight 600) + total XP (caption, weight 700, attribute-colored, right-aligned)
- Subtitle: time · duration/quantity · per-attribute XP breakdown (`text-dim` caption)
- Grouped under date headings (tiny labels: "Today", "Yesterday", "May 5", etc.)

### `<FloatingActionButton>` (the "+")
- 48 px gold circle, 50% radius
- White-bg-on-bg `+` glyph (24 px char, weight 700, color `bg`)
- Shadow `0 6px 16px rgba(232,197,71,0.4)`
- Lives bottom-right of CharacterSheet, 18 px from bottom and right edges

### `<LevelUpModal>`
- Full-screen `surface`-to-`bg` vertical gradient
- Centered SVG radial burst: concentric stroke rings at 0.15/0.3/0.5 opacity, 8 spoke lines at 0.7 opacity, hex outline, new level number rendered into the SVG at numeric size
- Caption: "Level Up" tiny label in gold
- Display heading: `<Attribute name> <level>` (e.g. "Intelligence 7")
- One-line copy below (body, `text-mute`) — generated copy lives in `src/game/copy/levelUp.ts` (a small static map per attribute, no AI involved)
- Single gold "Continue" button
- Dismissable via tap outside or Continue

### `<XPGainReveal>`
Sequence on log submit (see Motion section for timing):
1. Modal frame stays mounted; subtitle changes to "Reading your log…" with the tiny gold label
2. AI returns; subtitle updates to AI summary (in quotes)
3. Non-affected bars fade to 30% opacity (200 ms)
4. Affected bars expand from 4 → 6 px, gain attribute-colored glow, fill animates to new value, header label flips to "+34" attribute-colored
5. After bar fill settles (the 500 ms spring completes plus a ~100 ms settle pause): if a level threshold was crossed → push `<LevelUpModal>`; otherwise fade dim bars back to full and display a small "+1.20× streak bonus applied" footer card if streak multiplier was non-1.0
6. Auto-dismiss the log modal 2 s after the last animation completes

## Motion

Library: Reanimated 3 + Moti (per locked stack). All durations target 60 fps; values are guides, not strict.

| Moment | Animation | Duration |
|---|---|---|
| Bar fill (XP gain) | `withSpring(toValue, { damping: 18, stiffness: 140 })` per affected bar | ~500 ms |
| Bar dim (non-affected) | `withTiming(0.3, { duration: 200 })` | 200 ms |
| Bar redim back | `withTiming(1, { duration: 250 })` | 250 ms |
| Number tick-up | Linear interpolate from old to new XP value, ~500 ms, 30 fps is fine | 500 ms |
| Level-up entry | Scale 0.9 → 1.0 + opacity 0 → 1 on the radial burst, then number scales 0.7 → 1.0 with overshoot | 600 ms total |
| Streak milestone (3, 7, 30 day) | Subtle gold pulse on the streak chip — scale 1.0 → 1.08 → 1.0 | 400 ms |
| Decay shimmer | Continuous horizontal gradient sweep, 4 s loop | 4 s loop |
| FAB tap | Scale 1.0 → 0.92 → 1.0 with haptic light impact | 150 ms |

**Reduce motion:** when `AccessibilityInfo.isReduceMotionEnabled()` returns true, disable bar fill animation (snap to new value), skip the level-up entry animation (modal appears in place), drop streak pulse, drop decay shimmer (use a static 0.55-opacity bar instead).

## Layout

- All screens use 16 px outer horizontal padding
- Card-to-card gap inside a screen: 12 px
- Section label (tiny, uppercase) sits 12 px above its content
- The CharacterSheet floats the FAB above safe-area inset bottom
- Tab bar (Character / Quests / History / Settings) is the standard Expo Router tabs styling, customized to use `surface` background and `accent` for active tint, `text-dim` for inactive

## Theming and config

The palette and typography land in three places:

1. **`src/game/constants.ts`** — `ATTRIBUTE_COLORS: Record<Attribute, string>` and `THEME` object with all surface/text tokens. Single source of truth.
2. **`tailwind.config.js`** (NativeWind) — extends `theme.colors` from the constants module so utility classes work (`bg-surface`, `text-mute`, `border-border`, etc.). Custom font family `manrope` mapped to Manrope.
3. **`app/_layout.tsx`** — loads Manrope via `useFonts` from `expo-font` (variants 400/500/600/700/800), gates first render until the font resolves.

## Design tokens reference (copy-pasteable)

```typescript
// src/game/constants.ts
export const COLORS = {
  bg: '#0E1116',
  surface: '#161B22',
  surface2: '#1A1F26',
  border: '#2A2F36',
  text: '#E6EDF3',
  textMute: '#9AA4AE',
  textDim: '#7D8590',
  accent: '#E8C547',
} as const;

export const ATTRIBUTE_COLORS = {
  STR: '#C97A6E',
  DEX: '#8FB29D',
  CON: '#D49E63',
  INT: '#7D9BC4',
  WIS: '#A892C7',
  CHA: '#C786A4',
} as const;
```

## Out of scope for MVP

- Light theme (deferred to Phase 4 if time permits, per UI_SPEC §Theming)
- Custom illustrated avatars (preset hex glyph only)
- Animated avatars or per-attribute character costumes
- Multiple themes / theme picker
- Pixel-art or fantasy illustration style
- Sound design (the level-up modal optionally plays a sound, but sourcing audio is post-MVP)

## Open questions deferred to implementation

- Final per-attribute level-up copy (small static map, can be drafted during Phase 3 once the modal is wired)
- Final SVG icon set polish (placeholder glyphs in this spec; refine during Phase 3)
- Whether to use `react-native-svg` directly or wrap into a `<Glyph>` component (decided by the implementation plan)

## Acceptance for the visual layer

The visual layer is "done" when:
- All eight screens shown in the brainstorm mockup are buildable from the tokens here
- A new screen can be added without reaching outside the palette/typography defined here
- Every attribute reference (icon, bar, label, history rail, mission checkbox) draws its color from `ATTRIBUTE_COLORS` and never hard-codes
- Reduce-motion is honored everywhere animation is used
