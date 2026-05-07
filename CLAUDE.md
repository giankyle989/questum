# Questum — Claude Code Instructions

## What this project is

Questum is a React Native (Expo) mobile app that turns real-life activities into RPG character progression. Users type what they did in natural language, on-device AI parses it into XP and attribute gains, and a character levels up over time. The product wedge is **friction-free logging via on-device AI** — Apple Foundation Models on iOS, Gemini Nano on Android.

**Target platforms:** iOS 26+ (iPhone 15 Pro and newer) and Android 14+ with Gemini Nano support. Distribution is gated at the store level (App Store Connect Supported Devices list + Play Console Device Catalog), so incompatible devices can't purchase. See `docs/PRD.md` §5 for the gating strategy.

**Monetization:** One-time purchase. No cloud AI costs in MVP — strictly on-device only.

## Critical constraints

1. **No Mac available during development.** Build everything that doesn't require Xcode first. The AI integration phase happens last, via cloud Mac rental (MacinCloud) for a single ~$10 session.
2. **On-device AI only.** No cloud LLM fallback. Store-level filtering keeps unsupported devices from buying; rare runtime failures show an inline banner with a Settings deep link.
3. **Local-first storage.** SQLite via expo-sqlite. No backend, no accounts, no sync in MVP.
4. **TypeScript strict mode.** No `any`, no `@ts-ignore` without a comment explaining why.
5. **Pure functions for game logic.** XP, leveling, decay, and mission matching must be pure and unit-tested. UI must never contain game rules.

## Build phases (do not skip ahead)

The project is built in strict order. Do not start a phase before the previous one is functional and tested.

- **Phase 1:** Foundation — project setup, SQLite schema, state management, navigation skeleton
- **Phase 2:** Game engine — pure logic for XP, leveling, decay, streaks, missions. Unit tested.
- **Phase 3:** UI — all screens wired to a **mock AIService** (keyword-based classifier)
- **Phase 4:** Polish — animations, notifications, mission generator, AI-unavailable banner
- **Phase 5:** Real AI integration — Apple Foundation Models + Gemini Nano. Requires Mac access. Last phase before App Store submission.

The mock AIService in Phase 3 is scaffolding, NOT a fallback. The real AI must work for the product to ship. Phase 5 is non-negotiable before submission.

## Documentation structure

Read these files in order before starting any task:

- `CLAUDE.md` — this file (project overview, constraints, conventions)
- `docs/PRD.md` — full product requirements
- `docs/ARCHITECTURE.md` — module structure, data flow, AIService contract
- `docs/GAME_RULES.md` — XP curves, decay formulas, mission rules (the spec for the game engine)
- `docs/SCHEMA.md` — SQLite schema and migration approach
- `docs/AI_CONTRACT.md` — input/output contract for AIService, prompt design, schema validation
- `docs/UI_SPEC.md` — screens, components, navigation flow
- `docs/PHASES.md` — detailed task breakdown per phase with acceptance criteria
- `docs/CONVENTIONS.md` — code style, naming, testing, commit conventions
- `docs/MOCK_AI.md` — keyword classifier spec (used in Phases 1-4)
- `docs/AI_SPIKE.md` — protocol for testing real AI on Mac (Phase 5)

## Working principles for Claude Code

When making changes:

1. **Read the relevant doc first.** If editing the game engine, re-read `GAME_RULES.md`. If touching the AI layer, re-read `AI_CONTRACT.md`. Do not work from memory.
2. **Stay in the current phase.** If user asks for something that belongs in a later phase, flag it and propose deferring. Do not silently scope-creep.
3. **Write tests for game logic.** Any change to XP, decay, leveling, streak, or mission matching requires updated unit tests in the same commit.
4. **Never put game rules in UI components.** UI calls game engine functions. Game engine never imports from UI.
5. **AIService is an interface, not an implementation.** All consumers depend on the interface. The mock and real implementations are swappable. Do not let the mock leak abstractions to the rest of the app.
6. **Ask before architectural changes.** New libraries, new state stores, new navigation patterns — flag and confirm before adding.
7. **Default to small, reviewable diffs.** A working `LogEntryScreen` in three commits beats a 600-line monolith in one.

## Tech stack (locked)

- **Framework:** Expo SDK (managed workflow), TypeScript
- **Build:** EAS Build for production builds (no Mac required)
- **State:** Zustand
- **Storage:** expo-sqlite
- **Navigation:** Expo Router
- **UI:** NativeWind (Tailwind for React Native) + custom components
- **Testing:** Jest for game engine; React Native Testing Library for components
- **Animation:** Reanimated 3 + Moti for level-ups and XP reveals
- **Voice input:** Expo Speech Recognition (Phase 4)

Do not add libraries outside this list without proposing the addition and getting confirmation.

## What "done" means for the MVP

- All 5 phases complete
- AI spike validated (>85% attribute correctness on the 30-log test set)
- App runs on physical iPhone 15 Pro+ and a supported Android device
- App Store Connect Supported Devices list and Play Console Device Catalog configured to exclude incompatible devices (verified via store-listing preview)
- App Store and Play Store submission packages prepared via EAS Submit
- Privacy nutrition label complete and accurate
