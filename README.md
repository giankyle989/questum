# Questum — Documentation

This folder contains the project's design and engineering docs. Drop the entire folder into the root of your Claude Code project, and Claude will read `CLAUDE.md` first.

## Reading order for humans

1. `CLAUDE.md` — start here. The project overview, constraints, and rules of engagement.
2. `docs/PRD.md` — what we're building and why.
3. `docs/PHASES.md` — how we're building it, in order.
4. `docs/ARCHITECTURE.md` — module structure and dependency rules.
5. `docs/GAME_RULES.md` — exact game mechanics (the spec for the engine).
6. `docs/AI_CONTRACT.md` — input/output contract for any AI implementation.
7. `docs/SCHEMA.md` — SQLite schema and migration approach.
8. `docs/UI_SPEC.md` — screens and components.
9. `docs/CONVENTIONS.md` — code style, naming, testing.
10. `docs/MOCK_AI.md` — keyword classifier for Phases 1-4.
11. `docs/AI_SPIKE.md` — validation protocol for Phase 5.

## How to use with Claude Code

In your project directory, place these files at the root level:

```
your-project/
├── CLAUDE.md               ← project overview, Claude reads this first
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── GAME_RULES.md
│   ├── SCHEMA.md
│   ├── AI_CONTRACT.md
│   ├── UI_SPEC.md
│   ├── PHASES.md
│   ├── CONVENTIONS.md
│   ├── MOCK_AI.md
│   └── AI_SPIKE.md
└── (your code)
```

When prompting Claude Code, reference docs explicitly when relevant:
- "Implement the decay function per `docs/GAME_RULES.md` section 'Decay'"
- "Build the LogEntryScreen per `docs/UI_SPEC.md`, using the mock AIService"
- "We're starting Phase 1, follow `docs/PHASES.md` Phase 1 task list"

This keeps Claude Code grounded in your actual decisions instead of inventing.

## Updating these docs

The docs are not frozen. As you make decisions, update the relevant doc and commit. The doc is the source of truth; the code follows the doc.

Examples of changes that should update docs:
- Choosing a specific React Native AI library → update `AI_CONTRACT.md` "Platform implementation notes"
- Tweaking decay rate after testing → update `GAME_RULES.md` constants
- Adding a new screen → update `UI_SPEC.md`
- Locking the launch price → update `PRD.md` pricing section

Don't let the code drift ahead of the docs.

## What's NOT in here

- Visual design (color palette specifics, exact typography, illustration style) — this happens in Phase 4
- Marketing copy and App Store metadata — drafted in Phase 4, finalized post-Phase 5
- Backend / server code — there is none in MVP
- Specific React Native AI library choice — verify and lock during Phase 5 prep, not before

## Questions still open

Tracked in `docs/PRD.md` section 13. As they get resolved, move them out of "open questions" and into the relevant section of the doc.
