---
phase: 22-per-cena-tts-anchoring
plan: 04
subsystem: api
tags: [tts, fastapi, asyncio, per-cena, route-handler, selective-retry, background-task]

requires:
  - phase: 22-03
    provides: New run_step_tts(script, job_dir, *, cena_indices, on_cena_update) -> (audio_path, total_duration, cost_usd, cenas_meta) signature

provides:
  - "execute_step endpoint accepts optional body with cena_indices for selective retry (D-06)"
  - "_execute_step_task tts branch wired to new per-cena run_step_tts signature"
  - "Per-cena progress callback via independent session + asyncio.Lock (mirror of clips _scene_update pattern)"
  - "step_state.tts shape: path, duration (editor compat) + cenas, total_duration_source, cost_usd, status (D-05/D-07 additive)"
  - "test_selective_retry_preserves_others flipped from xfail to active GREEN"

affects: [22-05, 23-audio-anchored-timing]

tech-stack:
  added: []
  patterns:
    - "FastAPI optional body param ordered before Depends params"
    - "config_override as transport for endpoint-to-background-task params (cena_indices)"
    - "Per-cena progress write pattern (independent session + asyncio.Lock + flag_modified)"

key-files:
  created: []
  modified:
    - src/api/routes/reels.py
    - tests/test_reels_tts.py

key-decisions:
  - "Used config_override dict to thread cena_indices from execute_step endpoint to _execute_step_task background task — no signature change to _execute_step_task needed"
  - "Empty list cena_indices=[] is normalized to None inside the tts branch (treated as 'regen all') — matches D-06 spec"
  - "validate cena_indices at the route layer (HTTPException 400) but defer upper-bound check to the pipeline (no script context yet at the route layer)"
  - "Per-cena progress writer mirrors clips _scene_update line-for-line (independent session_factory, asyncio.Lock, flag_modified) — Pitfall #7 forbids reusing parent session"

patterns-established:
  - "Selective retry plumbing: HTTP body -> validation -> config_override -> background task -> pipeline kwarg (no new endpoint, no schema change)"
  - "Editor compat additive shape: top-level tts.path/tts.duration kept; new fields (cenas, cost_usd, total_duration_source) added alongside"

requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04, TTS-06]

duration: 4min
completed: 2026-04-09
---

# Phase 22 Plan 04: Route Handler Wired To Per-Cena TTS Summary

**Route handler `_execute_step_task` tts branch rewritten to call new `run_step_tts(script, job_dir, cena_indices, on_cena_update)` signature with per-cena progress writes via independent session, plus optional `cena_indices` body param on execute_step for D-06 selective retry — 10 of 11 tests in test_reels_tts.py now GREEN.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T00:04:40Z
- **Completed:** 2026-04-09T00:08:38Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- End-to-end API path for per-cena TTS now lands: user clicks "Regenerate TTS" → execute_step endpoint → background task → run_step_tts → per-cena progress streamed back via independent commits
- Selective retry (D-06) is fully wired: POST `/reels/{jobId}/step/tts` with `{"cena_indices": [2]}` regenerates only cena 2 and concatenates the new audio.wav while preserving other per-cena WAV files
- D-05 status convention implemented: `complete` / `complete_with_failures` / `failed` based on per-cena failure count
- D-07 editor compat preserved: `step_state.tts.path` and `step_state.tts.duration` still written at top level (the editor reads these at editor-store.ts:167/198)
- 10 of 11 tests in test_reels_tts.py are now active GREEN; only `test_editor_compat_tts_path_and_duration_still_written` remains xfail for Plan 05

## Task Commits

1. **Task 1: Rewrite tts branch of _execute_step_task in routes/reels.py** — `fab5bef` (feat)
2. **Task 2: Add cena_indices body param to execute_step endpoint** — `2410de5` (feat)
3. **Task 3: Flip test_selective_retry_preserves_others to active GREEN** — `56691c6` (test)

## Files Created/Modified

- `src/api/routes/reels.py` — tts branch of `_execute_step_task` rewritten (lines 218-228 → 218-294); execute_step endpoint signature gains `body: dict | None = Body(default=None)`; cena_indices threaded into config_override before background task spawn (`+91 lines` total)
- `tests/test_reels_tts.py` — `test_selective_retry_preserves_others` xfail decorator + stub removed; replaced with active body asserting exactly 1 new Gemini call after `cena_indices=[2]` and that cenas 0/1/3/4 mtimes are preserved (`+45 / -3 lines`)

## Diff Summary

### reels.py tts branch — before (lines 218-228)

```python
elif step_name == "tts":
    script_json = step_state.get("script", {}).get("json", {})
    narration = script_json.get("narracao_completa", "")
    audio_path, duration = await pipeline.run_step_tts(
        narration_text=narration,
        job_dir=job_dir,
    )
    step_data["path"] = audio_path
    step_data["duration"] = duration
    step_data["status"] = "complete"
    job.audio_path = audio_path
```

### reels.py tts branch — after

