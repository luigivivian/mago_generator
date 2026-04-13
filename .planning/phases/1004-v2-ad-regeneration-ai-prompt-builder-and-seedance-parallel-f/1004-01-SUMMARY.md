---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
plan: 01
subsystem: frontend-ads
tags: [video-models, shared-constants, model-selector, seedance]
dependency_graph:
  requires: []
  provides: [shared-video-models, model-selector-v2]
  affects: [ads-new-page, ads-job-page, step-video]
tech_stack:
  added: []
  patterns: [shared-constants, select-dropdown]
key_files:
  created:
    - memelab/src/lib/video-models.ts
  modified:
    - memelab/src/app/(app)/ads/new/page.tsx
    - memelab/src/app/(app)/ads/[jobId]/page.tsx
    - memelab/src/components/ads/step-video.tsx
decisions:
  - "Merged all 3 VIDEO_MODELS arrays (5+10+5 entries) into single shared file with 10 unique models"
  - "Seedance models use 4s/8s durations per kie_client.py research, not 5s/10s"
  - "Replaced button-group model selector with shadcn Select for better scaling with 10 models"
metrics:
  duration_seconds: 178
  completed: 2026-04-12T21:47:00-03:00
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 1004 Plan 01: Shared VIDEO_MODELS and V2 Model Selector Summary

Consolidated three duplicate VIDEO_MODELS arrays into a single shared constant with 10 models including Seedance (4s/8s durations), replaced button-group selector with Select dropdowns that auto-adapt duration options.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Extract VIDEO_MODELS to shared constant file | d5046a9 | Created video-models.ts, removed duplicates from 3 consumers |
| 2 | Add model selector and duration picker to V2 creation form | 0d3addc | Replaced button-group with Select components, auto-correct duration on model switch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added note display to step-video and jobId model lists**
- **Found during:** Task 1
- **Issue:** After consolidating to shared VideoModel with separate label/note fields, the step-video SelectItem and jobId option elements only showed m.label, losing context like "(premium)"
- **Fix:** Added `{m.note ? ` (${m.note})` : ""}` to both consumers
- **Files modified:** memelab/src/components/ads/step-video.tsx, memelab/src/app/(app)/ads/[jobId]/page.tsx
- **Commit:** d5046a9

## Verification Results

- TypeScript compilation: PASS (0 errors in modified files; 10 pre-existing errors in unrelated editor/test files)
- Single VIDEO_MODELS definition: PASS (only in video-models.ts)
- No V2_MODELS references: PASS (all renamed to VIDEO_MODELS)
- Seedance durations: PASS (4s/8s in shared constant)
- Duration auto-correction: PASS (switching model resets duration if incompatible)

## Self-Check: PASSED

All 4 files exist. Both commits (d5046a9, 0d3addc) verified in git log.
