# Build Phases

Phases are sequential. Each phase has acceptance criteria. Do not start phase N+1 before phase N is fully complete and tested.

**Sequencing note (2026-05-07):** Phases 1–5 ship iOS-only for the v1 App Store launch. Android (Gemini Nano + Play Store) is **Phase 6**, planned after the iOS v1 ships and validates the product. The cross-platform code (Expo, RN, Zustand, expo-sqlite, NativeWind) carries forward; only the AI implementation, store-distribution work, and device-specific testing are platform-specific.

## Phase 1 — Foundation

**Goal:** A blank Expo app on the user's iPhone with SQLite, navigation, and state management ready.

**Tasks:**

1. Initialize Expo project with TypeScript template
2. Configure strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
3. Install and configure: Zustand, expo-sqlite, expo-router, NativeWind
4. Set up SQLite database with migration runner (apply 001_initial.sql)
5. Create repository layer skeletons for all tables
6. Create Zustand store skeletons (empty actions)
7. Set up navigation skeleton (empty screens)
8. Configure EAS Build for development builds
9. Get Expo Go running the app on user's iPhone
10. Set up Husky pre-commit hook running `npm run lint` and `npm run typecheck`
11. Create `src/ai/AIService.ts` interface and `src/ai/schema.ts` Zod schemas (no implementations yet — those are Phase 3)

**Acceptance criteria:**

- App launches on iPhone via Expo Go without errors
- Database file is created on first launch
- Navigation between empty screens works
- Hot reload works during development
- Lint and type-check pass with zero warnings
- README with setup instructions for a fresh clone

**Out of scope for Phase 1:** Any UI beyond placeholder screens. Any game logic. Any AI implementation (only the interface and schema). Any animations.

---

## Phase 2 — Game Engine

**Goal:** All game logic implemented as pure functions with comprehensive unit tests. No UI yet.

**Status:** Complete (2026-05-08). 100% coverage on `src/game/`. All edge cases listed below have explicit tests.

**Tasks:**

1. Implement `src/game/constants.ts` with all values from `GAME_RULES.md`
2. Implement `src/game/xp.ts`: XP application, level threshold, character level calculation
3. Implement `src/game/streak.ts`: streak update logic with date math
4. Implement `src/game/decay.ts`: decay calculation respecting grace period and pause
5. Implement `src/game/missions.ts`: mission generation, progress, completion
6. Implement `src/game/validation.ts`: post-AI clamping
7. Write unit tests covering every function and every edge case in `GAME_RULES.md`
8. Set up Jest with coverage reporting; aim for 100% coverage of `src/game/`

**Acceptance criteria:**

- `npm test` passes with 100% coverage of `src/game/`
- All edge cases from `GAME_RULES.md` have explicit tests
- No imports from React, storage, or any other layer in `src/game/`
- Functions are deterministic — same input always produces same output
- Test names read like specifications

**Specific test cases that MUST exist:**

- XP application with daily cap clamping
- Level-up across single threshold
- Level-up across multiple thresholds in one log
- Streak increment on consecutive days
- Streak reset after 2-day gap
- Decay grace period (no decay days 1-2)
- Decay applied days 3+
- Decay never reduces level
- Decay with pause periods
- Decay over very long inactivity (90+ days)
- Mission completion with bonus XP
- Mission match validation against active missions
- Improvement bonus multiplier
- Streak multiplier at each tier

---

## Phase 3 — UI with Mock AI

**Goal:** Fully functional app on the user's iPhone using `MockAIService`. The user can complete onboarding, log activities, see XP gains, level up, and view history.

**Status:** Complete (2026-05-10). End-to-end verified on iPhone via Expo Go: onboarding → character sheet → log submit → XP applied → mission preview. 275 game-engine/state Jest tests + 34 RNTL screen tests. 100% coverage on `src/game/`, `src/ai/MockAIService.ts`, `src/lib/clock.ts`; 85%+ on `src/storage/repositories/`.

**Tasks:**

1. Implement `MockAIService` per `MOCK_AI.md`
2. Implement onboarding flow (3 slides + character creation + first log)
3. Implement Character Sheet screen with live data from store
4. Implement Log Entry modal with submit flow
5. Implement Missions screen with active/completed sections
6. Implement History screen with infinite scroll and filters
7. Implement Settings screen
8. Wire up Zustand stores to repositories
9. Wire up the full data flow: log → AI → game engine → storage → state → UI

**Acceptance criteria:**

- User can complete onboarding from a fresh install
- User can submit a log and see XP applied to attributes
- Daily caps are visibly enforced (XP stops accumulating once cap hit)
- Streak indicator updates correctly
- Decay runs on app open and visibly affects bars after 3 inactive days (use device clock manipulation for testing)
- Missions generate daily and update progress on matched logs
- All screens render without console warnings
- Tested on iPhone via Expo Go

**Out of scope for Phase 3:** Polished animations (basic transitions only). Real notifications. Voice input.

---

## Phase 4 — Polish

**Goal:** Ship-quality feel. Animations, notifications, mission generator, AI-unavailable banner.

