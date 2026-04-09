---
phase: 23-audio-anchored-timing-propagation
plan: 03
subsystem: api
tags: [scene_timings, run_step_srt, mock-patching, lazy-import, tdd, audio-anchored]

# Dependency graph
requires:
  - phase: 23-audio-anchored-timing-propagation
    provides: "Wave 0 (23-01) xfail stubs + Wave 1 (23-02) build_scene_timings_from_cenas helper (pure, 103 lines, 4-point float rounding)"
  - phase: 22-per-cena-tts-anchoring
    provides: "step_state.tts.cenas list with ffprobe-measured per-cena durations (Phase 22 D-06, cenas_meta return from run_step_tts)"
provides:
  - "run_step_srt gains keyword-only `tts_cenas: list[dict] | None = None` kwarg"
  - "Gated new-vs-legacy branch: audio-anchored path when tts_cenas truthy, char-offset align_srt_with_script fallback otherwise"
  - "step_state.srt.duration now comes from scene_timings[-1].end (audio-anchored) when tts_cenas present, replacing file-size heuristic (audio_size/48000)"
  - "Route handler srt branch reads step_state.tts.cenas and threads it via the new kwarg"
  - "Batch-mode caller at main.py:~1266 captures cenas_meta and threads it too (standalone pipeline.run() also uses the new path)"
  - "tests/test_reels_timing.py: 5 active tests (up from 3), 2 xfail stubs remaining for Wave 3"
