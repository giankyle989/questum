# Phase 4 — Sub-project 5: App Store Listing Draft

**Date:** 2026-05-12
**Phase:** 4 (Polish)
**Scope:** Final Phase 4 sub-project. Sub-projects 1–4 (AI factory + banner, animations + haptics, local notifications, first-decay explainer + shimmer wiring) are already merged.

## Goal

Produce a single business artifact — `docs/STORE_LISTING.md` — containing all iOS App Store Connect text fields Questum will need at submission time:

- App name, subtitle, promotional text, full description (three drafts to choose between).
- Keywords (≤100 chars total).
- Primary + secondary App Store category.
- Age rating expectation and privacy-nutrition rows.
- Supported-devices list (Apple-Intelligence-capable iPhones).
- Placeholder URLs (support, marketing, privacy policy) for the user to fill before submission.
- Screenshots plan: which screens to capture, in what order, for which device sizes.

The artifact lives at the docs root (alongside `PRD.md`, `ARCHITECTURE.md`) — discoverable, browsable, ages with the product. The user copy-pastes from it into App Store Connect at Phase 5 submission time.

## Non-goals

- **Code changes.** Icon and splash are already wired in `app.config.ts` and the asset files exist at the correct dimensions. No source edits.
- **Asset changes.** No re-export or re-mastering of the 1024×1024 icon or splash. If the icon needs adjustment at small sizes, that's a follow-up after device verification.
- **EAS Build production profile.** Phase 5 owns the production build infrastructure.
- **Android Play Console listing.** Phase 6. Different field structure (short description vs full description, different limits).
- **Actually capturing the screenshots.** Phase 5. Requires a production iOS build on a real device.
- **Building support, marketing, or privacy policy pages.** The user provides URLs; this sub-project only places placeholder slots.

### In scope (treatment A confirmed)

- **Screenshot caption / overlay design.** Treatment A locked in (bold caption on top, full-bleed phone screenshot below — Things / Notion style). Specific caption text per-screen is committed in §11 of `docs/STORE_LISTING.md`. Actual screenshot capture is still Phase 5 (requires production build), but Phase 5's capturer has the captions + composition spec ready to follow.

## Architecture

### File layout

```
docs/
  STORE_LISTING.md              NEW — the artifact
docs/superpowers/
  specs/2026-05-12-phase-4-store-listing-design.md     NEW — this spec
  plans/2026-05-12-phase-4-store-listing.md            NEW — implementation plan
```

No code, no tests, no `app.config.ts` changes.

### Contract for `docs/STORE_LISTING.md`

Single markdown file, 11 top-level sections in this order:

1. **App Name** — proposed value + Apple's char limit (≤30) + count.
2. **Subtitle** — proposed value `RPG stats for real life` + alternates.
3. **Promotional Text** — proposed copy + char count.
4. **Description** — three full drafts at ~1200, ~2500, ~3800 chars so the user can pick a length that matches their preference for verbosity. Each draft has the same structural beats: pitch, how it works, six attributes, missions/streak, honest decay mention, privacy story, device requirements, closing CTA.
5. **Keywords** — single comma-separated string ≤100 chars; rationale per keyword group.
6. **Categories** — `Lifestyle` primary, `Productivity` secondary.
7. **Age Rating** — `4+` with rationale and a one-line summary of Apple's questionnaire answers (no mature content, no UGC, no ads, no IAP gambling).
8. **Privacy Nutrition Label** — every section marked `Data Not Collected` with one-line rationale.
9. **Supported Devices list** — required Apple-Intelligence-capable iPhones, per `docs/PRD.md` §5.2.
10. **URLs** — three labelled placeholders the user fills.
11. **Screenshots plan + composition** — required device sizes; six screens listed in capture order with explicit setup conditions (e.g., character level 4, specific log text); the treatment-A composition spec (caption typography, padding, phone frame); the six per-screen caption strings to overlay.

### Treatment A composition spec (baked into §11)

