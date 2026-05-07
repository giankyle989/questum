# Questum — Product Requirements

**Status:** v0.3 — refined after design discussion
**Target release:** MVP, ship fast, iterate after launch
**Platforms:** iOS 26+ on Apple Intelligence devices, Android 14+ with Gemini Nano
**Monetization:** One-time purchase, App Store and Play Store

## 1. Vision

Turn your life into an RPG. Real activities feed XP into a character that visibly grows. The leveling system itself is the motivator — people show up because they want to see their character get stronger.

The differentiator vs existing habit/RPG apps (e.g., Habitica) is **friction-free logging via on-device AI**. Users type a sentence in natural language; the AI does the categorization. No checkboxes, no upfront goal-setting, no manual tagging.

## 2. Problem

Most habit apps fail because they ask users to do extra work — logging, configuring, tagging — for delayed, abstract rewards. The cost of inaction feels invisible. We need a tracker where:

- The reward is immediate and visible
- Logging takes seconds
- Idleness has a small visible cost
- The system adapts to the user instead of demanding upfront commitment

## 3. Target audience

**Primary persona:** People in their 20s-30s who feel they're underperforming relative to their potential, are tech-forward enough to own a flagship phone, and have tried and abandoned at least one habit/productivity app already.

These users have low cheating incentive — logging fake activities defeats the purpose, since the goal is real-world self-improvement.

**Anti-personas:**
- Power users wanting analytics, exports, custom rules
- Users seeking medical or fitness coaching
- Users wanting hardcore punishment mechanics (character death, lockouts)

## 4. Core game system

### 4.1 Attributes

Six attributes mapped to real-life domains:

| Attribute | Domain | Example activities |
|---|---|---|
| STR | Physical exertion | Lifting, sports, manual labor, hiking |
| DEX | Skill and coordination | Cooking, music, crafts, fine motor |
| CON | Health and endurance | Cardio, sleep, hydration, healthy meals |
| INT | Learning and analysis | Studying, reading nonfiction, courses |
| WIS | Reflection and discipline | Meditation, journaling, planning |
| CHA | Social and expression | Calls, hangouts, presentations, creative work |

### 4.2 XP and leveling

- Each attribute levels independently
- Total character level = average of attribute levels
- XP-to-next-level scales with level: `level_N_threshold = 100 * N`
- Daily cap: max 200 XP per attribute per day
- AI returns 0–100 XP per log based on effort, duration, difficulty cues

### 4.3 Consistency vs improvement (refined)

Two separate XP mechanics, do not conflate:

- **Consistency floor:** Stable XP for showing up. A 5km jog gets ~the same XP whether it's day 1 or day 100. Plus the streak multiplier described below.
- **Improvement bonus:** Extra XP when the user pushes past prior records (longer run, heavier lift, harder book, longer meditation). Detected by the AI from log content.

This rewards both consistency and progressive overload without punishing routine.

### 4.4 Streak multiplier

Logging on consecutive days adds a small multiplier:
- Day 1-2: 1.00x
- Day 3-4: 1.05x
- Day 5-6: 1.10x
- Day 7+: 1.20x (cap)

Streak resets if the user misses a day (subject to grace period below).

### 4.5 Decay

Slacking has a small, visible cost. Always on (not opt-in).

- **Grace period:** No decay if `daysSinceLastLog ≤ 2`
- **Decay rate:** Starting at `daysSinceLastLog = 3`, each attribute loses 1% of in-progress XP per day (compound; see `GAME_RULES.md`)
- **Floor:** Decay never reduces a level. Once at level N, stays at level N. Only progress toward next level decays.
- **Restoration:** A single log stops decay for the day, restores full earning rate
- **Pause mode:** User can pause decay for vacations or sick periods, max 14 days/year
- **Tone:** Faint downward shimmer on affected bars, never red warnings or guilt-trip copy
- **First decay event:** One-time explainer modal: "Your character lost some XP from inactivity. This is how the game keeps you honest. You can pause this anytime in settings." Never shown again.

### 4.6 Missions

- **Daily missions:** 3 generated each morning, weighted toward the user's lower attributes
- **Weekly quests:** 1 longer-form mission per week
- **Adaptive seeding:** Generated from the user's recent log patterns and weakest attributes — no upfront goal-setting
- **Mission completion:** Each log is checked against active missions by the AI, which returns matched mission IDs. All MVP missions are binary — a single matching log completes them. Multi-session accumulation is post-MVP.
- **Rewards:** Bonus XP on completion. No currency, no equipment in MVP.

### 4.7 Anti-cheat

- Daily caps (200 XP/attribute/day) prevent farming
- AI prompt includes anti-gaming examples ("climbed Everest" → treat as a hike)
- Code-side validation: XP capped at 100 per log; attribute gains capped at +5 per log post-AI
- No competitive incentive in MVP — cheating only hurts the user's own experience

## 5. Device support and store gating

### 5.1 Supported devices (MVP launch)

- **iOS:** iPhone 15 Pro, 15 Pro Max, 16/16 Pro/16 Pro Max, 17 series, and newer (Apple Intelligence required)
- **Android:** Pixel 8/8 Pro and newer, Galaxy S24/S25 series, and other devices with AICore + Gemini Nano

### 5.2 Store-level gating (primary defense)

