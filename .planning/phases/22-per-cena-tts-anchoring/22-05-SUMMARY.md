---
phase: 22-per-cena-tts-anchoring
plan: 05
subsystem: testing
tags: [tts, pytest, regression-test, editor-compat, phase-closure]

requires:
  - phase: 22-03
    provides: New run_step_tts(script, job_dir, *, cena_indices, on_cena_update) -> (audio_path, total_duration, cost_usd, cenas_meta) signature
  - phase: 22-04
    provides: Route handler tts branch writes step_data with path, duration, cenas, total_duration_source='ffprobe_concat', cost_usd

provides:
  - "test_editor_compat_tts_path_and_duration_still_written flipped from xfail to active GREEN"
  - "Phase 22 validation suite at 11/11 GREEN — no xfails remain in tests/test_reels_tts.py"
  - "Programmatic regression contract for memelab/src/stores/editor-store.ts:167+198 (the two fields the editor reads)"

affects: [22-verify-work, 23-audio-anchored-timing-propagation]

tech-stack:
  added: []
  patterns:
    - "Programmatic editor-compat regression: assemble step_data exactly as the route handler does, then assert against the JS contract documented at editor-store.ts:167 and :192-198"
    - "Phase closure pattern: each requirement bound to at least one active test in the validation map; manual gates documented separately"

key-files:
  created: []
  modified:
    - tests/test_reels_tts.py
    - .planning/phases/22-per-cena-tts-anchoring/22-VALIDATION.md

key-decisions:
  - "Skipped a FastAPI test client in favor of direct run_step_tts + manual step_data assembly — keeps the test in the unit-test runtime budget (~1s) and isolates the pipeline contract from DB/HTTP plumbing"
  - "Manual editor smoke test (load regenerated reel, confirm waveform renders) remains in 22-VALIDATION.md as a /gsd:verify-work gate, not automated — documented as expected by the plan"

patterns-established:
  - "Editor compat smoke test pattern: snapshot the route handler's step_data assembly inline + assert against TS field reads"

requirements-completed: [TTS-04]

duration: 2min
completed: 2026-04-09
---

# Phase 22 Plan 05: Editor Compat Test + Phase Closure Summary

