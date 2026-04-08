---
phase: 22-per-cena-tts-anchoring
plan: 01
subsystem: testing
tags: [pytest, xfail, tts, gemini, wav, fixtures]

# Dependency graph
requires: []
provides:
  - "Shared TTS test fixtures (FakeGeminiClient, fake_gemini_tts_client, make_fake_tts_wavs)"
  - "11 xfail test stubs mapping 1:1 to 22-VALIDATION.md Per-Task Verification Map"
affects: [22-02, 22-03, 22-04, 22-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["xfail-stub validation contract -- stubs created first, flipped active as features land"]

key-files:
  created:
    - tests/conftest.py
    - tests/test_reels_tts.py
  modified: []

key-decisions:
  - "Monkeypatch target is src.llm_client._get_client (source module) per plan spec"
  - "All 11 stubs use pytest.fail() not pass -- ensures removing xfail without implementing actually breaks"

patterns-established:
  - "Wave 0 xfail stubs: create test stubs with xfail markers, flip in implementation waves"
  - "FakeGeminiClient pattern: records calls for assertion, supports error queue for failure testing"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-08
---

# Phase 22 Plan 01: Wave 0 TTS Test Infrastructure Summary

**11 xfail test stubs + shared TTS fixtures (FakeGeminiClient, WAV factory) establishing the validation contract for per-cena TTS refactor**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T23:08:22Z
- **Completed:** 2026-04-08T23:12:10Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created `tests/conftest.py` with FakeGeminiClient (call recording + error queue), `fake_gemini_tts_client` fixture (monkeypatches `_get_client`), and `make_fake_tts_wavs` fixture (real PCM WAV factory)
- Created `tests/test_reels_tts.py` with 11 xfail stub tests matching exact names from 22-VALIDATION.md
- Suite is GREEN: `11 xfailed in 1.00s` -- no impact on existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/conftest.py with shared fixtures** - `dcdd3ad` (test)
2. **Task 2: Create tests/test_reels_tts.py with 11 xfail stub tests** - `a9a04e9` (test)

## Files Created

- `tests/conftest.py` (119 lines) -- FakeGeminiClient, FakeGeminiResponse, fake_gemini_tts_client fixture, make_fake_tts_wavs fixture
- `tests/test_reels_tts.py` (139 lines) -- 11 xfail test stubs covering TTS-01 through TTS-06 + success criteria #4/#5

## 11 Registered Test Names

1. `test_generates_one_file_per_cena` (TTS-01, Wave 1/22-02)
2. `test_ffprobe_duration_measured_per_cena` (TTS-02, Wave 2/22-03)
3. `test_step_state_cenas_persisted` (TTS-03, Wave 2/22-03)
4. `test_concat_not_single_call` (TTS-04, Wave 2/22-03)
5. `test_sum_matches_concat_within_tolerance` (TTS-04 tolerance, Wave 2/22-03)
6. `test_biblical_clamps_speed_to_1` (TTS-05, Wave 1/22-02)
7. `test_biblical_clamp_logged` (TTS-05 log, Wave 1/22-02)
8. `test_single_cena_failure_isolated` (TTS-06, Wave 2/22-03)
9. `test_error_classification` (TTS-06 classifier, Wave 1/22-02)
10. `test_selective_retry_preserves_others` (Success #4, Wave 2/22-04)
11. `test_editor_compat_tts_path_and_duration_still_written` (Success #5, Wave 3/22-05)

## Decisions Made
- Monkeypatch target set to `src.llm_client._get_client` (source module path) per plan specification -- later waves may need to adjust to `src.reels_pipeline.tts._get_client` if the `from X import Y` binding isn't caught by source-level patching
- All stubs use `pytest.fail("Stub -- ...")` rather than `pass` to ensure removing xfail without implementing the test body causes a real failure

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

- Pre-existing test failures in `test_atomic_counter.py`, `test_credit_service.py`, `test_credits.py`, `test_video_prompt_builder.py` (16 failures total) -- unrelated to Phase 22 changes, not addressed
- Pre-existing collection error in `test_agents_quick.py` (missing module `src.pipeline.agents.hackernews`) -- also unrelated

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Wave 0 test infrastructure is ready -- 22-02 through 22-05 can flip xfail markers and implement test bodies
- `pytest tests/test_reels_tts.py -q` confirms GREEN baseline
- FakeGeminiClient supports both success and error queue patterns needed by TTS-05 (biblical clamp) and TTS-06 (error classification)

## Self-Check: PASSED

- tests/conftest.py: FOUND
- tests/test_reels_tts.py: FOUND
- 22-01-SUMMARY.md: FOUND
- Commit dcdd3ad: FOUND
- Commit a9a04e9: FOUND

---
*Phase: 22-per-cena-tts-anchoring*
*Completed: 2026-04-08*
