---
phase: 23-audio-anchored-timing-propagation
plan: 02
subsystem: reels-pipeline

tags: [timing, scene-timings, float-drift, pure-helper, wave-1, tdd]

# Dependency graph
requires:
  - phase: 22-per-cena-tts-anchoring
    provides: step_state.tts.cenas[i].duration (ffprobe-measured ground truth)
  - plan: 23-01
    provides: 7 xfail stub tests at tests/test_reels_timing.py (validation contract)
provides:
  - src/reels_pipeline/timing.py exporting `build_scene_timings_from_cenas(tts_cenas) -> list[dict]`
  - Pure helper with 4-point cursor rounding (A/B/C/D) eliminating TIMING-05 float drift
  - Output shape byte-equal to align_srt_with_script for drop-in consumer compatibility
  - 3 active GREEN tests (shape contract, sum invariant, 50-cena float-drift stress)
affects: [23-03, 23-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function single-source-of-truth helper (no I/O, no logging, no side effects)"
    - "4-point cursor rounding: start emission + end emission + duration re-derivation + cursor=end reuse"
    - "Failed cena handling: zero-duration slot preserves index alignment without advancing cursor"
    - "Wave 1 xfail-to-GREEN flip pattern mirroring Phase 22"

key-files:
  created:
    - src/reels_pipeline/timing.py
  modified:
    - tests/test_reels_timing.py

key-decisions:
  - "Dedicated module src/reels_pipeline/timing.py (not collapsed into transcriber.py) so Waves 2/3 import path stays stable and the module reads as the single Phase 23 concept"
  - "Module exports exactly one function — no helpers, no constants, no classes — enforcing the rule 'Don't create helpers unnecessarily'"
  - "Cursor reuse via `cursor = end` (point D) instead of re-rounding cursor+dur — end is already rounded at point B, so this avoids double rounding and guarantees start[i+1] == end[i] byte-exact"
  - "Failed cena handling uses `if cena.get('failed'):` (matches Phase 22 contract at main.py:425-456) rather than `status == 'failed'`"
  - "Tests import from src.reels_pipeline.timing — requires Task 1 to land before Task 2 runs; plan ordering enforces this"

patterns-established:
  - "All per-cena timing transformations are pure data — no ffmpeg/ffprobe in the helper path; audio measurement stays in Phase 22's run_step_tts"
  - "Shape contract is the downstream guarantee: {index, start, end, duration, narracao} byte-equal to align_srt_with_script's output"

requirements-completed: [TIMING-02, TIMING-05]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 23 Plan 02: Per-Cena scene_timings Helper Summary

**Pure single-source-of-truth `build_scene_timings_from_cenas` helper with 4-point float-drift elimination; 3 tests flipped xfail→GREEN**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-09T01:40:12Z
- **Completed:** 2026-04-09T01:43:59Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `src/reels_pipeline/timing.py` (103 lines) exporting `build_scene_timings_from_cenas(tts_cenas: list[dict]) -> list[dict]` as the Phase 23 single source of truth
- Helper is strictly pure: only `from __future__ import annotations`, no logging, no subprocess, no filesystem, no globals
- Implements all 4 rounding points from RESEARCH.md §3:
  - (A) `start = round(cursor * 1000) / 1000` (emission boundary)
  - (B) `end = round((cursor + dur) * 1000) / 1000` (emission boundary)
  - (C) `"duration": round(end - start, 3)` (re-derived from rounded bounds — not raw `dur`)
  - (D) `cursor = end` (reuses already-rounded end — no double rounding)
- Failed cena contract: `cena.get("failed") is True` emits `{start: prev_end, end: prev_end, duration: 0.0, narracao: ...}` and the cursor is NOT advanced — preserves index alignment with `script.cenas` so `split_long_scenes_in_script` and the `concat_clips_with_audio` trim loop stay balanced
- Missing/None duration is treated as 0.0 (defensive against partially-populated cenas during mid-step retry)
- Flipped 3 tests from xfail to active GREEN: `test_build_scene_timings_shape_matches_legacy`, `test_build_scene_timings_sums_to_total`, `test_float_drift_across_many_cenas`
- Tests 04-07 remain as xfail stubs — Waves 2 and 3 own them

## Test Results

| # | Test | Wave | Requirement | Status |
|---|------|------|-------------|--------|
| 01 | `test_build_scene_timings_shape_matches_legacy` | 1 | TIMING-02 (shape) | GREEN |
| 02 | `test_build_scene_timings_sums_to_total` | 1 | TIMING-02 (sum) | GREEN |
| 03 | `test_float_drift_across_many_cenas` | 1 | TIMING-05 | GREEN |
| 04 | `test_run_step_srt_uses_new_path_when_tts_cenas_present` | 2 | TIMING-03 | xfail (23-03) |
| 05 | `test_run_step_srt_falls_back_to_legacy_without_tts_cenas` | 2 | TIMING-03 | xfail (23-03) |
| 06 | `test_concat_clips_with_audio_consumes_new_scene_timings` | 3 | TIMING-01 | xfail (23-04) |
| 07 | `test_editor_audio_items_total_duration_matches_per_cena_sum` | 3 | TIMING-04 | xfail (23-04) |

**Quick run:** `pytest tests/test_reels_timing.py -q` → **3 passed, 4 xfailed** in 0.06s
**Phase 22 regression:** `pytest tests/test_reels_tts.py tests/test_reels_timing.py -q` → **14 passed, 4 xfailed** (no Phase 22 regression)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/reels_pipeline/timing.py with build_scene_timings_from_cenas** — `912708a` (feat)
2. **Task 2: Flip tests 01-03 from xfail to active GREEN (shape, sum, float drift)** — `984e287` (test)

## Files Created/Modified

- `src/reels_pipeline/timing.py` — NEW, 103 lines — pure helper `build_scene_timings_from_cenas`, module docstring referencing RESEARCH.md §2 and §3, 4 rounding points explicitly labeled in-code
- `tests/test_reels_timing.py` — MODIFIED, 233 lines — added `from src.reels_pipeline.timing import build_scene_timings_from_cenas`, replaced 3 xfail stubs with full test bodies (~74 lines added)

## Decisions Made

- **Dedicated `timing.py` module** (not collapsed into `transcriber.py`) — Waves 2/3 will import `from src.reels_pipeline.timing import build_scene_timings_from_cenas`, and a dedicated module reads more cleanly as the Phase 23 concept
- **Module exports exactly ONE function** — no helpers, no constants, no classes — enforces "don't create helpers unnecessarily" and keeps the single-source-of-truth surface minimal
- **Cursor reuse via `cursor = end`** (point D) rather than `cursor = round((cursor + dur) * 1000) / 1000` — `end` is already rounded at point B, so reusing it guarantees `scene_timings[i+1].start == scene_timings[i].end` byte-exact, and avoids a second round-trip that could introduce drift
- **Failed cena handling uses `cena.get("failed")`** (matches Phase 22 contract at `main.py:425-456`) rather than `cena.get("status") == "failed"` — `failed` is the explicit Phase 22 key; `status` is orthogonal (pending / complete / failed)

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed with zero auto-fixes and zero architectural deviations. All acceptance criteria for both tasks passed on first run.

## Issues Encountered

**Pre-existing test breakage (out of scope — already documented in `deferred-items.md` from Plan 23-01):**
- `tests/test_agents_quick.py` — `ModuleNotFoundError: No module named 'src.pipeline.agents.hackernews'` (collection error; hackernews agent was removed in commit `5bb48c0 feat(12.1-01)` but the test file was not updated at that time)
- `tests/test_atomic_counter.py` (3), `tests/test_credit_service.py` (6), `tests/test_credits.py` (2), `tests/test_video_prompt_builder.py` (3) — 14 pre-existing assertion failures in unrelated subsystems

**Verification:** Running `pytest tests/test_reels_tts.py tests/test_reels_timing.py -q` (Phase 22 + Phase 23 scope) → 14 passed, 4 xfailed, **0 failed**. Phase 23 work does not touch any of the broken subsystems.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Wave 1 ready.** The helper is available for import as:

```python
from src.reels_pipeline.timing import build_scene_timings_from_cenas
```

- **23-03 (Wave 2)** will gate `run_step_srt` on `tts.cenas` presence — calling `build_scene_timings_from_cenas(tts_cenas)` on the new path and falling back to `align_srt_with_script` on the legacy path. Flips tests 04-05.
- **23-04 (Wave 3)** will integrate the helper output into `concat_clips_with_audio` call sites and install the TIMING-04 regression lock on `step_data['duration'] == sum(cenas[i].duration)`. Flips tests 06-07.

The Wave 1 contract is locked: any change to the output shape `{index, start, end, duration, narracao}` will break `split_long_scenes_in_script` (scene_splitter.py:48) and the test `test_build_scene_timings_shape_matches_legacy` will red immediately.

---
*Phase: 23-audio-anchored-timing-propagation*
*Completed: 2026-04-09*

## Self-Check: PASSED

- FOUND: src/reels_pipeline/timing.py
- FOUND: tests/test_reels_timing.py
- FOUND: .planning/phases/23-audio-anchored-timing-propagation/23-02-SUMMARY.md
- FOUND: commit 912708a (Task 1 — feat: add helper)
- FOUND: commit 984e287 (Task 2 — test: flip 01-03 to GREEN)
