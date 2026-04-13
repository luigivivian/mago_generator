---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
fixed_at: 2026-04-12T22:38:00-03:00
review_path: .planning/phases/1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f/1004-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 1004: Code Review Fix Report

**Fixed at:** 2026-04-12T22:38:00-03:00
**Source review:** .planning/phases/1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f/1004-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: File-serve endpoint has no authentication

**Files modified:** `src/api/routes/ads.py`
**Commit:** 918c72e
**Applied fix:** Added `current_user` dependency and ownership check via `_get_user_job` to the file-serve endpoint.

### CR-02: Upload-images endpoint does not enforce the 4-image maximum

**Files modified:** `src/api/routes/ads.py`
**Commit:** ad95178
**Applied fix:** Added upper-bound validation `len(files) > 4` raising HTTP 400.

### WR-01: `promptOverride` state in StepVideo is collected but never sent

**Files modified:** `memelab/src/components/ads/step-video.tsx`
**Commit:** 3c7fbb5
**Applied fix:** Added `prompt_override` to the `onRegenerate` overrides interface and passed `promptOverride` through the regenerate call.

### WR-02: `handleRegenSingle` uses array index as identity

**Files modified:** `memelab/src/app/(app)/ads/new/page.tsx`
**Commit:** dd10119
**Applied fix:** Switched from index-based identity to object reference identity in `handleRegenSingle`.

### WR-03: Upload in `new/page.tsx` hardcodes localhost URL

**Files modified:** `memelab/src/app/(app)/ads/new/page.tsx`
**Commit:** 7135694
**Applied fix:** Replaced hardcoded `http://127.0.0.1:8000` with the `/api` proxy path.

### WR-04: Seedance "Usar este prompt" button is never disabled when empty

**Files modified:** `memelab/src/components/ads/prompt-builder-modal.tsx`
**Commit:** e647d32
**Applied fix:** Added `seedanceReady` guard requiring at least one act to be filled before enabling the button.

### IN-01: `AdJob` interface missing v2 fields

**Files modified:** `memelab/src/lib/api.ts`
**Commit:** d4b5dff
**Applied fix:** Extended `AdJob` interface with `config`, `image_urls`, `category`, `error_message` as optional fields. Changed `outputs` type from `Record<string, string>` to `Record<string, unknown>` to match actual backend shape.

### IN-02: `scene_index` will throw ValueError on non-integer input

**Files modified:** `src/api/routes/ads.py`
**Commit:** 388788e
**Applied fix:** Wrapped `int()` calls for `scene_index` (line 572) and `count` (lines 644, 701) in `try/except (ValueError, TypeError)` blocks, raising HTTP 400 with descriptive messages.

### IN-03: SeedanceConfig duration selector hardcoded

**Files modified:** `memelab/src/components/ads/seedance-config.tsx`, `memelab/src/app/(app)/ads/new/page.tsx`
**Commit:** 2d34092
**Applied fix:** Added optional `modelValue` prop to `SeedanceConfigProps`, imported `getDurations()` from `video-models.ts`, and replaced hardcoded `[4, 8]` options with dynamic `durations.map()`. Passed `videoModel` at the call site in `new/page.tsx`.

## Skipped Issues

None.

---

_Fixed: 2026-04-12T22:38:00-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
