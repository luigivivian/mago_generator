---
phase: 01-per-scene-config-write-back-to-backend
plan: 02
subsystem: api
tags: [fastapi, pydantic, tts, per-scene-config, editor-config]

requires:
  - "01-01: 5 backend xfail stubs defining per-scene config contract"
provides:
  - "PATCH /reels/{job_id}/scene-config endpoint persisting to step_state.editor_config"
  - "EditorConfigPayload + SceneCenaConfig Pydantic models"
  - "per_cena_configs threading from editor_config through config_override into run_step_tts"
  - "Per-cena voice/speed override in generate_narration calls"
affects: [01-03-PLAN, 01-04-PLAN]

tech-stack:
  added: []
  patterns: ["editor_config as wipe-safe bucket separate from editor in step_state", "per_cena_configs dict keyed by string index for per-scene overrides"]

key-files:
  created: []
  modified:
    - src/api/models.py
    - src/api/routes/reels.py
    - src/reels_pipeline/main.py
    - tests/test_per_scene_config.py

key-decisions:
  - "editor_config stored as separate step_state key from editor -- survives TTS/SRT/script regen wipe automatically (no code change to wipe line)"
  - "per_cena_configs keyed by string index (e.g. '0', '1') to match JSON dict keys from frontend"
  - "Falsy-or fallback pattern: per_cena.get('voice') or self.config.get('tts_voice') -- handles None and missing keys uniformly"

patterns-established:
  - "Phase 01 per-cena override pattern: editor_config.cenas[idx] -> config_override.per_cena_configs -> per_cena_configs.get(str(i)) in process_cena"

requirements-completed: []

duration: 4min
completed: 2026-04-09
---

# Phase 01 Plan 02: Backend Per-Scene Config Write-Back Summary

**PATCH /scene-config endpoint + per-cena voice/speed override threading through TTS pipeline, with 5 passing backend tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T20:05:41Z
- **Completed:** 2026-04-09T20:09:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added SceneCenaConfig and EditorConfigPayload Pydantic models for per-scene voice/speed/trim/freeze overrides
- Added PATCH /{job_id}/scene-config endpoint with dict-merge semantics (partial updates supported)
- Threaded per_cena_configs from editor_config through config_override into run_step_tts process_cena loop
- Flipped all 5 backend xfail stubs to passing real tests (endpoint, regen survival, voice override, speed override, e2e)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EditorConfigPayload model + PATCH /scene-config endpoint** - `4e14710` (feat)
2. **Task 2: Thread per_cena_configs into run_step_tts + flip backend tests green** - `7211dc1` (feat)

## Files Created/Modified
- `src/api/models.py` - Added SceneCenaConfig and EditorConfigPayload Pydantic models (13 lines)
- `src/api/routes/reels.py` - Added PATCH /scene-config endpoint + per_cena_configs injection in regenerate_step (27 lines)
- `src/reels_pipeline/main.py` - per_cena_configs reading + per-cena voice/speed override in process_cena (4 lines)
- `tests/test_per_scene_config.py` - 5 real passing tests replacing xfail stubs (120 lines)

## Decisions Made
- editor_config stored as separate step_state key from editor -- survives wipe automatically without modifying the existing pop("editor") line
- per_cena_configs keyed by string index to match JSON dict keys from frontend
- Falsy-or fallback pattern for voice/speed: per_cena.get("voice") or self.config.get("tts_voice") handles None and missing keys uniformly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all 5 backend tests are real passing tests, no stubs remain in this plan's scope.

## Next Phase Readiness
- Backend pipeline complete: frontend can write per-scene config via PATCH /scene-config
- Plans 03-04 can implement frontend write-back (handleUpdateVoice) and load-back (loadFromStepState merge)
- 2 frontend vitest todo stubs remain in memelab/src/__tests__/editor-config-writeback.test.ts for plans 03-04

## Self-Check: PASSED

- FOUND: src/api/models.py
- FOUND: src/api/routes/reels.py
- FOUND: src/reels_pipeline/main.py
- FOUND: tests/test_per_scene_config.py
- FOUND: 4e14710 (Task 1 commit)
- FOUND: 7211dc1 (Task 2 commit)

---
*Phase: 01-per-scene-config-write-back-to-backend*
*Completed: 2026-04-09*