affects: [23-04, audio-anchored-timing-propagation, reels-pipeline, editor-store, scene_timings, video-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Function-scope lazy imports as mock targets: patch the SOURCE module when the consumer does `from X import Y` inside a function body (not the consumer). Opposite of Phase 22 D-11 (module-top-level imports → patch consumer)."
    - "Keyword-only kwarg with default None as backwards-compatible feature gate: old callers work unchanged, new callers opt in by passing the kwarg."
    - "Data kwarg vs config_override: data from a previous step's output goes through an explicit kwarg (not config_override, which is reserved for step-execution metadata per Phase 22 D-06)."

key-files:
  created: []
  modified:
    - "src/reels_pipeline/main.py — run_step_srt signature + body + batch caller (70 insertions, 15 deletions across 4 edits)"
    - "src/api/routes/reels.py — srt branch in _execute_step_task (7 insertions, 0 deletions)"
    - "tests/test_reels_timing.py — tests 04/05 flipped from xfail stubs to active (134 insertions, 15 deletions)"
    - ".planning/phases/23-audio-anchored-timing-propagation/deferred-items.md — updated pre-existing failure counts"

key-decisions:
  - "Keyword-only kwarg chosen over config_override for tts_cenas threading (data, not step-execution metadata; matches Phase 22 D-06 rationale)"
  - "Lazy import of build_scene_timings_from_cenas inside run_step_srt body, matching the existing align_srt_with_script lazy import pattern at main.py:~588"
  - "Duration swap landed in same commit as the branch to avoid leaving the editor's isSane fallback chain on the file-size heuristic for one commit"
  - "Mock targets are src.reels_pipeline.transcriber.* (source module), NOT src.reels_pipeline.main.*, because run_step_srt uses function-scope lazy imports — patching main.* would raise AttributeError"

patterns-established:
  - "Function-scope lazy import mock target rule: when the consumer imports inside the function body, patch the source module. When it imports at module top-level, patch the consumer module (Phase 22 D-11)."
  - "Gated branch pattern for rollout: `if tts_cenas: new_path() else: legacy_path()` — no feature flag, no config knob, the presence of the data IS the switch"

requirements-completed: [TIMING-03]

# Metrics
duration: 28min
completed: 2026-04-08
---

# Phase 23 Plan 03: run_step_srt Gate and Route Wiring Summary

**Gated run_step_srt with tts_cenas kwarg so the srt step consumes Phase 22's ffprobe-measured per-cena durations as audio-anchored scene_timings, with legacy char-offset fallback preserved for pre-Phase-22 jobs.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-09T01:30:00Z (approx)
- **Completed:** 2026-04-09T01:58:00Z
- **Tasks:** 3 (all atomic, all committed)
- **Files modified:** 3 source + 1 deferred-items update

## Accomplishments

- `run_step_srt` signature extended with keyword-only `tts_cenas: list[dict] | None = None`; signature introspection confirms the parameter exists with default None
- Gated new-vs-legacy branch lands inside `run_step_srt` at main.py:~647: `if tts_cenas: build_scene_timings_from_cenas(tts_cenas)` else preserved legacy `align_srt_with_script` path
- `step_state.srt.duration` source swap from file-size heuristic (`audio_size/48000`) to `scene_timings[-1].end` when tts_cenas is present — fixes the editor's `isSane` fallback chain (editor-store.ts:199) to be audio-anchored
- Batch-mode caller at main.py:~1266 updated: `_cenas_meta` → `cenas_meta`, now passes `tts_cenas=cenas_meta` so standalone `pipeline.run(tema)` invocations also take the new path
- Route handler srt branch at reels.py:~295 reads `step_state.get("tts", {}).get("cenas") or None` and threads it via `tts_cenas=tts_cenas` kwarg
- Tests 04 and 05 flipped from xfail stubs to active GREEN with mock-based assertions
- `tests/test_reels_timing.py` now shows 5 passed, 2 xfailed (up from 3 passed, 4 xfailed)
- Combined Phase 22+23 suite (`tests/test_reels_tts.py tests/test_reels_timing.py`): 16 passed, 2 xfailed, 0 failed

## Task Commits

Each task committed atomically:

1. **Task 1: Add tts_cenas kwarg and gated branch to run_step_srt** — `52e235f` (feat)
2. **Task 2: Thread tts_cenas through route handler srt branch** — `9a86414` (feat)
3. **Task 3: Flip tests 04/05 from xfail to active GREEN** — `a0ce8a9` (test)

## Files Created/Modified

- `src/reels_pipeline/main.py` — run_step_srt signature gains kwarg; gated branch replaces the single-path legacy block; duration source swap; batch caller at ~line 1266 captures and threads cenas_meta
- `src/api/routes/reels.py` — srt branch in `_execute_step_task` reads `step_state.tts.cenas` and passes `tts_cenas=tts_cenas` kwarg; no other branches touched
- `tests/test_reels_timing.py` — 2 new active async tests (04, 05) using `patch("src.reels_pipeline.transcriber.transcribe_to_srt" | "align_srt_with_script" | "estimate_transcription_cost")`; added `from pathlib import Path` and `from unittest.mock import AsyncMock, patch`
- `.planning/phases/23-audio-anchored-timing-propagation/deferred-items.md` — updated pre-existing failure counts after wider suite regression check

## Decisions Made

- **Keyword-only kwarg over config_override:** `tts_cenas` is data from a previous step's output, not step-execution metadata. Matches Phase 22 D-06 rationale (cena_indices went through config_override only because it was step-execution control).
- **Lazy import inside function body:** Matches the existing `align_srt_with_script` lazy import pattern at main.py:~588 rather than adding a module-level import. Keeps import graph unchanged and cold-start costs identical.
- **Duration swap in same commit as branch:** Avoids leaving the editor's isSane fallback chain on the file-size heuristic for one intermediate commit.
- **Mock target = source module:** Because `run_step_srt` does `from src.reels_pipeline.transcriber import align_srt_with_script, ...` inside the function body (function-scope lazy import), every call re-executes the import and re-reads the attribute from the source module. Patching `src.reels_pipeline.main.align_srt_with_script` would raise AttributeError because main.py has no module-level attribute by that name. Contrast with Phase 22 D-11, where the import was module-top-level and the fix was to patch the consumer module. Different rule for different import scopes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's test code used wrong ReelsPipeline constructor kwarg**
- **Found during:** Task 3 (test execution)
- **Issue:** The plan's test code specified `ReelsPipeline(config={...})` in both test bodies, but the constructor signature is `def __init__(self, config_override: dict | None = None)`. First test run failed with `TypeError: ReelsPipeline.__init__() got an unexpected keyword argument 'config'`.
- **Fix:** Replaced both `config=` with `config_override=`. Behavior under test is unchanged — still passes a `{"script_language": "pt-BR", "transcription_provider": "gemini"}` dict.
- **Files modified:** `tests/test_reels_timing.py` (2 occurrences, both in new test bodies)
- **Verification:** `pytest tests/test_reels_timing.py::test_run_step_srt_uses_new_path_when_tts_cenas_present tests/test_reels_timing.py::test_run_step_srt_falls_back_to_legacy_without_tts_cenas -x -q` → 2 passed
- **Committed in:** `a0ce8a9` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic fix to plan's test code; zero impact on the behavior under test. No scope creep.

## Issues Encountered

None during planned work. Pre-existing unrelated failures in `tests/test_atomic_counter.py`, `tests/test_credit_service.py`, `tests/test_credits.py`, `tests/test_video_prompt_builder.py` confirmed via `git stash` baseline check and logged in `deferred-items.md` (already documented since Plan 23-01).

## Deferred Issues

None specific to this plan. 16 pre-existing failures in unrelated modules (atomic_counter, credit_service, credits, video_prompt_builder) and 1 collection error (`tests/test_agents_quick.py` — missing module) are tracked in the phase `deferred-items.md` and remain out of scope for Phase 23.

## Next Phase Readiness

**Wave 2 ready:** The srt branch is now producing audio-anchored scene_timings from Phase 22's ffprobe-measured durations. `step_data["scene_timings"]` written at reels.py:~306 is the exact same shape as before (byte-equal per Wave 1's regression test 01), but its source is now the TIMING-05 drift-proof helper when `tts.cenas` exists.

