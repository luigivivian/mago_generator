---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
plan: 03
subsystem: frontend-ads
tags: [seedance, multi-shot, camera-moves, transitions, video-config]
dependency_graph:
  requires: [shared-video-models]
  provides: [seedance-config-component, seedance-conditional-rendering]
  affects: [ads-new-page, create-v2-submit]
tech_stack:
  added: []
  patterns: [conditional-rendering, preset-auto-fill, controlled-components]
key_files:
  created:
    - memelab/src/components/ads/seedance-config.tsx
  modified:
    - memelab/src/app/(app)/ads/new/page.tsx
decisions:
  - "Step 4 gate widened to readyForPrompt so users can select Seedance model before composing images"
  - "Used valid TakeConfig camera_move values only (replaced plan's handheld/pan_right/drone with push_in/pull_back/crane)"
metrics:
  duration_seconds: 161
  completed: 2026-04-12T21:59:00-03:00
  tasks_completed: 3
  tasks_total: 3
  files_changed: 2
---

# Phase 1004 Plan 03: Seedance Multi-Shot Configuration Summary

SeedanceConfig component with shot count slider (2-4), preset auto-fill (product/lifestyle/dynamic/custom), and per-shot cards with camera move, duration, and transition controls, conditionally rendered when a bytedance/* model is selected in the V2 creation wizard.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create SeedanceConfig component | 60d779f | New component with 12 camera moves, 5 transitions, 4 presets, shot slider 2-4, per-shot subject/camera/duration/transition cards |
| 2 | Wire SeedanceConfig into V2 creation page | cc6ffa5 | Conditional render via isSeedanceModel, shots->scene_prompts assembly, readyToSubmit dual logic, Step 4 gate widened |
| 3 | Human verification | approved | User verified complete Seedance flow end-to-end |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid camera move values in preset configs**
- **Found during:** Task 1
- **Issue:** Plan specified `handheld`, `pan_right`, and `drone` as camera move values in lifestyle/dynamic presets, but these are not valid TakeConfig.camera_move literals
- **Fix:** Replaced with valid values: `handheld`->`push_in`, `pan_right`->`pull_back`, `drone`->`crane`
- **Files modified:** memelab/src/components/ads/seedance-config.tsx
- **Commit:** 60d779f

**2. [Rule 2 - Missing functionality] Step 4 section hidden until compositions approved**
- **Found during:** Task 2
- **Issue:** Step 4 was gated on `approvedComposed.length > 0`, making it impossible for users to select a Seedance model (and see the multi-shot config) without first going through the composition flow
- **Fix:** Widened gate to `approvedComposed.length > 0 || readyForPrompt`, allowing Step 4 to appear after images are selected and product info filled. Submit button disabled via `readyToSubmit` controls actual submission readiness.
- **Files modified:** memelab/src/app/(app)/ads/new/page.tsx
- **Commit:** cc6ffa5

## Verification Results

- TypeScript compilation: PASS (0 new errors; pre-existing editor/test errors unchanged)
- SeedanceConfig imported in ads/new/page.tsx: PASS
- isSeedanceModel conditional rendering: PASS
- readyToSubmit dual logic: PASS
- scene_prompts assembly from shots: PASS

## Self-Check: PASSED
