# Brand Identity — Questum

**Date:** 2026-05-08
**Status:** Approved — assets ready for generation/export
**Scope:** Brand-level identity (mascot, wordmark, asset roadmap). Pairs with [`2026-05-07-visual-design-system.md`](./2026-05-07-visual-design-system.md) which defines the in-product visual layer.

## Direction

Questum's brand identity sits one layer above the in-product UI. The UI is "modern minimalist with subtle RPG cues" — quiet and tool-like. The brand operates at three coordinated layers:

- **App icon** — a single bold shape (gold hex with cutout "Q") that reads at 24px. Lives on home screens, app switchers, notification badges. No detail, no character.
- **Wordmark** — caps lockup with gold kicker, set in Manrope. Lives on splash screens, screenshots, social, marketing copy.
- **Mascot** — a chibi hooded scholar character. Lives in onboarding heroes, splash composition, empty states, social posts. Carries personality at sizes where detail is an asset.

The three layers stay coordinated through palette (deep navy, gold accent, six earthen attribute hues) and typography (Manrope). **The mascot is not the app icon** — they have different jobs at different scales. Conflating them was an earlier draft mistake corrected here.

## App icon

### Direction: gold hex with cutout "Q"

A solid gold hexagon on deep navy, with a Manrope ExtraBold "Q" cut out in the background color. The hex shape is a direct callback to the in-app `<AvatarGlyph>` (the player's character avatar is also a hex), and the "Q" ties to the wordmark.

### Why not the mascot

App icons live at ~60×60px on crowded home screens. Detailed character illustrations don't survive that size — the hood/face becomes a brown-and-blue blob, the journal disappears, the gold burst muddies. Character-as-icon only works for established brands (Duolingo's owl took years of brand recognition). For a launching app, a distinctive geometric mark wins: it scales, it doesn't muddy, and it's harder to confuse with the dozens of other character-icon mobile games.

### Specs

- **Background**: deep navy `#0E1116`, full bleed (no transparency — iOS adds the squircle mask)
- **Hex**: solid gold `#E8C547`, pointy-top orientation, comfortable padding inside the iOS squircle
- **Q**: Manrope ExtraBold (800), rendered in `#0E1116` so it reads as a stamped cutout in the gold hex, geometrically centered

### Source file

`assets/brand/app-icon.svg` — 1024×1024 viewBox. Convert to outlines and export as `1024×1024` PNG (no alpha) for `assets/images/icon.png`. See `assets/brand/README.md` for the export workflow.

### Why not generate the icon with Gemini

Same reason as the wordmark: image generators hallucinate letterforms and geometric shapes drift. Icons are deterministic geometry, not generative content. Render from the SVG.

## Mascot

### Concept

A small hooded scholar-adventurer with chibi proportions, holding a journal — the journal is the prop tying the mascot to Questum's core mechanic ("type what you did, AI parses it"). The mascot is class-neutral (no weapons, no class-specific armor) because Questum's six attributes represent balanced growth, not a chosen class.

### Primary pose: level-up moment

Used for the **app icon** and primary brand mark.

- Full-body chibi standing, both stubby arms raised overhead, hands gripping the terracotta journal triumphantly
- Joyful expression: closed-curve smile-eyes, soft rosy cheek tint, small open grin
- Soft golden radial burst behind the head — three concentric thin gold rings, eight gentle gold spoke-lines, three or four small floating gold sparkles
- Square 1:1 composition, centered, comfortable padding

### Style register

**Chibi vector illustration** — flat shapes with subtle two-tone shading per region, crisp ~1.5–2px dark-navy outlines, no textures, no painterly brushwork. Closer to indie-illustration than to pixel art.

### Palette (strict)

| Region | Base | Shadow |
|--------|------|--------|
| Background (icon variant) | `#0E1116` deep navy | — |
| Cloak / hood | `#7D9BC4` slate-blue | `#5C7BA0` |
| Skin | `#D9B89A` warm sand | `#B5957B` |
| Journal | `#C97A6E` terracotta | `#A55F54` |
| Gold accent (clasp, burst, sparkles) | `#E8C547` | — |
| Outlines | `#1A1F26` dark navy | — |

These match `src/game/constants.ts` (slate-blue is the INT attribute color; terracotta is STR; gold is the brand accent).

### Generation prompts (for Gemini)

The mascot is generated via Gemini image generation. Set aspect ratio to 1:1 in the Gemini UI before each prompt. Prompts deliberately use natural language and inline "avoid X" rather than separate negative prompts (Gemini-specific).

#### Variant 1 — App icon (level-up moment, gold burst, square)