**Status:** Code-complete (2026-05-12). Voice input (task #10) ships behind an `isSupported` gate — manual device verification of the dictation flow is deferred to the Phase 5 Mac-day session (Expo Go cannot load the `expo-speech-recognition` native module, so a custom EAS dev build on a real iPhone is required).

**Tasks:**

1. XP gain reveal animation (Reanimated 3)
2. Attribute bar fill animation
3. Level-up modal with celebration animation
4. Decay shimmer animation
5. Streak milestone animations (3-day, 7-day, 30-day)
6. Configure push notifications (expo-notifications)
7. Daily morning notification scheduler
8. Day-3 inactivity nudge logic
9. Implement actual mission generation algorithm (weighted toward weak attributes)
10. Implement voice input (expo-speech-recognition)
11. First-decay explainer modal
12. Implement runtime AI-unavailable banner per UI_SPEC §"Runtime AI unavailability" (banner UI, FAB disable, Settings deep link, foreground re-probe)
13. App icon, splash screen, asset pipeline
14. App Store / Play Store metadata draft (description, keywords, screenshots plan)

**Acceptance criteria:**

- Every interaction has appropriate feedback (haptic, visual, or both)
- Animations respect `reduceMotion` accessibility setting
- Notifications fire reliably on test device
- Voice input works on iPhone
- AI-unavailable banner appears, disables FAB, and clears on probe re-success when AI availability is toggled in dev tools
- App icon and splash screen render correctly on device

**Out of scope for Phase 4:** Real AI integration (still using mock). App Store submission.

---

## Phase 5 — Real AI Integration

**Requires Mac access.** Cannot use Expo Go — requires custom dev builds.

**Goal:** Replace mock AIService with Apple Foundation Models on iOS. Validate via the AI spike protocol. (Gemini Nano + Android is deferred to Phase 6 — see Sequencing note above.)

**Tasks:**

1. Rent cloud Mac (MacinCloud pay-as-you-go) or use other Mac access
2. Install Xcode 16+, Apple Developer account setup
3. Create iOS dev build with `react-native-apple-llm` (or chosen library)
4. Implement `AppleAIService` per `AI_CONTRACT.md`
5. Implement `aiServiceFactory.ts` with platform detection and availability probe (returns `MockAIService` on non-iOS in this phase; `GeminiNanoService` slot is reserved for Phase 6)
6. Run the AI spike protocol from `AI_SPIKE.md`:
   - 30 test logs across difficulty tiers
   - Score schema validity, attribute correctness, XP reasonableness, latency
   - Run consistency check (same log 5 times)
7. Tune system prompt based on spike results
8. Iterate on few-shot examples until acceptance criteria are met

**Acceptance criteria:**

- Schema validity ≥ 95% on the 30-log test set
- Attribute correctness ≥ 85%
- p95 latency < 5 seconds on iPhone 15 Pro
- Consistency: same log returns within ±15% XP across 5 runs
- Both iOS and Android paths tested on real hardware
- Privacy nutrition label finalized with accurate disclosures

**If acceptance criteria fail:**

- Document the gaps
- Revisit prompt design
- If models can't reach the bar, the product premise needs rethinking — escalate before proceeding

---

## Post-Phase 5 — Submission

Not a build phase, but the final gate before shipping.

**Tasks (iOS-only for v1):**

1. EAS Build production iOS binary
2. App Store Connect setup: pricing (₱499/$9.99), screenshots, description, keywords
3. **Configure App Store Connect Supported Devices list** to only Apple Intelligence-capable iPhones (iPhone 15 Pro, 15 Pro Max, all iPhone 16/17 series, and any newer Apple-Intelligence devices). Verify with App Store Connect's preview that the listing is hidden on incompatible devices.
4. Privacy nutrition label submitted accurately ("Data Not Collected")
5. App review notes prepared (explain on-device AI, why permissions are requested, why the device list is restrictive)
6. Soft launch to a small TestFlight group
7. Address review feedback
8. Public launch with launch-week sale (₱349/$6.99)
9. Monitor crash reports (expo-error-recovery / Sentry)

---

## Phase 6 — Android (post-iOS-launch)

**Status:** Planned post-MVP. Do not begin until Phase 5 is shipping on iOS and the product premise has been validated by real users.

**Goal:** Bring Questum to Gemini Nano-capable Android devices.

**Tasks (sketch — refine when phase begins):**

1. Implement `GeminiNanoService` per `AI_CONTRACT.md` using ML Kit GenAI Prompt API or AICore directly
2. Wire `aiServiceFactory.ts` to return `GeminiNanoService` on Android when probe succeeds
3. Run the AI spike protocol on a Pixel 8+ and a Galaxy S24+ to validate equivalent quality to iOS
4. Tune prompt for any Gemini-specific quirks
5. EAS Build production Android binary
6. Play Console setup: pricing, screenshots, description, keywords
7. **Configure Play Console Device Catalog** to whitelist Gemini Nano-capable devices
8. Privacy nutrition label parity
9. Soft launch to Play Console internal track
10. Public Android launch

---

## What to do when stuck on a phase

If a task in a phase blocks for >2 days:

1. Write down exactly what's failing and why
2. Check if the blocker is a known issue in the relevant library's GitHub issues
3. Consider if the task can be deferred to a later phase without breaking the current phase's acceptance criteria
4. Ask in this conversation with full context — don't silently work around

If a phase's acceptance criteria can't be met within 2x the estimated time:

1. Stop and re-evaluate scope
2. Identify what can be cut
3. Don't push partial work into the next phase to "make progress"