- **Background:** solid `#0E1116` (matches app bg color).
- **Caption block:** top of frame, ~16% of vertical height. Left-aligned. Two-line max.
  - Line 1: white (`#E6EDF3`), font weight 800, size ~64pt at 1290×2796 output (≈ App Store 6.7" screenshot resolution).
  - Line 2: gold accent (`#E8C547`), same weight + size.
- **Phone area:** ~84% of vertical height. Screenshot is full-bleed inside an iPhone device frame (use Apple's official Marketing Resources frame or generate via a tool like Mockuuups Studio).
- **Padding:** 64pt horizontal margins inside the caption block; phone screenshot fills horizontally with ~32pt left/right margin.
- **Font:** the same Manrope family the app uses (`Manrope_800ExtraBold` for line 1, `Manrope_800ExtraBold` for line 2 — single weight, color difference is the contrast).

### Six per-screen captions (in capture order)

| # | Screen | Caption line 1 (white) | Caption line 2 (gold) |
|---|---|---|---|
| 1 | Character Sheet | `Type what you did.` | `AI builds your character.` |
| 2 | Log Entry modal | `One sentence.` | `That's the whole loop.` |
| 3 | XP gain reveal | `Earn it.` | `Watch it land.` |
| 4 | Level-up overlay | `Level up the parts of you` | `that actually matter.` |
| 5 | Missions tab | `Daily targets,` | `picked from your weak spots.` |
| 6 | AI Engine confirmation | `On-device AI.` | `Your logs never leave your phone.` |

These captions are deliberately short — they fit treatment A's two-line bold format and read clearly at App Store thumbnail size. Line 1 carries the verb / setup; line 2 carries the gold-highlighted payoff.

Each section starts with a clear `## N. <Section title>` heading so the user can quickly scan for the field they're filling in App Store Connect.

### Brand positioning baked into the draft copy

The doc commits to these positioning choices throughout. They can be changed before submission but should drive consistency:

- **Single-sentence hook:** "Type what you did today. AI turns it into XP across six attributes. Watch your character grow."
- **Privacy as a moat:** every long-form copy section ends on a privacy line ("Your logs never leave your phone."). The on-device AI is the differentiator; the description leans into it.
- **Honest decay mention:** in long-form copy, decay is named explicitly — "Skip a few days and your in-progress XP slowly fades (your levels never decrease)." Apple reviewers respond well to honest mechanics descriptions; users feel betrayed when undisclosed mechanics frustrate them.
- **No "AI" in marketing copy except where the privacy story makes it relevant.** Avoids App Store Review treating it as an "AI app" subject to Apple's evolving AI submission rules. The phrase "AI" appears in keywords and in the privacy paragraph; nowhere else.

## Testing & verification

No automated tests. Verification is a single review pass:

- **Character-count checks:** every field's draft has its byte length printed in the doc. The user (or a future me) confirms each draft is within Apple's limit before paste-in.
- **Keywords overlap check:** the keyword list does not duplicate words already in the subtitle or app name (Apple deduplicates, so this is wasted budget). The proposed keywords are all words NOT in the name/subtitle.
- **URL fields:** the doc explicitly notes "must resolve at submission time" for the Privacy Policy and Support URLs. These are submission blockers.
- **No PII or accidental real-name copy.** The draft uses Questum as the brand name only; no developer name, address, or personal info.

Manual verification at Phase 5 submission time:
1. Open `docs/STORE_LISTING.md` alongside App Store Connect's listing-edit UI.
2. Paste each field in the order listed in the doc.
3. Confirm App Store Connect's live character counter matches the doc's stated count (catches surprise emoji/curly-quote byte differences).
4. Submit the supported-devices list as `docs/PRD.md` §5.2 already requires.

## Acceptance criteria

This sub-project is complete when:

1. `docs/STORE_LISTING.md` exists with all 11 sections populated.
2. Each text field has a draft + character count that fits Apple's limit.
3. Three Description drafts (short/medium/long) are present so the user can pick a length at submission time.
4. The keywords list is ≤100 chars including commas, with no overlap with the app name or subtitle.
5. The supported-devices list mirrors `docs/PRD.md` §5.2 (Apple-Intelligence-capable iPhones).
6. URLs are placeholders with a clear "PROVIDE BEFORE SUBMISSION" call-out.
7. Screenshots plan lists six screens in capture order with setup conditions, plus the required device sizes, the treatment-A composition spec, and the six per-screen captions.
8. The doc is committed to git.

## Risks and open questions

- **Apple's character limits may shift.** Subtitles were 30 chars at launch but Apple has shifted limits before. The doc states each limit; a final check at submission time should confirm against the current App Store Connect UI.
- **"AI" in the description triggers extra review.** Mitigated by minimizing "AI" mentions in marketing copy (see brand positioning above). If Apple adds an AI-app questionnaire by submission time, the user fills it; nothing in this doc precludes that.
- **Subtitle search-ranking.** "RPG stats for real life" places "RPG" prominently. If the user later wants to compete for "habit tracker" or "productivity" searches more directly, the subtitle is a low-cost edit post-launch.
- **Description tone.** The drafts assume an enthusiastic-but-not-corny tone. If the user wants a more clinical (Habitify-style) or more whimsical (Habitica-style) voice, the drafts need a rewrite. Two drafts is one of the variability dimensions to test.

## Out of scope (tracked elsewhere)

- App icon and splash audit at small sizes — follow-up after the user runs an EAS build and sees the icon on the home screen.
- EAS Build production profile — Phase 5.
- Privacy Policy page hosting — Phase 5 (or earlier if the user prefers; not on this sub-project's critical path).
- Screenshot capture — Phase 5, after a production build runs on iPhone hardware. (Caption design + composition spec ARE in scope this sub-project — see §11 of `STORE_LISTING.md`.)
- Android Play Console listing — Phase 6.
- Real `AppleAIService` — Phase 5.
