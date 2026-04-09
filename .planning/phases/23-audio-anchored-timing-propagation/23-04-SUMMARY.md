---
phase: 23-audio-anchored-timing-propagation
plan: 04
subsystem: tests
tags: [scene_timings, concat_clips_with_audio, regression-lock, tdd, audio-anchored, integration-test, monkeypatch]

# Dependency graph
requires:
  - phase: 23-audio-anchored-timing-propagation
    provides: "Wave 1 (23-02) build_scene_timings_from_cenas helper + Wave 2 (23-03) run_step_srt gated branch + 5 active TIMING tests"
  - phase: 22-per-cena-tts-anchoring
    provides: "run_step_tts returns (audio_path, total_duration, cost_usd, cenas_meta) with ffprobe-measured per-cena durations; fake_gemini_tts_client fixture"
provides:
  - "TIMING-01 integration test active: concat_clips_with_audio's trim loop at video_builder.py:850-855 consumes the new scene_timings shape"
  - "TIMING-04 regression lock active: step_data['duration'] stays within 50ms of sum(cenas[i].duration), protecting the editor's stepState.tts.duration contract"
  - "tests/test_reels_timing.py: 7 active tests, 0 xfailed, 0 failed (Phase 23 validation suite GREEN)"
  - "Phase 22+23 combined suite: 18 passed, 0 xfailed, 0 failed"
  - "Zero production code changes — validation-only wave"