- Reads `script_json` and validates it has cenas (else RuntimeError, caught by the existing exception handler at lines 379-392 which writes status="error")
- Reads `cena_indices` from `config_override` (D-06); empty list normalized to None
- Defines `_cena_lock = asyncio.Lock()` + `_cena_update` coroutine + `on_cena_update` sync wrapper — line-for-line mirror of clips `_scene_update` at reels.py:272-298
- Calls `await pipeline.run_step_tts(script=script_json, job_dir=job_dir, cena_indices=cena_indices, on_cena_update=on_cena_update)` — new 4-tuple return
- Persists: `step_data["path"]` (editor compat), `step_data["duration"]` (editor compat, now = total_duration), `step_data["cenas"]` (new), `step_data["total_duration_source"] = "ffprobe_concat"` (Phase 23 trust check), `step_data["cost_usd"]`
- Implements D-05 status convention: `complete` / `complete_with_failures` / `failed`

### execute_step endpoint signature — before

```python
@router.post("/{job_id}/step/{step_name}", summary="Execute a pipeline step")
async def execute_step(
    job_id: str,
    step_name: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(db_session),
):
```

### execute_step endpoint signature — after

```python
@router.post("/{job_id}/step/{step_name}", summary="Execute a pipeline step")
async def execute_step(
    job_id: str,
    step_name: str,
    background_tasks: BackgroundTasks,
    body: dict | None = Body(default=None),  # NEW
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(db_session),
):
```

Plus, just before the `background_tasks.add_task(...)` call:

```python
if step_name == "tts" and body and isinstance(body, dict):
    raw_indices = body.get("cena_indices")
    if raw_indices is not None:
        if not isinstance(raw_indices, list) or not all(
            isinstance(x, int) and x >= 0 for x in raw_indices
        ):
            raise HTTPException(
                status_code=400,
                detail="cena_indices must be a list of non-negative ints",
            )
        config_override["cena_indices"] = raw_indices
```

### Editor compat preserved

- `grep -c 'step_data\["path"\] = audio_path' src/api/routes/reels.py` → 1 (still present in tts branch)
- `grep -c 'step_data\["duration"\]' src/api/routes/reels.py` → 2 (tts branch + srt branch)
- `step_data["duration"]` is now the ffprobe-measured concat duration (was the same path before; the pipeline returns `total_duration` which is the ffprobe measurement of `audio.wav`)
- `editor-store.ts:167` reads `tts.path` → still works
- `editor-store.ts:198` reads `tts.duration` → still works

### Test results

```
$ pytest tests/test_reels_tts.py -q --tb=no
..........x                                                              [100%]
10 passed, 1 xfailed in 2.35s
```

The lone xfail is `test_editor_compat_tts_path_and_duration_still_written` — owned by Plan 05.

## Decisions Made

- **config_override as transport channel:** chose to thread `cena_indices` through the existing `config_override` dict rather than expanding `_execute_step_task`'s signature with a new optional kwarg. This keeps all step-specific params in one place and matches how other per-step settings (`script_language`, `bible_config`, etc.) are already passed.
- **Empty-list normalization:** `cena_indices == []` is treated as "regen all" inside the route handler, matching the run_step_tts contract that `cena_indices=None` or empty falls back to all cenas. Avoids surprising behavior where an empty list might silently regenerate nothing.
- **Defensive validation only at the route layer:** non-negative-int validation lives at the route layer (returns 400). Upper-bound validation (indices < n_cenas) is deferred to the pipeline because the route doesn't have script context at validation time. The pipeline already silently no-ops indices outside `range(len(cenas))` per the post-22-03 implementation.

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed verbatim from the action blocks. No Rule 1/2/3 auto-fixes were needed during execution.

## Issues Encountered

None during planned work. The full-suite regression check surfaced 21 pre-existing test failures across `tests/test_credit_service.py`, `tests/test_credits.py`, `tests/test_video_prompt_builder.py`, `tests/test_atomic_counter.py`, and a collection error in `tests/test_agents_quick.py`. All confirmed pre-existing via `git stash` baseline check (same failures appear with Phase 22-04 changes reverted). Logged to `.planning/phases/22-per-cena-tts-anchoring/deferred-items.md` per scope boundary rule. Out of scope for Phase 22.

## Self-Check: PASSED

- `src/api/routes/reels.py` exists and imports cleanly
- `tests/test_reels_tts.py` exists and 10 of 11 tests pass
- Commit `fab5bef` exists
- Commit `2410de5` exists
- Commit `56691c6` exists
- All Task 1 grep acceptance criteria pass
- All Task 2 grep acceptance criteria pass
- Task 3 selective retry test passes in isolation and in full file run

## Next Phase Readiness

- End-to-end per-cena TTS path is wired: HTTP request → background task → pipeline → per-cena progress updates → final concat
- `step_state.tts.cenas[i].duration` is the authoritative ground truth — Phase 23 (audio-anchored timing propagation) can now consume it directly for clip trimming and SRT timing
- Editor compat (`tts.path`, `tts.duration`) is preserved — no editor work needed
- Plan 05 owns the last xfail (`test_editor_compat_tts_path_and_duration_still_written`) — that test will assert the additive shape via an integration-style smoke check

## Handoff Note for Plan 05

The only remaining work in Phase 22 is the editor compat smoke test in `tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written` (currently xfail). After 22-04 the route handler writes `step_data["path"]` and `step_data["duration"]` exactly as before, so the test should pass once its body is implemented to verify both fields end up in `step_state["tts"]`. Plan 05's job is to implement that test body and remove the last xfail marker.

---
*Phase: 22-per-cena-tts-anchoring*
*Completed: 2026-04-09*
