---
phase: 22-per-cena-tts-anchoring
plan: 02
subsystem: tts
tags: [gemini-tts, error-classification, biblical-clamp, pytest]

# Dependency graph
requires:
  - phase: 22-01
    provides: "11 xfail test stubs in test_reels_tts.py + FakeGeminiClient fixture"
provides:
  - "classify_tts_error() helper in tts.py -- returns 'retry' or 'fail' for Gemini exceptions"
  - "Biblical tone speed clamp at lowest layer in generate_narration (D-11/D-12)"
  - "3 active GREEN tests for TTS-05 (biblical clamp) and TTS-06 (error classifier)"
affects: [22-03, 22-04, 22-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["lowest-layer clamp: policy enforcement at function entry before default computation", "classify_tts_error: typed exception dispatch for retry vs fail decisions"]

key-files:
  created: []
  modified:
    - src/reels_pipeline/tts.py
    - tests/test_reels_tts.py

key-decisions:
  - "Biblical clamp placed between os.makedirs and voice_name assignment -- before speaking_rate default computation, ensuring speed=1.0 flows through all downstream logic"
  - "classify_tts_error uses lazy import of google.genai.errors to avoid module-level dependency -- returns 'retry' on ImportError for resilience"
  - "test_error_classification uses __new__ to forge ClientError/ServerError instances without hitting real constructor validation"

patterns-established:
  - "Lowest-layer clamp: tone-specific overrides happen inside generate_narration before defaults, not at call sites"
  - "Error classifier pattern: classify exception -> 'retry'|'fail' string for caller loop decisions"

requirements-completed: [TTS-05, TTS-06]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 22 Plan 02: Biblical Speed Clamp + TTS Error Classifier Summary

**Biblical tone forces speaking_rate=1.0 at lowest TTS layer (D-11/D-12); classify_tts_error dispatches 400/403 as 'fail', 429/5xx/unknown as 'retry' for Plan 03's per-cena retry loop**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T23:14:37Z
- **Completed:** 2026-04-08T23:18:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Biblical tone clamp at lowest layer eliminates the speed=1.35 vs "Speak slowly" contradiction (TTS-05)
- INFO log emitted when clamp fires for production traceability (D-12)
- classify_tts_error helper ready for Plan 03's per-cena retry loop (TTS-06 partial)
- 3 of 11 test stubs flipped from xfail to active GREEN; 8 remain for future waves

## Task Commits

Each task was committed atomically:

1. **Task 1: Add biblical clamp + classify_tts_error to tts.py** - `8361a60` (feat)
2. **Task 2: Flip 3 tests from xfail to active GREEN** - `e14c016` (test)

## Files Created/Modified
- `src/reels_pipeline/tts.py` - Added classify_tts_error() helper near top; inserted biblical speed clamp inside generate_narration between os.makedirs and voice_name assignment
- `tests/test_reels_tts.py` - Replaced 3 xfail stubs with real test bodies (test_biblical_clamps_speed_to_1, test_biblical_clamp_logged, test_error_classification)

## Decisions Made
- Biblical clamp checks `tone == "biblical" and (speed is None or speed != 1.0)` -- the no-op case (speed already 1.0) skips both log and assignment to avoid noise
- classify_tts_error uses `getattr(exc, "code", None)` for defensive attribute access rather than assuming .code exists
- test_error_classification forges error instances via `__new__` bypassing the real constructor (which requires response objects) -- minimal shape compatible with .code attribute access

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Known Stubs

None -- all code paths in this plan are fully wired.

## Next Phase Readiness
- classify_tts_error is importable: `from src.reels_pipeline.tts import classify_tts_error` -- Plan 03 uses this in the per-cena retry loop
- Biblical clamp is active for all callers of generate_narration -- no call-site changes needed
- 8 xfail tests remain for Waves 2-3 (Plans 03-05)

## Self-Check: PASSED

All files found, all commits verified.

---
*Phase: 22-per-cena-tts-anchoring*
*Completed: 2026-04-08*