Wave 3 (Plan 23-04) can now:
1. Flip test 06 (`concat_clips_with_audio_consumes_new_scene_timings`) — integration test confirming the video_builder trim loop reads the new scene_timings shape from `step_state.srt.scene_timings`
2. Flip test 07 (`editor_audio_items_total_duration_matches_per_cena_sum`) — TIMING-04 regression lock that `step_data['duration']` stays within 50ms of `sum(cenas[i].duration)`, which the editor reads via `stepState.tts.duration` in editor-store.ts:197-201

No signature changes to `concat_clips_with_audio` are needed — Wave 3 is a validation wave, not a refactor wave. The contract is already locked by Wave 1's shape regression test plus Wave 2's gate assertion.

## Self-Check: PASSED

- **Files exist:**
  - `src/reels_pipeline/main.py`: FOUND
  - `src/api/routes/reels.py`: FOUND
  - `tests/test_reels_timing.py`: FOUND
  - `.planning/phases/23-audio-anchored-timing-propagation/23-03-SUMMARY.md`: FOUND (this file)
- **Commits exist:**
  - `52e235f` (Task 1 feat): FOUND
  - `9a86414` (Task 2 feat): FOUND
  - `a0ce8a9` (Task 3 test): FOUND
- **Test state verified:**
  - `pytest tests/test_reels_timing.py -q` → 5 passed, 2 xfailed (expected)
  - `pytest tests/test_reels_tts.py -q` → 11 passed, 0 failures (no Phase 22 regression)
  - `pytest tests/test_reels_tts.py tests/test_reels_timing.py -q` → 16 passed, 2 xfailed (expected)
- **Signature verified:** `inspect.signature(ReelsPipeline.run_step_srt).parameters` → `['self', 'audio_path', 'job_dir', 'script', 'tts_cenas']`
- **Import verified:** `from src.api.routes import reels` → OK

---
*Phase: 23-audio-anchored-timing-propagation*
*Completed: 2026-04-08*
