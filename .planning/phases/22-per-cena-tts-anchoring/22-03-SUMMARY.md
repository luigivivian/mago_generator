---
phase: 22-per-cena-tts-anchoring
plan: 03
subsystem: api
tags: [tts, gemini, ffmpeg, asyncio, per-cena, pipeline]

requires:
  - phase: 22-01
    provides: xfail test stubs and fake Gemini TTS fixtures
  - phase: 22-02
    provides: classify_tts_error, biblical clamp in generate_narration

provides:
  - "_concat_cena_wavs: bit-exact ffmpeg concat demuxer for per-cena WAV files"
  - "run_step_tts refactored to per-cena bounded-parallel loop with Semaphore(3)"
  - "New signature: (script, job_dir, *, cena_indices=None, on_cena_update=None) -> (audio_path, total_duration, cost_usd, cenas_meta)"
  - "6 active tests covering TTS-01 through TTS-04 + TTS-06"

affects: [22-04, 22-05, 23-audio-anchored-timing]

tech-stack:
  added: [subprocess (ffmpeg concat demuxer)]
  patterns: [bounded-parallel fan-out with asyncio.Semaphore, per-cena retry with classify_tts_error, bit-exact WAV concat]

key-files:
  created: []
  modified:
    - src/reels_pipeline/tts.py
    - src/reels_pipeline/main.py
    - tests/test_reels_tts.py
    - tests/conftest.py

key-decisions:
  - "Monkeypatch must also target tts module local binding (src.reels_pipeline.tts._get_client) because from-import creates local name that survives source-module patching"
  - "Route handler at reels.py:221 intentionally left on OLD signature -- Plan 04 owns that update"

patterns-established:
  - "Per-cena fan-out: asyncio.gather with Semaphore(3), per-cena retry using classify_tts_error, partial failure isolation"
  - "Bit-exact concat: ffmpeg -f concat -safe 0 -c copy with list file cleanup in finally block"
  - "_make_fake_pipeline helper: instantiate ReelsPipeline(config_override={}) for unit tests"

requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04, TTS-06]

duration: 9min
completed: 2026-04-08
---

# Phase 22 Plan 03: Per-Cena TTS Core Refactor Summary

**run_step_tts rewritten as bounded-parallel per-cena loop with Semaphore(3), ffmpeg bit-exact concat, partial failure isolation, and 6 tests flipped GREEN**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-08T23:21:56Z
- **Completed:** 2026-04-08T23:31:52Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added `_concat_cena_wavs` ffmpeg helper to tts.py -- bit-exact PCM WAV concat via `-f concat -c copy`
- Refactored `run_step_tts` from single-call to per-cena bounded-parallel loop mirroring `run_step_video_kie`
- New signature returns `(audio_path, total_duration, cost_usd, cenas_meta)` with per-cena state
- Batch-mode caller at main.py updated to new signature in same edit (no dangling call site)
- 6 tests flipped from xfail to PASS: suite now shows 9 passed, 2 xfailed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add _concat_cena_wavs ffmpeg helper** - `607097f` (feat)
2. **Task 2: Refactor run_step_tts to per-cena loop** - `125144a` (feat)
3. **Task 3: Flip 6 tests from xfail to active GREEN** - `79ba93b` (test)

## Files Created/Modified
- `src/reels_pipeline/tts.py` - Added `_concat_cena_wavs` function and `import subprocess`
- `src/reels_pipeline/main.py` - Replaced `run_step_tts` body (19 lines -> 203 lines) + updated batch caller
- `tests/test_reels_tts.py` - 6 tests flipped from xfail stubs to active implementations + `_make_fake_pipeline` helper
- `tests/conftest.py` - Fixed monkeypatch to also patch `src.reels_pipeline.tts._get_client` local binding

## New `run_step_tts` Signature

```python
async def run_step_tts(
    self,
    script: dict,
    job_dir: str,
    *,
    cena_indices: list[int] | None = None,
    on_cena_update=None,
) -> tuple[str, float, float, list[dict]]:
```

Returns: `(audio_path, total_duration_s, cost_usd, cenas_meta)`

## Tests Flipped (6)

| Test | Requirement | Status |
|------|------------|--------|
| test_generates_one_file_per_cena | TTS-01 | PASS |
| test_ffprobe_duration_measured_per_cena | TTS-02 | PASS |
| test_step_state_cenas_persisted | TTS-03 | PASS |
| test_concat_not_single_call | TTS-04 | PASS |
| test_sum_matches_concat_within_tolerance | TTS-04 | PASS |
| test_single_cena_failure_isolated | TTS-06 | PASS |

Remaining xfail: `test_selective_retry_preserves_others` (22-04), `test_editor_compat_tts_path_and_duration_still_written` (22-05)

## Decisions Made
- Fixed monkeypatch in conftest.py to also patch `src.reels_pipeline.tts._get_client` -- Python's `from X import Y` creates a local name that survives monkeypatch on the source module, causing all run_step_tts tests to see 0 fake client calls
- Route handler at `src/api/routes/reels.py:221` intentionally left calling old signature -- Plan 04 owns that update. Interactive TTS step is BROKEN until Plan 04 lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed monkeypatch target for from-import binding**
- **Found during:** Task 3 (flipping tests)
- **Issue:** `fake_gemini_tts_client` fixture only patched `src.llm_client._get_client` but tts.py imports `_get_client` via `from src.llm_client import _get_client`, creating a local binding that was unaffected by the monkeypatch. All 6 new tests saw 0 calls on the fake client.
- **Fix:** Added `monkeypatch.setattr("src.reels_pipeline.tts._get_client", lambda: fake)` in conftest.py alongside the existing source-module patch
- **Files modified:** tests/conftest.py
- **Verification:** All 6 flipped tests pass; 22-02 tests still pass (9 passed, 2 xfailed)
- **Committed in:** 79ba93b (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for test infrastructure. Known issue documented in 22-01 decisions. No scope creep.

## Issues Encountered
None beyond the monkeypatch binding fix documented above.

## Known Stubs
None -- all code paths are wired to real implementations.

## Route Handler Breakage Note

The route handler at `src/api/routes/reels.py:221` still calls:
```python
audio_path, duration = await pipeline.run_step_tts(...)
```
This will crash on the new 4-tuple return. **Plan 04 (Wave 3) fixes this.** The batch-mode caller (main.py) is already updated and functional.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 can now update the route handler to call the new signature with `cena_indices` and `on_cena_update`
- Plan 05 can verify editor compat (tts.path + tts.duration in step_state)
- cenas_meta shape is stable for Phase 23 (audio-anchored timing propagation)

## Self-Check: PASSED

All files verified present. All 3 task commits verified in git log.

---
*Phase: 22-per-cena-tts-anchoring*
*Completed: 2026-04-08*
