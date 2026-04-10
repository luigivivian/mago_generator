---
phase: 1002-product-studio-v2-cinematic-multi-scene-ads
plan: 02
subsystem: product_studio
tags: [kling, prompt-engineering, category-config, cinematic-ads]

requires: []
provides:
  - 7 category-aware prompt templates (food_cookies, food_chocolate, food_burger, beauty_skincare, fashion_shoes, tech_electronics, beverage)
  - CATEGORY_DEFAULT fallback for unknown categories
  - build_product_prompt function assembling Kling-ready prompts from category config + take config
  - build_negative_prompt helper returning per-category negative prompts
affects:
  - 1002-03 (upload endpoint attaches category to job row)
  - 1002-04 (scene_composer + kie_client consume build_product_prompt for Kling payloads)
  - 1002-06 (pipeline orchestrator wires category → prompt per take)
  - 1002-07 (frontend take editor exposes category selector + surfaces negative prompt)

tech-stack:
  added: []
  patterns:
    - Deterministic category-based prompt floor to prevent style drift across AI-generated takes
    - Lazy import of CATEGORY_CONFIGS inside build_product_prompt to avoid circular imports with llm_client

key-files:
  created: []
  modified:
    - src/product_studio/config.py (+117 lines: CATEGORY_CONFIGS + CATEGORY_DEFAULT)
    - src/product_studio/prompt_builder.py (+63 lines: build_product_prompt + build_negative_prompt)

key-decisions:
  - "Category data extracted verbatim from guia-producao-visual-ai-produtos.md sections 3.1-3.7 — no creative interpretation, full fidelity to the production guide"
  - "463-char prompt budget (500 Kling cap - 37 @element overhead) enforced via tail truncation"
  - "Unknown category keys fall back to CATEGORY_DEFAULT — no exception raised, no injection surface (T-1002-04 mitigation)"
  - "Lazy import of CATEGORY_CONFIGS inside functions to avoid triggering llm_client's httpx import chain at module load"

patterns-established:
  - "Category config structure: {display_name, surface, lighting, mood, lens, hero_actions[], video_camera_moves[], negative}"
  - "Prompt assembly: [shot type] + [surface] + [action] + [camera] + [lighting] + [mood] + [lens] + [duration] + [quality tag]"

requirements-completed:
  - REQ-PS2-05

duration: 10min
completed: 2026-04-10
---

# Plan 1002-02: Category Configs + Prompt Builder

**Delivered the deterministic quality floor for all v2 cinematic ad takes — 7 category templates and the Kling-ready prompt assembler.**

## What was built

### Task 1: CATEGORY_CONFIGS in config.py (commit 277d125)
Appended `CATEGORY_CONFIGS` dict to `src/product_studio/config.py` with 7 entries:
- **food_cookies** — dark slate surface, dramatic side+backlight, 100mm macro
- **food_chocolate** — marble/ceramic, dramatic spotlight, 85mm shallow DoF
- **food_burger** — rustic wood, steam + side lighting, 85mm
- **beauty_skincare** — wet marble, soft window light, 85mm with shallow bg
- **fashion_shoes** — dark gradient, three-point lighting, 85mm full sharp
- **tech_electronics** — reflective dark, diffused key + rim, 85mm
- **beverage** — bar counter/terrace, golden hour backlight, 50mm bokeh

Each entry defines `surface`, `lighting`, `mood`, `lens`, `hero_actions[]`, `video_camera_moves[]`, and `negative`. A `CATEGORY_DEFAULT` fallback handles unknown keys without raising.

### Task 2: build_product_prompt in prompt_builder.py (commit 9125f70)
Added two functions to `src/product_studio/prompt_builder.py`:

- **`build_product_prompt(category, camera_move, action_description, element_name="prod", duration=5)`** — assembles Kling-ready video prompt. Maps short camera move names (`dolly`, `orbit`, `macro_zoom`, `static`, `crane`) to natural language. Interpolates surface/lighting/mood/lens from CATEGORY_CONFIGS. Enforces 463-char limit via tail truncation.
- **`build_negative_prompt(category)`** — returns category-specific negative prompt string for Kling API's negative prompt field.

## Verification

Smoke-tested via isolated exec (httpx not installed in orchestrator env, so full module import chain skipped):

```
7 categories OK
len(prompt)=243
prompt: Cinematic commercial shot of @prod on dark slate. cookie breaking in half.
        Camera: slow dolly push-in. dramatic side lighting with warm backlight rim.
        Mood: warm, indulgent, appetizing. Shot with 100mm macro, f/2.8. 5s. 4K, commercial quality.
```

All 7 categories contain required fields (surface, lighting, mood, lens, hero_actions, video_camera_moves, negative). Prompt length well under 463-char budget.

## Deferred

**xfail flip for `test_05_category_templates`** — deferred until Plan 1002-01 lands `tests/test_product_studio_v2.py`. Plan 01 is in the same wave but has not yet executed successfully; the test file does not exist. After Plan 01 completes, the xfail flip must be reapplied as a follow-up commit (one-line decorator removal + new assertion body already specified in the Plan 02 task spec).

## Execution notes

This plan had a troubled execution:
1. First spawn (`abf57d0f` worktree) inadvertently used absolute paths to the main repo instead of its worktree cwd, landing commits on master directly.
2. A tool permission lockdown midway through blocked further writes.
3. Recovery path: orchestrator verified committed Task 1 + uncommitted Task 2 diffs matched the plan spec byte-for-byte, smoke-tested the code, then committed Task 2 as a normal commit on master.

Final state is equivalent to normal execution (branching_strategy=none means commits land on master anyway). The only divergence is two separate commits on master instead of two via worktree→merge.

## Requirements completed

- **REQ-PS2-05** — Category-aware prompt templates with deterministic quality floor
