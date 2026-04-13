---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
plan: 02
subsystem: frontend-ads, backend-ads
tags: [prompt-builder, modal, regeneration, scene-prompts, 5w1h, seedance]
dependency_graph:
  requires: [shared-video-models]
  provides: [prompt-builder-modal, scene-prompt-editing, regenerate-scene-prompts]
  affects: [ads-new-page, ads-job-page, api-ts, models-py, ads-routes]
tech_stack:
  added: []
  patterns: [dialog-modal, tabs-conditional, 5w1h-prompt-framework, 3-act-narrative]
key_files:
  created:
    - memelab/src/components/ads/prompt-builder-modal.tsx
  modified:
    - memelab/src/app/(app)/ads/new/page.tsx
    - memelab/src/app/(app)/ads/[jobId]/page.tsx
    - memelab/src/lib/api.ts
    - src/product_studio/models.py
    - src/api/routes/ads.py
decisions:
  - "Used Dialog+Tabs instead of inline accordion to keep prompt builder reusable across pages"
  - "No DialogFooter in existing shadcn -- used plain div for footer actions"
  - "Cast jobData as unknown before Record<string,unknown> to satisfy strict TS (AdJob has no index signature)"
metrics:
  duration_seconds: 310
  completed: 2026-04-12T21:55:00-03:00
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 1004 Plan 02: AI Prompt Builder Modal and Scene Prompt Regeneration Summary

Reusable PromptBuilderModal with model-conditional tabs (Kling 5W1H vs Seedance 3-act narrative), wired to both creation and detail pages, with backend RegenerateV2Request extended to accept scene_prompts for iterative prompt refinement.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create PromptBuilderModal component | 06c700d | New modal with Kling 5W1H (6 fields + negative, 1500 char) and Seedance narrative (pattern/style selects + 3 acts, 2480 char) tabs, live preview with character counter |
| 2 | Wire prompt builder and extend regeneration | 7beb39b | Integrated modal in ads/new and [jobId] pages, added scene_prompts to RegenerateV2Request + merge logic, editable prompts on detail page |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No DialogFooter export in shadcn Dialog component**
- **Found during:** Task 1
- **Issue:** Plan specified using DialogFooter but the existing dialog.tsx only exports Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription (no Footer)
- **Fix:** Used a plain `<div className="flex justify-end gap-2 pt-2">` for footer actions instead
- **Files modified:** memelab/src/components/ads/prompt-builder-modal.tsx
- **Commit:** 06c700d

**2. [Rule 1 - Bug] TypeScript strict cast errors for jobData**
- **Found during:** Task 2
- **Issue:** `jobData as Record<string, unknown>` fails TS strict checks because AdJob interface has no index signature
- **Fix:** Used double cast `jobData as unknown as Record<string, unknown>` for config access
- **Files modified:** memelab/src/app/(app)/ads/[jobId]/page.tsx
- **Commit:** 7beb39b

## Verification Results

- TypeScript compilation: PASS (0 new errors; 10 pre-existing in editor/test files)
- scene_prompts in RegenerateV2Request: PASS
- scene_prompts merge in ads.py regenerate handler: PASS
- PromptBuilderModal imported in both pages: PASS
- Python syntax check: PASS (both models.py and ads.py)

## Self-Check: PASSED
