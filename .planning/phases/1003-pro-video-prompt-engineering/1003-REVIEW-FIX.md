---
phase: 1003-pro-video-prompt-engineering
fixed_at: 2026-04-11T12:59:00-03:00
review_path: .planning/phases/1003-pro-video-prompt-engineering/1003-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 1003: Code Review Fix Report

**Fixed at:** 2026-04-11T12:59:00-03:00
**Source review:** .planning/phases/1003-pro-video-prompt-engineering/1003-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (4 warnings, fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Gemini fallback uses unawaited bare `genai.Client()` instead of injected client

**Files modified:** `src/product_studio/scene_composer.py`
**Commit:** e157b61
**Applied fix:** Replaced `genai.Client()` with `_get_client()` (the project-standard injected client). Changed `await client.aio.models.generate_content` to `await asyncio.to_thread(client.models.generate_content, ...)` to match the sync client pattern used throughout the file. Removed unused `from google import genai` import.

### WR-02: `build_free_prompt` embeds negative but char budget doesn't account for it

**Files modified:** `src/product_studio/prompt_builder.py`
**Commit:** c8464a5
**Applied fix:** Moved negative prompt construction before the length check. Calculated `max_positive = 2000 - len(" Negative: {negative}") - 1` so the positive prompt leaves room for negative embedding by callers without exceeding `TakeConfig.prompt` max_length=2000.

### WR-03: `food_burger` hero-action contains "hands" — violates no-humans rule

**Files modified:** `src/product_studio/config.py`
**Commit:** b1966fd
**Applied fix:** Replaced `"hands pressing down on bun with juices flowing"` with `"cheese melting and dripping in slow-motion with juices pooling"` — keeps the juicy action without human body parts, consistent with the no-humans/no-hands rule enforced across all other system layers.

### WR-04: Camera-move enum mismatch between TakeConfig and Gemini fallback JSON schema

**Files modified:** `src/product_studio/scene_composer.py`, `src/product_studio/config.py`
**Commit:** e157b61
**Applied fix:** Expanded the Gemini fallback JSON schema enum to include all 12 values from `TakeConfig.camera_move`: added `dolly_in`, `tilt_up`, `pull_back`, `product_rotate`. Also updated the instruction text to list all valid camera moves. In config.py, added missing `STABILITY_SUFFIXES` entries for `"static"`, `"dolly"`, and `"macro_zoom"` so every camera move that can appear in a prompt has a specific stability instruction.

## Skipped Issues

None -- all in-scope findings were fixed.

---

_Fixed: 2026-04-11T12:59:00-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
