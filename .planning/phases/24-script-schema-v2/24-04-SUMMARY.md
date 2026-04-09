---
phase: 24-script-schema-v2
plan: 04
subsystem: api, pipeline
tags: [migration, legacy-compat, bible-stories, scene-splitter, schema-v2]

requires:
  - phase: 24-02
    provides: "migrate_legacy_roteiro function and ROTEIRO_SCHEMA v2 fields"
  - phase: 24-03
    provides: "System prompt templates with v2 field instructions"
provides:
  - "Migration wired at all script write/load points in reels.py"
  - "parse_manual_script outputs v2 fields natively"
  - "scene_splitter preserves v2 fields via dict copy"
  - "Phase 24 validation suite 10/10 GREEN"
affects: [25-structured-image-generation, 26-mood-driven-ken-burns]

tech-stack:
  added: []
  patterns: ["write-time migration for schema evolution", "idempotent backfill at API boundary"]

key-files:
  created: []
  modified:
    - "src/api/routes/reels.py"
    - "src/reels_pipeline/bible_stories.py"
    - "src/reels_pipeline/scene_splitter.py"
    - "tests/test_reels_script_schema.py"

key-decisions:
  - "Migration applied at both write and load points in reels.py for belt-and-suspenders coverage"
  - "scene_splitter needs no code changes -- dict(orig_cena) already copies all v2 fields; only clarifying comments added"

patterns-established:
  - "Write-time migration: apply migrate_legacy_roteiro at API boundary (write + load) so downstream never sees missing fields"

requirements-completed: [SCRIPT-06]

duration: 3min
completed: 2026-04-09
---

# Phase 24 Plan 04: Legacy Migration Wiring + Bible Stories v2 Defaults Summary

**migrate_legacy_roteiro wired into reels.py at 3 injection points (load + 2 writes), parse_manual_script emits v2 fields natively, 10/10 tests GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T15:05:13Z
- **Completed:** 2026-04-09T15:08:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration injected at script load point (background task entry), script generation write point, and script edit write point in reels.py
- parse_manual_script now includes image_prompt, mood, transition_in, transition_out per cena
- Confirmed scene_splitter already inherits v2 fields via dict copy; added clarifying comments
- Flipped tests 06/07/08 from xfail to active GREEN -- Phase 24 validation suite complete at 10/10

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire migration into reels.py + update bible_stories and scene_splitter** - `8a210c7` (feat)
2. **Task 2: Flip final 3 xfail tests to active GREEN** - `246e6c6` (test)

## Files Created/Modified
- `src/api/routes/reels.py` - Added migrate_legacy_roteiro import and 3 call sites (load + 2 writes)
- `src/reels_pipeline/bible_stories.py` - Added v2 fields to parse_manual_script cena dicts
- `src/reels_pipeline/scene_splitter.py` - Added v2 inheritance comments at dict copy points
- `tests/test_reels_script_schema.py` - Flipped 3 xfail tests to active with full assertions

## Decisions Made
- Migration applied at both write and load points for belt-and-suspenders coverage -- write-time catches new scripts, load-time catches legacy DB records
- scene_splitter needed no code changes -- dict(orig_cena) already copies all keys including v2 fields; only comments added for clarity
- Removed unused pytest import after all xfail decorators removed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in test_atomic_counter.py (test_check_limit_at_limit) -- confirmed unrelated to Phase 24 changes, not caused by our modifications

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 24 complete: all 10 tests GREEN, schema + prompts + migration fully wired
- Phase 25 (Structured Image Generation) can now consume image_prompt field from scripts
- Phase 26 (Mood-Driven Ken Burns) can now consume mood field from scripts

---
*Phase: 24-script-schema-v2*
*Completed: 2026-04-09*
