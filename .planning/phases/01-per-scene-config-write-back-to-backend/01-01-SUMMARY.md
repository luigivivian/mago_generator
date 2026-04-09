---
phase: 01-per-scene-config-write-back-to-backend
plan: 01
subsystem: testing
tags: [pytest, vitest, xfail, tdd, per-scene-config]

requires: []
provides:
  - "5 backend xfail stubs covering scene-config endpoint, regen survival, per-cena voice/speed override, and e2e flow"
  - "2 frontend todo stubs covering handleUpdateVoice write-back and loadFromStepState merge"
affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN]

tech-stack:
  added: []
  patterns: ["xfail stubs as TDD Wave 0 contracts — mirrors Phase 22 pattern"]

key-files:
  created:
    - tests/test_per_scene_config.py
    - memelab/src/__tests__/editor-config-writeback.test.ts
  modified: []

key-decisions:
  - "Mirrored Phase 22 xfail pattern exactly (pytest.mark.xfail strict=True) for backend stubs"
  - "Used vitest it.todo() for frontend stubs (matches existing Phase 11 convention)"

patterns-established:
  - "Phase 01 xfail naming: test_scene_config_*, test_editor_config_*, test_per_cena_* — plans 02-04 grep these names verbatim"

requirements-completed: []

duration: 2min
completed: 2026-04-09
---

# Phase 01 Plan 01: TDD Wave 0 Stubs Summary

**7 xfail/todo test stubs defining the per-scene config write-back contract for plans 02-04**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T19:59:04Z
- **Completed:** 2026-04-09T20:01:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created 5 backend xfail stubs in pytest covering the full write-back contract (endpoint, regen survival, per-cena voice, per-cena speed, e2e)
- Created 2 frontend todo stubs in vitest covering handleUpdateVoice write-back and loadFromStepState merge
- Both test files run cleanly under their respective test runners (5 xfailed, 2 todos)

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend xfail stubs -- 5 behaviors** - `bc2a657` (test)
2. **Task 2: Frontend xfail stubs -- 2 behaviors** - `764dd8f` (test)

## Files Created/Modified
- `tests/test_per_scene_config.py` - 5 xfail stubs for backend per-scene config behaviors (35 lines)
- `memelab/src/__tests__/editor-config-writeback.test.ts` - 2 todo stubs for frontend write-back behaviors (16 lines)

## Decisions Made
- Mirrored Phase 22 xfail pattern exactly (pytest.mark.xfail strict=True) for backend stubs -- consistency across codebase
- Used vitest it.todo() for frontend stubs per existing Phase 11 convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

All 7 tests in this plan are intentional xfail/todo stubs (TDD Wave 0). Plans 02-04 will flip them to passing tests:
- `tests/test_per_scene_config.py` lines 8-35: 5 xfail stubs (plan 02 implements)
- `memelab/src/__tests__/editor-config-writeback.test.ts` lines 9-14: 2 todo stubs (plans 03-04 implement)

## Next Phase Readiness
- Test stubs define the contract for plans 02 (backend endpoint + TTS routing), 03 (frontend write-back), and 04 (frontend load-back)
- Plans 02-04 can grep test names verbatim to find their targets

## Self-Check: PASSED

- FOUND: tests/test_per_scene_config.py
- FOUND: memelab/src/__tests__/editor-config-writeback.test.ts
- FOUND: bc2a657 (Task 1 commit)
- FOUND: 764dd8f (Task 2 commit)

---
*Phase: 01-per-scene-config-write-back-to-backend*
*Completed: 2026-04-09*