affects: [23-verify-work, audio-anchored-timing-propagation, validation-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Monkeypatch the target function (_trim_clips_to_durations) at the MODULE level to capture call arguments without touching the function under test — integration test without end-to-end ffmpeg cost"
    - "Defensive stub of subprocess.run during concat tests: the trim loop runs early and is the only thing under test, so wrap the concat_clips_with_audio call in try/except to ignore post-trim assembly failures"
    - "Phase 22 D-11 double-patch still required even though the fake_gemini_tts_client fixture already patches both bindings — explicit second patch in-test documents the invariant for reviewers"
    - "config_override kwarg vs config kwarg: ReelsPipeline.__init__(config_override=...) — second plan in a row where the plan's example used the wrong kwarg name and execution fixed it"

key-files:
  created: []
  modified:
    - "tests/test_reels_timing.py — tests 06 and 07 flipped from xfail stubs to active GREEN (170 insertions, 8 deletions across 2 edits; file now 513 lines)"

key-decisions:
  - "Monkeypatch _trim_clips_to_durations instead of exercising the full ffmpeg trim path: the test is a contract assertion on the preference order at video_builder.py:850-855, not an ffmpeg smoke test. Exercising ffmpeg would add multi-second test latency and brittleness to the validation suite."
  - "Wrap concat_clips_with_audio call in try/except: the trim loop runs before the ffmpeg xfade assembly, and the assembly is not under test. Letting post-trim failures propagate would mask the real assertion target."
  - "Double-patch _get_client in test 07 even though fake_gemini_tts_client fixture already double-patches: the explicit in-test setattr documents the Phase 22 D-11 invariant for the next reader and guards against fixture refactors"
  - "50ms tolerance matches Phase 22 success criterion #2 and 23-CONTEXT.md Option C — not arbitrary. ffmpeg concat can drift by sub-millisecond on real files; 50ms is the conservative bound that catches real regressions (e.g., if someone swaps ffprobe for file-size estimation) without flaking on float rounding."

patterns-established:
  - "Trim-loop contract test pattern: capture durations via monkeypatch, run the function, ignore post-trim errors, assert on captured list. Reusable for any trim-loop refactor in video_builder.py."
  - "Regression lock test pattern (Option C from 23-CONTEXT.md): call the producer (run_step_tts) directly, assemble the consumer's expected shape (step_data as the route handler does), assert the contract numerically with a conservative tolerance."

requirements-completed: [TIMING-01, TIMING-04]

# Metrics
duration: 8min
completed: 2026-04-08
---

# Phase 23 Plan 04: concat_clips Integration + Editor Audio Regression Lock Summary

**Flipped the final 2 xfail stubs to active GREEN — Phase 23 validation suite is now fully locked. Test 06 proves the video_builder trim loop consumes the new scene_timings shape; test 07 locks the editor audio contract with a 50ms regression tolerance on step_data['duration'] vs sum(cenas.duration).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-08 (Wave 3 kickoff)
- **Completed:** 2026-04-08
- **Tasks:** 2 (both atomic, both committed)
- **Files modified:** 1 (tests/test_reels_timing.py only — validation-only wave)
- **Production code changes:** 0

## Accomplishments

- **Task 1 — Test 06 flipped** (`6b34168`): `test_concat_clips_with_audio_consumes_new_scene_timings` is now active GREEN. The test builds 3 fake clip paths, constructs scene_timings via `build_scene_timings_from_cenas([{duration: 2.0}, {duration: 3.5}, {duration: 1.75}])`, monkey-patches `video_builder._trim_clips_to_durations` to capture its `durations` argument, calls the real `concat_clips_with_audio`, and asserts the captured list equals `[t["duration"] + 0.3 for t in scene_timings]` — exactly the preference-order branch at `video_builder.py:850-855`.
- **Task 2 — Test 07 flipped** (`70840c8`): `test_editor_audio_items_total_duration_matches_per_cena_sum` is now active GREEN. The test calls `ReelsPipeline.run_step_tts` directly via the `fake_gemini_tts_client` fixture, assembles `step_data` the way `src/api/routes/reels.py:267-281` does, and asserts `abs(step_data["duration"] - sum(cenas.duration)) < 0.050`. This is the TIMING-04 regression lock per 23-CONTEXT.md Option C.
- **Phase 23 validation suite GREEN**: `pytest tests/test_reels_timing.py -q` → **7 passed, 0 xfailed, 0 failed**.
- **Phase 22 regression check GREEN**: `pytest tests/test_reels_tts.py -q` → **11 passed, 0 failed** (no regression from Wave 3 changes — expected since this wave modified only test code).
- **Combined Phase 22+23 suite GREEN**: `pytest tests/test_reels_tts.py tests/test_reels_timing.py -q` → **18 passed, 0 xfailed, 0 failed**.
- **Full suite (excluding pre-existing breakage)**: 235 passed (up from 233 at Wave 2 close), 16 pre-existing failures unchanged, matching the baseline documented in `deferred-items.md`. **No new regressions introduced by Wave 3.**
- **No `@pytest.mark.xfail` markers remain in `tests/test_reels_timing.py`** — verified via grep (0 matches).
- **No `pytest.fail("Stub")` calls remain** — verified via grep (0 matches).

## Task Commits

Each task committed atomically:

1. **Task 1: Flip test 06 (TIMING-01 concat integration)** — `6b34168` (test)
2. **Task 2: Flip test 07 (TIMING-04 editor audio regression lock)** — `70840c8` (test)

## Files Created/Modified

- `tests/test_reels_timing.py` — tests 06 and 07 flipped from xfail stubs to active GREEN. Test 06 adds a monkeypatch-based integration test for `video_builder.concat_clips_with_audio`. Test 07 adds an async regression lock that calls `ReelsPipeline.run_step_tts` directly and validates the route-handler step_data assembly contract. File grew from 352 lines (Wave 2 close) to 513 lines.

## Decisions Made

- **Validation-only wave, no production changes:** Wave 3 is a contract lock, not a refactor. The wiring was completed in Waves 1-2; Wave 3 only adds assertions that prove the wiring works end-to-end.
- **Monkeypatch `_trim_clips_to_durations` instead of running ffmpeg:** Test 06's assertion target is the preference order at `video_builder.py:850-855` — specifically, that the `scene_timings` branch is taken when length matches clip count AND that each `scene_durs[i]` equals `scene_timings[i].duration + transition_duration`. Exercising the full ffmpeg xfade pipeline would add multi-second test latency, require real MP4 inputs, and be brittle to ffmpeg version differences — none of which improves coverage of the contract under test.
- **Try/except around concat_clips_with_audio call in test 06:** The trim loop runs before the xfade assembly. Since we're stubbing `_trim_clips_to_durations` and `subprocess.run` but not every intermediate helper, the post-trim assembly may still fail (e.g., if `get_video_duration` is called on our dummy .mp4 bytes). We catch and ignore those failures because the captured `durations` list is populated by then — that's the assertion target.
- **config_override kwarg (not config):** The plan's action block used `ReelsPipeline(config={...})`, but the actual constructor signature is `__init__(self, config_override: dict | None = None)`. Fixed at write-time to match the real API — same fix that Wave 2 encountered and logged.
- **Double-patch `_get_client` in test 07 even though the fixture already does it:** The `fake_gemini_tts_client` fixture at `tests/conftest.py:74-88` already patches both `src.llm_client._get_client` and `src.reels_pipeline.tts._get_client`. The explicit in-test setattr is documentation for the next reader — it makes the Phase 22 D-11 invariant visible in the test body itself, so a future refactor of the fixture cannot silently break this regression lock.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's test 07 code used wrong ReelsPipeline constructor kwarg**
- **Found during:** Task 2 (writing test body)
- **Issue:** The plan's action block specified `ReelsPipeline(config={...})`, but the actual constructor signature is `def __init__(self, config_override: dict | None = None)`. Same bug as Wave 2's plan. If committed as-is, the test would have failed with `TypeError: ReelsPipeline.__init__() got an unexpected keyword argument 'config'`.
- **Fix:** Replaced `config=` with `config_override=`. The config dict contents are unchanged (`tts_voice`, `tts_provider`, `tts_speed`, `tone`).
- **Files modified:** `tests/test_reels_timing.py` (test 07 body only)
- **Verification:** `pytest tests/test_reels_timing.py::test_editor_audio_items_total_duration_matches_per_cena_sum -x -q` → 1 passed
- **Committed in:** `70840c8` (Task 2 commit)
- **Note:** This is the second time the same plan-code bug has appeared (see 23-03-SUMMARY.md deviation #1). Consider adding to `.planning/STATE.md` accumulated context so future planners catch it at authoring time.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic fix to plan's test code; zero impact on the behavior under test. No scope creep.

## Issues Encountered

None during planned work. Pre-existing unrelated failures (`test_atomic_counter`, `test_credit_service`, `test_credits`, `test_video_prompt_builder`, `test_agents_quick` collection error) remain unchanged and out of scope for Phase 23 — tracked in `deferred-items.md`.

## Deferred Issues

None specific to this plan. The 16 pre-existing failures + 1 collection error in unrelated modules stay in `deferred-items.md`.

## Phase 23 Closeout

**Wave 3 complete — Phase 23 validation suite GREEN**

All 7 TIMING tests active and passing:

| Test                                                      | Requirement | Wave | Status |
|-----------------------------------------------------------|-------------|------|--------|
| test_build_scene_timings_shape_matches_legacy             | TIMING-02   | 1    | PASS   |
| test_build_scene_timings_sums_to_total                    | TIMING-02   | 1    | PASS   |
| test_float_drift_across_many_cenas                        | TIMING-05   | 1    | PASS   |
| test_run_step_srt_uses_new_path_when_tts_cenas_present    | TIMING-03   | 2    | PASS   |
| test_run_step_srt_falls_back_to_legacy_without_tts_cenas  | TIMING-03   | 2    | PASS   |
| test_concat_clips_with_audio_consumes_new_scene_timings   | TIMING-01   | 3    | PASS   |
| test_editor_audio_items_total_duration_matches_per_cena_sum | TIMING-04 | 3    | PASS   |

**Nyquist compliance met:** 4 waves × at least one test flipped per wave (Wave 0 stubs, Wave 1 flips 3, Wave 2 flips 2, Wave 3 flips 2).

**Ready for `/gsd:verify-work`.** The verifier should confirm:
1. All 7 tests active GREEN (verified here: 7 passed, 0 xfailed)
2. No xfail markers remain (verified here: 0 matches)
3. No stub bodies remain (verified here: 0 matches)
4. Phase 22 suite still GREEN (verified here: 11 passed)
5. Every TIMING-XX requirement maps to at least one passing test (verified here: 5/5 mapped)

## Self-Check: PASSED

- **Files modified:**
  - `tests/test_reels_timing.py`: FOUND (513 lines)
  - `.planning/phases/23-audio-anchored-timing-propagation/23-04-SUMMARY.md`: FOUND (this file)
- **Commits exist:**
  - `6b34168` (Task 1 test): FOUND
  - `70840c8` (Task 2 test): FOUND
- **Test state verified:**
  - `pytest tests/test_reels_timing.py -q` → 7 passed, 0 xfailed, 0 failed (expected)
  - `pytest tests/test_reels_tts.py -q` → 11 passed, 0 failures (Phase 22 regression: clean)
  - `pytest tests/test_reels_tts.py tests/test_reels_timing.py -q` → 18 passed, 0 xfailed, 0 failed (expected)
  - Full suite excluding pre-existing: 235 passed, 16 pre-existing failed (unchanged from baseline)
- **Xfail markers:** 0 matches in `tests/test_reels_timing.py`
- **Stub bodies:** 0 matches in `tests/test_reels_timing.py`
- **Smoke: every TIMING test passes individually:** verified via for-loop over 7 test names, each returned "1 passed"

---
*Phase: 23-audio-anchored-timing-propagation*
*Completed: 2026-04-08*
*Wave 3 of 3 — Phase 23 validation suite GREEN — ready for /gsd:verify-work*