**Final xfail in `tests/test_reels_tts.py` flipped to active GREEN — Phase 22 validation suite is now 11/11 with the editor compat contract pinned at the pipeline boundary.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T00:11:48Z
- **Completed:** 2026-04-09T00:13:26Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `test_editor_compat_tts_path_and_duration_still_written` is the 11th and final active test in the Phase 22 validation suite — zero xfails remain
- The editor compat contract is now regression-locked at the pipeline boundary: `step_data["path"]` ends with `audio.wav`, `step_data["duration"]` is a float in `[0.5, 600]` (the editor's `isSane` bounds), `step_data["cenas"]` is a list matching script cena count, and `step_data["total_duration_source"] == "ffprobe_concat"`
- Phase 22 Per-Task Verification Map has every row marked green — the validation contract is closed
- Ready for `/gsd:verify-work` — the manual editor smoke test is the only remaining gate

## Task Commits

1. **Task 1: Flip test_editor_compat_tts_path_and_duration_still_written to active** — `43dafd7` (test)

## Files Created/Modified

- `tests/test_reels_tts.py` — removed `@pytest.mark.xfail` decorator and `pytest.fail("Stub --- ...")` body; replaced with the active test body that mirrors `src/api/routes/reels.py` tts branch step_data assembly and asserts the editor compat contract from `memelab/src/stores/editor-store.ts:167+198`. `+56 / -3 lines`
- `.planning/phases/22-per-cena-tts-anchoring/22-VALIDATION.md` — flipped all 11 Per-Task Verification Map status cells from `pending` to `green` (Phase 22 closure)

## Test Results

```
$ pytest tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written -x -v
tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written PASSED [100%]
============================== 1 passed in 1.05s ===============================

$ pytest tests/test_reels_tts.py -q --tb=no
...........                                                              [100%]
11 passed in 2.64s

$ grep -c '@pytest.mark.xfail' tests/test_reels_tts.py
0
$ grep -c 'pytest.fail("Stub' tests/test_reels_tts.py
0
```

## Validation Map — Final State

| # | Test | Plan | Wave | Status |
|---|------|------|------|--------|
| 01 | test_generates_one_file_per_cena | 22-03 | 2 | ✅ green |
| 02 | test_ffprobe_duration_measured_per_cena | 22-03 | 2 | ✅ green |
| 03 | test_step_state_cenas_persisted | 22-03 | 2 | ✅ green |
| 04 | test_concat_not_single_call | 22-03 | 2 | ✅ green |
| 05 | test_sum_matches_concat_within_tolerance | 22-03 | 2 | ✅ green |
| 06 | test_biblical_clamps_speed_to_1 | 22-02 | 1 | ✅ green |
| 07 | test_biblical_clamp_logged | 22-02 | 1 | ✅ green |
| 08 | test_single_cena_failure_isolated | 22-03 | 2 | ✅ green |
| 09 | test_error_classification | 22-02 | 1 | ✅ green |
| 10 | test_selective_retry_preserves_others | 22-04 | 3 | ✅ green |
| 11 | test_editor_compat_tts_path_and_duration_still_written | 22-05 | 4 | ✅ green |

Every row in `22-VALIDATION.md` Per-Task Verification Map now has both a real task ID binding and a green status. Requirement coverage:

- TTS-01 → #01
- TTS-02 → #02
- TTS-03 → #03
- TTS-04 → #04, #05
- TTS-05 → #06, #07
- TTS-06 → #08, #09
- Success #4 (selective retry) → #10
- Success #5 (editor compat, programmatic) → #11

## Decisions Made

- **No FastAPI test client:** the plan explicitly defers a live-DB integration test in favor of calling `pipeline.run_step_tts(...)` directly and constructing the `step_data` dict the route handler would write. This keeps the test under 1.1s, eliminates DB fixture work, and isolates the pipeline contract from HTTP/auth plumbing — the editor compat boundary is the pipeline output, not the route handler.
- **Manual editor smoke test stays manual:** `22-VALIDATION.md` Manual-Only Verifications row #2 (load a regenerated reel in `/reels/{jobId}/edit`, confirm waveform + scene durations) is a perceptual/visual check that cannot be unit-tested. It is the human gate at `/gsd:verify-work` time and is intentionally not in scope for this plan.

## Deviations from Plan

None — plan executed exactly as written. Task 1 landed verbatim from the action block (the new test body matches the plan's spec character-for-character). No Rule 1/2/3 auto-fixes were needed.

## Issues Encountered

None during planned work. The full-suite regression check (`pytest tests/ -q --tb=no --ignore=tests/test_bible_e2e.py --ignore=tests/test_agents_quick.py`) reports `16 failed, 228 passed` — every one of the 16 failures matches the pre-existing baseline already documented in `.planning/phases/22-per-cena-tts-anchoring/deferred-items.md` (test_atomic_counter, test_credit_service, test_credits, test_video_prompt_builder). The collection error in `tests/test_agents_quick.py` is also pre-existing per the same file. None are caused by this plan or any Phase 22 work; they are out of scope per the executor's scope-boundary rule.

## Manual Gate Pointer

Before signing off Phase 22 at `/gsd:verify-work`, the human gate needs:

1. Pick an existing v3.0 reel
2. Regenerate its TTS step via `POST /reels/{jobId}/step/tts` (with the new Phase 22 code)
3. Open `/reels/{jobId}/edit`
4. Confirm: waveform track renders the same length, per-scene durations match, no visual drift, timeline scrub end-to-end is smooth

This is the only Phase 22 verification that cannot be automated (Remotion preview is visual). It is documented in `22-VALIDATION.md` Manual-Only Verifications row #2 and matches the plan's `<output>` block.

## Self-Check: PASSED

- `tests/test_reels_tts.py` exists and 11 of 11 tests pass
- `pytest tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written -x` exits 0
- `grep -c '@pytest.mark.xfail' tests/test_reels_tts.py` returns 0
- `grep -c 'pytest.fail("Stub' tests/test_reels_tts.py` returns 0
- Commit `43dafd7` exists
- `.planning/phases/22-per-cena-tts-anchoring/22-VALIDATION.md` Per-Task Verification Map shows 11 of 11 rows in `✅ green` status

## Phase 22 Closure Note

Phase 22 (Per-Cena TTS Anchoring) is complete at the code + automation level:

- 6 of 6 TTS-* requirements have at least one passing automated test
- Both Success Criteria #4 (selective retry) and #5 (editor compat) have programmatic checks
- The architectural refactor — `tts.py` per-cena loop, `_concat_cena_wavs` ffmpeg helper, `run_step_tts` 4-tuple return, biblical clamp + classifier, route handler rewrite, `cena_indices` body param — ships across plans 22-01 through 22-04
- Plan 22-05 closes the validation contract by flipping the last test
- The remaining work is the manual editor smoke test gate at `/gsd:verify-work`

Phase 22 is ready for `/gsd:verify-work`.

## Next Phase Readiness

- Phase 23 (Audio-Anchored Timing Propagation) can now consume `step_state.tts.cenas[i].duration` as ground truth for clip trimming, SRT timing, and editor audio item reconciliation
- The editor compat contract is locked — Phase 23 can refactor downstream consumers without fearing the editor will silently break
- No blockers carried forward from Phase 22

---
*Phase: 22-per-cena-tts-anchoring*
*Completed: 2026-04-09*