> Create a chibi-style mascot character for a self-improvement RPG mobile app called Questum. Square 1:1 composition, suitable for use as an app icon.
>
> The character is a small hooded scholar-adventurer with chibi proportions — head roughly the same size as the body, oversized in proportion. They are mid-celebration of a level-up moment: both stubby arms raised overhead, hands holding a small terracotta-red leather-bound journal triumphantly above the head. The face shows joy: eyes closed in soft upward-curving smile-lines, a small open grin, soft rosy cheek tint. Two tiny feet visible at the base, with a soft elliptical ground shadow.
>
> Costume: slate-blue hood with a darker slate-blue interior shadow, matching short slate-blue cloak. Warm sand skin tone. A small gold clasp on the journal cover.
>
> Behind the character, render a soft golden radial burst as ambient background — three thin concentric gold rings (faint outer, slightly brighter inner), about eight gentle gold spoke-lines extending outward at low opacity, and three or four small floating gold sparkle marks scattered around the character's head. The burst should feel ambient and minimal, not harsh, beam-like, or anime-style. The character must clearly read in front of it.
>
> Visual style: clean modern chibi vector illustration. Flat shapes with subtle two-tone shading per region (one base color plus one shadow tone). Crisp dark-navy outlines roughly 1.5–2 pixels wide. Solid flat color fills, no gradients except the soft radial burst behind the character. No textures, no noise, no painterly brushwork, no rough sketch lines.
>
> Strict color palette — use these hex values exactly and do not introduce other colors: deep navy background `#0E1116`, slate-blue cloak `#7D9BC4` with shadow tone `#5C7BA0`, warm sand skin `#D9B89A`, terracotta journal `#C97A6E`, gold accent for the burst, sparkles, and clasp `#E8C547`, dark-navy outline `#1A1F26`. The overall feel should be muted, earthen, desaturated, polished — never neon, oversaturated, or pastel.
>
> Mood: triumphant but understated. Indie polish. Modern minimalist with subtle RPG cues — not fantasy-heroic, not generic mobile game cute, not anime.
>
> Avoid the following: no swords, no weapons, no armor plates, no helmets beyond the simple cloth hood, no other characters, no text or letters, no watermarks or signatures, no photorealism, no 3D rendering, no painterly textures, no busy ornaments or scene background, no blur, no neon or oversaturated colors.

#### Variant 2 — Transparent isolated character (splash, layering)

Run after Variant 1 to keep visual context warm:

> Same character, same pose, same color palette, same style — but with a fully transparent background. Remove the gold radial burst, rings, and spokes. Keep only the character and a subtle dark elliptical ground shadow under the feet. Output as a PNG with alpha channel. The character should be isolated and ready to composite onto any background.

#### Variant 3 — Friendly waving (onboarding, welcome states)

> Same chibi mascot character as before — small hooded scholar with oversized chibi head, slate-blue hood and cloak, warm sand skin, terracotta-red journal tucked under one arm. Same color palette: deep navy `#0E1116` background, slate-blue `#7D9BC4` cloak with `#5C7BA0` shadow, warm sand `#D9B89A` skin, terracotta `#C97A6E` journal, gold `#E8C547` accent on journal clasp, dark-navy `#1A1F26` outlines.
>
> Pose change: the character is standing relaxed, holding the journal closed under their left arm, while their right arm is raised in a small friendly wave. Eyes are open, soft and curious, with small white highlights. Gentle smile. Soft elliptical ground shadow.
>
> Plain transparent PNG background. No radial burst, no sparkles, no rings — just the isolated character with the ground shadow. Same clean modern chibi vector style: flat shapes, two-tone shading, crisp 1.5–2px dark-navy outlines, no textures, no gradients except the ground shadow.
>
> Avoid: weapons, armor, multiple characters, text, watermarks, photorealism, 3D rendering, painterly textures, busy backgrounds, neon colors.

#### Variant 4 — Writing in the journal (loading state, history empty state)

> Same chibi mascot character. Same color palette and same clean modern chibi vector style as before — slate-blue hood and cloak, warm sand skin, terracotta journal, gold accents, dark-navy outlines, on a fully transparent background.
>
> Pose change: the character is sitting cross-legged on an invisible surface, holding the open terracotta journal across their lap with both small hands. Their head is tilted gently downward, looking at the open pages. Eyes are softly closed in calm focus, small content smile. A tiny gold quill or pen rests across the journal pages. Two faint floating gold sparkle marks above the head suggesting thought, very subtle, low opacity. Soft elliptical ground shadow under the figure.
>
> Plain transparent PNG. No background burst, no rings. Same flat chibi vector style, two-tone shading, crisp dark-navy outlines.
>
> Avoid: weapons, armor, complex scene, text on the journal pages, photorealism, painterly textures, busy backgrounds.

#### Variant 5 — Surprised / question mark (AI-unavailable banner)

> Same chibi mascot character. Same palette, same chibi vector style, same costume.
>
> Pose change: the character is standing with their journal lowered to their side in one hand, the other hand on their cheek in a small "huh?" gesture. Eyes are wide and curious, mouth a small "o" of surprise. A single bold gold question mark `?` floats just above and slightly to the side of their head — about 30% the size of the character. Soft elliptical ground shadow.
>
> Plain transparent PNG background. No radial burst, no sparkles. Same clean flat chibi vector style.
>
> Avoid: weapons, armor, distress or sad expression (they should be curious and friendly, not worried), multiple question marks, text other than the single `?`, photorealism, painterly textures, busy backgrounds.

