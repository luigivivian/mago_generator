---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
fixed_at: 2026-04-13T01:28:00-03:00
review_path: .planning/phases/1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f/1004-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 1004: Code Review Fix Report

**Fixed at:** 2026-04-13T01:28:00-03:00
**Source review:** .planning/phases/1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f/1004-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: File-serve endpoint has no authentication

**Files modified:** `src/api/routes/ads.py`
**Commit:** 918c72e
**Applied fix:** Added `current_user=Depends(get_current_user)` parameter and replaced raw DB query with `_get_user_job(job_id, current_user.id, db)` to enforce ownership check, matching every other endpoint in the router.

### CR-02: Upload-images endpoint does not enforce the 4-image maximum

**Files modified:** `src/api/routes/ads.py`
**Commit:** ad95178
**Applied fix:** Added `if len(files) > 4: raise HTTPException(400, "Maximum 4 images per upload")` guard immediately after the existing `< 1` check, matching the `max_length=4` constraint in the Pydantic model.

### WR-01: promptOverride state in StepVideo is collected but never sent

**Files modified:** `memelab/src/components/ads/step-video.tsx`
**Commit:** 3c7fbb5
**Applied fix:** Added `prompt_override?: string` to the Props `onRegenerate` type, the `handleRegenerate` function signature, and both `onClick` call sites that invoke it. The backend already accepts arbitrary step params, so this completes the frontend wiring.

### WR-02: handleRegenSingle uses array index as identity

**Files modified:** `memelab/src/app/(app)/ads/new/page.tsx`
**Commit:** dd10119
**Applied fix:** Changed `prev.map((c, i) => i === compIdx ? ...)` to `prev.map((c) => c === item ? ...)` using the object reference captured at call time. Added early return if `item` is undefined (guards against out-of-bounds index).

### WR-03: Upload in new/page.tsx hardcodes localhost URL

**Files modified:** `memelab/src/app/(app)/ads/new/page.tsx`
**Commit:** 7135694
**Applied fix:** Changed `fetch("http://127.0.0.1:8000/ads/upload-images", ...)` to `fetch("/api/ads/upload-images", ...)` to use the Next.js rewrite proxy, consistent with every other API call in the codebase.

### WR-04: Seedance "Usar este prompt" button is never disabled when content is empty

**Files modified:** `memelab/src/components/ads/prompt-builder-modal.tsx`
**Commit:** e647d32
**Applied fix:** Added `|| (isSeedance && !(act1 || act2 || act3))` to the button's `disabled` condition, preventing submission when all three act fields are empty (the static "Style: product." line alone is not meaningful content).

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-04-13T01:28:00-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