Because Questum is a paid app, an incompatible buyer who pays $9.99 and can't use the app is the worst possible experience. The primary defense is the App Store / Play Store filters that prevent purchase from incompatible devices.

- **iOS:** Set `LSMinimumSystemVersion` to iOS 26 in `Info.plist`. At App Store Connect submission, manually set the Supported Devices list to only Apple Intelligence-capable iPhones (iPhone 15 Pro, 15 Pro Max, all iPhone 16 series, all iPhone 17 series, and any newer Apple-Intelligence devices at submit time). Note: there is no public `apple-intelligence` `UIRequiredDeviceCapabilities` key as of Phase 5 planning, so the manual device list is required.
- **Android:** Set `minSdkVersion` to 34 in `AndroidManifest.xml`. In Play Console, use the Device Catalog to restrict installation to Gemini Nano-capable models (Pixel 8/8 Pro/9 series, Galaxy S24/S25 series, other AICore-capable models confirmed at submit time).

Together these filters effectively eliminate the "paid but can't run" scenario.

### 5.3 Runtime fallback (graceful degradation)

Even with strict store gating, runtime AI probe can still fail in rare cases:
- The user disables Apple Intelligence in iOS Settings
- A required system model isn't yet downloaded
- TestFlight or sideloaded builds don't pass through store filters

When the runtime probe fails, the app does NOT show a marketing waitlist or capture an email. Instead it shows an inline banner on the affected screens explaining the situation and offering a recovery path:

> "Apple Intelligence is currently unavailable. Enable it in iOS Settings to use Questum, or contact support if you believe this is in error."

Log entry is disabled while AI is unavailable. The character sheet and history remain viewable so the user is not locked out of their own data. On the next foreground transition, the AI probe re-runs; if it now succeeds, the banner clears and log entry re-enables.

## 6. Onboarding (one-time, minimal)

- 3 welcome/pitch screens (skippable)
- AI capability check + privacy explainer
- Character creation: name + preset avatar
- First-log walkthrough: "tell us what you did today"

**No goal-setting questionnaire.** Missions are seeded from observed log patterns starting day 1.

## 7. Core screens (MVP)

- **Home / Character Sheet:** Avatar, level, six attribute bars, daily missions, recent logs, streak indicator
- **Log Entry:** Single text field, voice input button, submit. Reveal animation showing XP and attribute gains.
- **Missions:** Active daily and weekly missions, completed history
- **History:** Chronological list of logs with XP earned, filter by attribute
- **Settings:** AI source indicator, notifications, decay pause, restore purchase, privacy info

## 8. Notifications

- Daily morning push: "Your missions for today are ready"
- Day-3 inactive nudge (gentle): "Your character is getting bored. Log something?"
- Level-up celebrations stay in-app (no spammy push)

## 9. Data and privacy

- All character data, logs, missions stored on-device (SQLite)
- No accounts in MVP, anonymous local profile
- No data leaves the device (zero cloud calls in MVP)
- Privacy nutrition label: "Data Not Collected"

## 10. Pricing

Launch at higher anchor, run launch-week sale.

- **Launch price:** ₱499 / $9.99
- **Launch week promo:** ₱349 / $6.99 (first 7 days)
- **Easy to adjust** later via App Store Connect / Play Console (takes hours)

## 11. Success metrics

**North star:** Weekly active users with at least 3 logs

**Supporting:**
- Activation rate: % of installs completing onboarding + first log
- Day-7 retention
- Day-30 retention (the real test)
- Average streak length
- AI success rate: % of logs producing valid structured output (target: 95%+)
- Median log latency: <3s on-device
- App Store rating ≥ 4.5

## 11.5 Competitive landscape (as of May 2026)

Direct competitors already on the App Store. Study these before launch.

- **LevelUp AI: Smart Productivity** — RPG to-do list with archetypes (Warrior/Wizard/etc.), AI scheduling, leaderboards. Claims 500k+ users. Closest threat. Cloud AI, subscription-based, structured task lists.
- **Habit Tracker – LevelUP** — Gamified habit tracker with XP, streaks, custom rewards.
- **LevelUP: Fitness** — Fitness RPG with XP, daily quests, dungeons, gear.
- **Habitica** — The original. Free, retro-RPG, social parties and guilds.

### Questum's wedge against these

1. **On-device AI, no subscription** — privacy-first, one-time purchase. Competitors mostly run cloud AI on subscriptions.
2. **Free-form natural language logging** — no checklists, no archetypes, no upfront task setup. Just type what you did.
3. **Six classic D&D-style attributes** mapped to real domains, not invented archetypes.
4. **Ship-fast indie polish** — competitor UIs are crowded with social features, leaderboards, and dungeons. Questum is deliberately minimal.

If during development a competitor closes one of these gaps, revisit. The wedge has to remain real.

## 12. Out of scope for MVP

- Cloud AI fallback
- Social features (friends, leaderboards, parties, guilds)
- Multiple character classes, skill trees, equipment
- Health-app integrations (Apple Health, Google Fit)
- Cross-device sync, accounts
- Goal-setting onboarding
- Web or desktop versions
- iPad / Android tablet optimization
- Custom user-authored missions
- Editable logs after AI processes them (flag for revisit post-launch)

## 13. Open questions to resolve before launch

- Final app name and brand direction
- Avatar system: preset only, or simple customization?
- Decay rate tuning: ship at 1%/day, or A/B test alternatives?