### Generation tips (Gemini)

- Set aspect ratio to **1:1** in the Gemini UI before each prompt
- Generate **2–4 variants** per prompt and pick the cleanest line work
- If colors drift, append: *"The slate-blue, terracotta, and gold colors are non-negotiable — match them exactly to the hex codes given."*
- For transparent variants, if Gemini puts a solid color behind it, append: *"Background must be transparent alpha, not white, not any color."*

## Wordmark

### Direction: caps lockup with gold kicker

> **QUESTUM**
> *Level up real life*

- Display: "QUESTUM" set in Manrope ExtraBold (800), uppercase, ~10px tracking
- Kicker: "LEVEL UP REAL LIFE" set in Manrope Semibold (600), uppercase, ~3.6px tracking, gold `#E8C547`
- Display text color: `#E6EDF3` (warm off-white) on dark backgrounds; `#0E1116` on light backgrounds
- Kicker stays gold across all surfaces

This direction was chosen over alternatives (gold "Q" treatment, hex-glyph "Q", gold underline tail) because the caps lockup with kicker feels most product-y and reads strongly at the small sizes used in screenshot overlays and onboarding heroes.

### Source file

`assets/brand/wordmark.svg` — references Manrope via Google Fonts. For production exports, install Manrope locally and convert text to outlines in a design tool (see `assets/brand/README.md`).

### Why not generate the wordmark with Gemini

Image generators consistently hallucinate letterforms — kerning drifts, characters morph, the "Q" tail mutates. Wordmarks are deterministic typography, not generative content. Always render the wordmark from the SVG.

## Asset roadmap

Prioritized by what blocks shipping vs. what polishes the launch.

### Blocks App Store submission

| Asset | Spec | Source |
|-------|------|--------|
| App icon | 1024×1024 PNG, no alpha, no rounded corners | `assets/brand/app-icon.svg` exported as PNG |
| App Store screenshots | iPhone 6.9" (1290×2796), 3–10 frames with marketing overlay copy | Phase 4+ once real screens exist |
| Splash screen art | 1242×2688 PNG, dark navy bg, mascot + wordmark centered | `mascot-celebrate.png` + `wordmark.svg` composed |
| App preview video *(optional, +25% conversion)* | 15–30s, captures core loop | Phase 5 |

### Polished launch (not blocking, but obvious gaps without)

| Asset | Spec | Source |
|-------|------|--------|
| Notification icon (iOS) | Small monochrome silhouette, single color, transparent | Derived from mascot — simplified head silhouette |
| OG / social share image | 1200×630 PNG | Mascot Variant 1 + wordmark composition |
| Onboarding hero illustrations | 3 slides per `UI_SPEC.md` §OnboardingScreen | Mascot variants 3, 4, 1 (one per slide) |

### Defer to later phases

- Empty state illustrations (Phase 4 polish)
- Press kit page (post-launch)
- Brand guidelines doc (defer until collaborators join — `constants.ts` and this spec are sufficient for solo dev)
- Android adaptive icon variants (Phase 6 — Android launch)

## Wiring brand into the app

1. Export `assets/brand/app-icon.svg` as a 1024×1024 PNG with no alpha and replace `assets/images/icon.png`
2. Compose the splash screen: `assets/images/mascot-celebrate.png` (transparent) + `assets/brand/wordmark.svg` on a `#0E1116` background, sized to 1242×2688, exported as `assets/images/splash-icon.png`
3. `app.config.ts` already references both paths — no config change needed

The other mascot variants (`mascot-waving.png`, `mascot-writing.png`, `mascot-confused.png`) land in their respective screens during Phases 3–4 (onboarding, loading/empty states, AI-unavailable banner).

## Out of scope for this spec

- Light-theme variants (deferred per visual-design-system §Out of scope)
- Android-specific adaptive icon foreground/background/monochrome (Phase 6)
- Animated mascot (post-MVP)
- Sound design (deferred per visual-design-system §Out of scope)

## Acceptance

The brand identity is "done" when:

- `assets/brand/app-icon.svg` is exported as `assets/images/icon.png` (1024×1024, no alpha) and renders cleanly in the App Store Connect icon preview at every size
- `assets/images/mascot-celebrate.png` is composed with `assets/brand/wordmark.svg` into `assets/images/splash-icon.png`
- All five mascot variants (`mascot-levelup-burst`, `mascot-celebrate`, `mascot-waving`, `mascot-writing`, `mascot-confused`) are committed in `assets/images/`
- `assets/brand/wordmark.svg` and `assets/brand/app-icon.svg` are committed and the README is followed for any production export
- Every brand surface (icon, splash, screenshots, social) draws from `assets/brand/` source files or `assets/images/` exports — no improvised one-off art
