# Phase 4 — App Store Listing Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single business artifact — `docs/STORE_LISTING.md` — containing every App Store Connect text field Questum will need at submission time. No code changes.

**Architecture:** Single markdown file at the docs root with 11 top-level sections in fixed order, mirroring App Store Connect's listing-edit UI so the user can scan top-to-bottom at submission time.

**Tech Stack:** Markdown only. No tests, no lint, no build hooks.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-4-store-listing-design.md`

---

## File Structure

| Path | New / Modify | Responsibility |
|---|---|---|
| `docs/STORE_LISTING.md` | New | The artifact — all 11 sections of App Store listing copy + composition spec |

No source files touched. No `app.config.ts` or asset changes.

---

## Task 1: Draft `docs/STORE_LISTING.md`

**Files:**
- Create: `docs/STORE_LISTING.md`

Sections, in order:

- [ ] **Step 1.1: §1 App Name** — propose `Questum: Level Up Real Life` (27 chars) + one shorter alternate. State Apple's 30-char limit and the exact byte count of each option.

- [ ] **Step 1.2: §2 Subtitle** — primary `RPG stats for real life` (23 chars), three alternates, each with byte count. State Apple's 30-char limit.

- [ ] **Step 1.3: §3 Promotional Text** — single draft ≤170 chars, with byte count printed.

- [ ] **Step 1.4: §4 Description** — three full drafts at ~1200, ~2500, ~3800 chars. Each must follow the same beat order: pitch, how it works, six attributes, missions/streak, honest decay mention, privacy story, device requirements, closing CTA. Print exact byte counts after each draft. Avoid the word "AI" outside the privacy paragraph and keywords (per spec's brand-positioning rule).

- [ ] **Step 1.5: §5 Keywords** — single comma-separated string ≤100 chars. Words must NOT overlap with the App Name or Subtitle (Apple deduplicates). Print exact byte count. Group keywords by rationale (loop verbs, genre, mechanic, audience).

- [ ] **Step 1.6: §6 Categories** — `Lifestyle` primary, `Productivity` secondary, one-line rationale.

- [ ] **Step 1.7: §7 Age Rating** — `4+`, one-line rationale, one-line summary of Apple's questionnaire answers (no mature content, no UGC, no ads, no IAP gambling).

- [ ] **Step 1.8: §8 Privacy Nutrition Label** — every Apple section marked `Data Not Collected` with a one-line rationale per section.

- [ ] **Step 1.9: §9 Supported Devices list** — Apple-Intelligence-capable iPhones, mirroring `docs/PRD.md` §5.1. Explicit device names so the user can tick the boxes in App Store Connect.

- [ ] **Step 1.10: §10 URLs** — three labelled placeholders (Support, Marketing, Privacy Policy) with a `PROVIDE BEFORE SUBMISSION` call-out.

- [ ] **Step 1.11: §11 Screenshots plan + composition** — required device sizes (6.9" and 6.7" as the gating buyer base); six screens in capture order with setup conditions; the Treatment A composition spec (caption typography, padding, phone frame); the six per-screen caption strings from the spec table.

---

## Task 2: Verify acceptance criteria

- [ ] **Step 2.1: Character-count audit** — every drafted field has its byte length printed in the doc. Each value ≤ Apple's limit.

- [ ] **Step 2.2: Keyword overlap check** — every keyword in §5 is NOT present in App Name §1 or Subtitle §2 (Apple auto-indexes those; duplication wastes the 100-char budget).

- [ ] **Step 2.3: Privacy nutrition consistency** — every privacy nutrition row in §8 says `Data Not Collected`. Matches `docs/PRD.md` §9.

- [ ] **Step 2.4: Device list cross-check** — §9 devices match `docs/PRD.md` §5.1 verbatim (iPhone 15 Pro, 15 Pro Max, 16 series, 17 series, and newer Apple-Intelligence iPhones).

- [ ] **Step 2.5: Brand-positioning compliance** — `AI` appears only in §5 (keywords), §8 (privacy nutrition rationale, if relevant), §11 (caption #6), and the privacy paragraphs of §4 drafts. Description body otherwise says "on-device intelligence."

- [ ] **Step 2.6: No PII** — no personal name, address, email, or developer info in any draft.

---

## Task 3: Commit

- [ ] **Step 3.1: Stage and commit**

```bash
git add docs/STORE_LISTING.md docs/superpowers/plans/2026-05-12-phase-4-store-listing.md
git commit -m "docs(phase-4): draft App Store listing artifact"
```

The pre-commit hook runs lint + typecheck; both should be no-ops for markdown-only changes.

---

## Acceptance criteria

This sub-project is complete when:

1. `docs/STORE_LISTING.md` exists with all 11 sections populated.
2. Every text field has a draft + character count that fits Apple's limit.
3. Three Description drafts (short/medium/long) are present.
4. The Keywords string is ≤100 chars, no overlap with App Name or Subtitle.
5. The Supported Devices list mirrors `docs/PRD.md` §5.1.
6. URLs are placeholders with a clear `PROVIDE BEFORE SUBMISSION` call-out.
7. The Screenshots plan lists six screens in capture order with setup conditions, required device sizes, the Treatment A composition spec, and the six per-screen captions.
8. The doc is committed to git.
