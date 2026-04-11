---
phase: 1003-pro-video-prompt-engineering
plan: 02
subsystem: product-studio-prompt-assembly
tags: [prompt-builder, scene-composer, template-resolution, stability-suffixes, negative-prompts]
dependency_graph:
  requires: [CATEGORY_CONFIGS, SHOT_PLANS, STABILITY_SUFFIXES, NEGATIVE_PROMPTS_SHOT_TYPE, NEGATIVE_PROMPTS_BASE, FEW_SHOT_EXAMPLES]
  provides: [build_product_prompt, build_negative_prompt, build_free_prompt, resolve_template_vars, generate_storyboard]
  affects: [src/product_studio/pipeline.py]
tech_stack:
  added: []
  patterns: [template-variable-resolution, per-shot-stability, consolidated-negatives, gemini-hybrid-fallback, frame-chaining-toggle]
key_files:
  created: []
  modified: [src/product_studio/prompt_builder.py, src/product_studio/scene_composer.py, src/product_studio/models.py]
decisions:
  - "TakeConfig.prompt max_length raised 463->2000 and camera_move Literal expanded (Rule 3 blocking fix)"
  - "Negative prompts embedded in prompt string as 'Negative: ...' since TakeConfig lacks negative_prompt field"
  - "Fast-path always used when SHOT_PLANS has category entry; Gemini fallback only when no plan exists"
metrics:
  duration: "3m"
  completed: "2026-04-11"
  tasks: 2
  files_modified: 3
---

# Phase 1003 Plan 02: Prompt Assembly Layer Summary

Rewrote prompt_builder.py with template variable resolution ({product}, {hero_action}, {atmosphere}, {micro_detail}), 2000 char budget, consolidated negative prompt concatenation (shot-type -> category -> base -> PRODUCT_PRESERVE), free prompt mode, and Skool-level Gemini system instruction with few-shot examples. Updated scene_composer.py fast-path to use SHOT_PLANS with per-shot STABILITY_SUFFIXES, and Gemini fallback with pro-level instructions including atmosphere and micro_detail fields.

## What Was Done

### Task 1: Rewrite prompt_builder.py (9672936)
- Added `resolve_template_vars()` resolving 5 template variables including {color_grade}
- Rewrote `build_product_prompt()` with camera-as-sentence (12 camera types), lens+DOF, color grade, 2000 char smart truncation
- Rewrote `build_negative_prompt()` with shot_type parameter, 4-layer concatenation order
- Added `build_free_prompt()` returning (positive, negative) tuple with stability suffix
- Upgraded `build_video_prompt()` Gemini system instruction with Skool patterns, few-shot injection, 800 max tokens
- Raised TakeConfig.prompt max_length from 463 to 2000 (blocking fix)
- Expanded TakeConfig.camera_move Literal with 7 new camera types from SHOT_PLANS

### Task 2: Update scene_composer.py (ca54e82)
- Fast-path now uses SHOT_PLANS + resolve_template_vars instead of inline prompt assembly
- Per-shot STABILITY_SUFFIXES replace deprecated global VIDEO_QUALITY_SUFFIX
- Consolidated negatives via build_negative_prompt(category, shot_type=camera_type)
- Gemini fallback instruction upgraded with pro patterns, atmosphere and micro_detail schema fields
- Added high_consistency parameter (default False) signaling frame chaining intent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TakeConfig.prompt max_length 463 blocks 2000 char prompts**
- **Found during:** Task 1
- **Issue:** TakeConfig model has `max_length=463` on prompt field, but plan requires prompts up to 2000 chars. Pydantic validation would reject all new prompts.
- **Fix:** Raised max_length to 2000 in models.py
- **Files modified:** src/product_studio/models.py
- **Commit:** 9672936

**2. [Rule 3 - Blocking] TakeConfig.camera_move Literal missing SHOT_PLANS camera types**
- **Found during:** Task 1
- **Issue:** TakeConfig only allows 5 camera types (dolly, orbit, macro_zoom, static, crane) but SHOT_PLANS uses static_macro, dolly_out, push_in. Pydantic validation would reject fast-path takes.
- **Fix:** Expanded Literal with 7 additional camera types: static_macro, dolly_out, dolly_in, push_in, tilt_up, pull_back, product_rotate
- **Files modified:** src/product_studio/models.py
- **Commit:** 9672936

## Verification Results

Task 1:
- resolve_template_vars resolves all 4+ template variables
- build_product_prompt returns prompts <= 2000 chars with camera-as-sentence, lens, color grade
- build_negative_prompt concatenates shot-type -> category -> base -> PRODUCT_PRESERVE correctly
- build_negative_prompt backward compat (no shot_type) works
- build_free_prompt returns (positive, negative) tuple with stability suffix and 2000 char cap

Task 2:
- generate_storyboard accepts high_consistency parameter
- scene_composer imports and uses STABILITY_SUFFIXES (not VIDEO_QUALITY_SUFFIX)
- Fast-path calls resolve_template_vars for template resolution
- Fast-path calls build_negative_prompt with shot_type for per-shot negatives

## Self-Check: PASSED

- prompt_builder.py: FOUND
- scene_composer.py: FOUND
- models.py: FOUND
- SUMMARY.md: FOUND
- Commit 9672936: FOUND
- Commit ca54e82: FOUND
