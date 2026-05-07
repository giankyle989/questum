# Questum

**Turn your life into an RPG.** Tell the app what you did in plain language. On-device AI parses it into XP across six classic attributes (STR, DEX, CON, INT, WIS, CHA). Your character levels up when you do.

## Why it exists

Most habit trackers fail because logging is work — checkboxes, tags, upfront goal-setting — for delayed, abstract rewards. Questum's wedge is **friction-free logging via on-device AI**: type a sentence, the AI does the rest.

- **No checklists.** Free-form natural language.
- **No subscription.** One-time purchase, on-device AI only — no cloud LLM costs.
- **No accounts.** Local-first; your data never leaves your phone.
- **Visible cost of slacking.** Small daily decay (after a 2-day grace period) so consistency actually matters.

## Core mechanics

- Six attributes mapped to real-life domains (lifting → STR, studying → INT, calls → CHA, etc.)
- Each attribute levels independently; total character level = average
- Daily XP cap per attribute prevents farming
- Streak multiplier rewards consecutive days, up to 1.20x at day 7+
- Adaptive daily missions and a weekly quest, seeded from your own recent log patterns — no upfront goal-setting
- Decay only nibbles in-progress XP; once you hit a level, you keep it

Full mechanics: [`docs/GAME_RULES.md`](docs/GAME_RULES.md).

## Platforms

- **iOS 26+** on Apple Intelligence devices (iPhone 15 Pro and newer) — Apple Foundation Models
- **Android 14+** with Gemini Nano (Pixel 8+, Galaxy S24+, and others with AICore)

Unsupported devices see a waitlist screen instead of a degraded experience.

## Status

MVP in development. Built in five strict phases:

1. **Foundation** — project setup, SQLite schema, state, navigation
2. **Game engine** — pure logic for XP, leveling, decay, streaks, missions (unit tested)
3. **UI** — all screens wired to a mock AI service
4. **Polish** — animations, notifications, mission generator, soft gate
5. **Real AI integration** — Apple Foundation Models + Gemini Nano

Full task breakdown: [`docs/PHASES.md`](docs/PHASES.md).

## Tech stack

Expo (managed workflow) · TypeScript · Expo Router · Zustand · expo-sqlite · NativeWind · Reanimated 3 + Moti · Jest + React Native Testing Library

## Project docs

Start with [`CLAUDE.md`](CLAUDE.md) for the project overview and engineering rules. All design docs live in [`docs/`](docs/) — product, architecture, game rules, AI contract, schema, UI spec, conventions, and the Phase 5 AI validation protocol.
