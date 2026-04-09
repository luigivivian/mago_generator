---
phase: 26-mood-driven-ken-burns
plan: 01
subsystem: video
tags: [ffmpeg, zoompan, ken-burns, easing, tdd]

requires:
  - phase: 24-script-schema-v2
    provides: CenaSchema.mood field (7 enum values)
provides:
  - MOOD_PRESETS dict mapping 7 moods to zoom/pan parameters
  - MOOD_CAMERA_MAP dict mapping 7 moods to Kie.ai camera direction strings
  - get_kb_filter pure function generating ffmpeg zoompan filter strings
  - REELS_KENBURNS_EASING and REELS_KENBURNS_MIN_DURATION config constants
affects: [26-02-PLAN (call-site wiring), video_builder.py, main.py]

tech-stack:
  added: []
  patterns: [mood-to-preset mapping, ffmpeg zoompan expression generation, duration gating]

key-files:
  created: [src/reels_pipeline/ken_burns.py, tests/test_reels_ken_burns.py]
  modified: [src/reels_pipeline/config.py]

key-decisions:
  - "Smoothstep easing (3t^2 - 2t^3) as default, linear as alternative -- quadratic chosen for natural motion feel"
  - "Scale to 2x width before zoompan so pan/zoom has room without hitting boundaries"
  - "Fallback to calm preset for unknown moods rather than erroring"

patterns-established:
  - "Mood-to-preset pattern: dict lookup with safe fallback for unknown keys"
  - "Duration gating: return empty string to signal caller should skip effect"

requirements-completed: [MOTION-01, MOTION-02, MOTION-04, MOTION-05]

duration: 2min
completed: 2026-04-09
---

# Phase 26 Plan 01: Mood-Driven Ken Burns Core Engine Summary

**Pure-function Ken Burns engine with 7 mood presets, smoothstep/linear easing, duration gate at 6s, and 4/5 tests GREEN**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T17:24:44Z
- **Completed:** 2026-04-09T17:27:06Z
- **Tasks:** 1 (TDD: RED + GREEN in combined task)
- **Files modified:** 3

## Accomplishments
- ken_burns.py module with MOOD_PRESETS (7 moods), MOOD_CAMERA_MAP (7 Kie.ai prompts), and get_kb_filter pure function
- Config vars REELS_KENBURNS_EASING (default ease-in-out) and REELS_KENBURNS_MIN_DURATION (default 6.0) added to config.py
- 4 of 5 tests GREEN (test_03 xfail awaiting Plan 02 concat wiring)
- Duration gate: scenes <= 6.0s return empty string (no zoompan)
- Easing: linear ramp vs smoothstep (3t^2 - 2t^3) produce verifiably different zoom expressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: xfail test stubs** - `2b770d4` (test)
2. **Task 1 GREEN: ken_burns.py + config + flip 4 tests** - `718b8cd` (feat)

## Files Created/Modified
- `src/reels_pipeline/ken_burns.py` - MOOD_PRESETS dict, MOOD_CAMERA_MAP dict, get_kb_filter() pure function with easing + duration gate
- `src/reels_pipeline/config.py` - Added REELS_KENBURNS_EASING and REELS_KENBURNS_MIN_DURATION env var constants
- `tests/test_reels_ken_burns.py` - 5 tests (4 active GREEN, 1 xfail for Plan 02)

## Decisions Made
- Smoothstep easing (3t^2 - 2t^3) as default, linear as env-var alternative -- chosen for natural acceleration/deceleration feel
- Scale to 2x width before zoompan so zoom/pan has headroom without boundary artifacts
- Calm preset used as fallback for unknown mood values (safe default, no crash)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ken_burns.py module is importable and tested; Plan 02 can wire get_kb_filter into video_builder.py and main.py
- MOOD_CAMERA_MAP ready for _build_scene_motion_prompt replacement
- test_03 xfail stub ready to be flipped once concat wiring lands

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 26-mood-driven-ken-burns*
*Completed: 2026-04-09*
