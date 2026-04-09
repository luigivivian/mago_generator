---
phase: 23
slug: audio-anchored-timing-propagation
status: bound
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
bound: 2026-04-08
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `23-RESEARCH.md §5 Test Strategy + §6 Validation Architecture`. Task IDs bound to PLAN.md files on 2026-04-08.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode = "auto"` in `pyproject.toml`) |
| **Config file** | `/Users/luigivivian/meme-lab/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `pytest tests/test_reels_timing.py -x -q` |
| **Full suite command** | `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` |
| **Estimated runtime** | <5 seconds quick run (pure unit + mock-based integration, no Gemini/ffprobe); ~2 minutes full suite |

**Framework install:** not needed. pytest + pytest-asyncio are already in use and covered by Phase 22's Wave 0.

**Conftest fixtures:** not needed. `build_scene_timings_from_cenas` is pure; `run_step_srt` integration tests mock `transcribe_to_srt` / `align_srt_with_script` / `estimate_transcription_cost` directly and can reuse Phase 22's `fake_gemini_tts_client` fixture from `tests/conftest.py` if needed.

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_reels_timing.py -x -q` (<5s)
- **After every plan wave:** Run `pytest tests/test_reels_timing.py tests/test_reels_tts.py -x -q` (<10s — catches Phase 22 regressions if Phase 23 code unexpectedly touches the TTS layer)
- **Before `/gsd:verify-work`:** Full suite `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` must be green + manual biblical reel playback smoke test
- **Max feedback latency:** <5 seconds per commit

**Nyquist compliance:** 4 waves × ≥1 test flipped per wave = no 3-consecutive-task gap without an automated verify. ✅

---

## Plan → Wave Map

| Plan | Wave | Depends On | Role |
|------|------|------------|------|
| 23-01 | 0 | — | Wave 0 — test infrastructure (`tests/test_reels_timing.py` with 7 xfail stubs; `src/reels_pipeline/timing.py` scaffold) |
| 23-02 | 1 | 23-01 | Wave 1 — implement `build_scene_timings_from_cenas` helper; flip tests 01-03 from xfail to GREEN |
| 23-03 | 2 | 23-01, 23-02 | Wave 2 — gate `run_step_srt` on `tts.cenas` presence; thread `tts_cenas` through route handler; flip tests 04-05 |
| 23-04 | 3 | 23-03 | Wave 3 — confirm `concat_clips_with_audio` call sites read `step_state.srt.scene_timings`; editor `audioItems` regression lock; flip tests 06-07 |

---

## Per-Task Verification Map

Task ID format: `{PLAN_ID}-T{TASK_N}` — bound to the Task N inside `23-{PLAN_ID}-PLAN.md`.

| # | Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Stub Created By | Flipped By | Status |
|---|---------|------|------|-------------|-----------|-------------------|-----------------|------------|--------|
| 01 | 23-02-T2 | 23-02 | 1 | TIMING-02 (shape) | unit (shape regression vs `align_srt_with_script`) | `pytest tests/test_reels_timing.py::test_build_scene_timings_shape_matches_legacy -x` | 23-01-T1 | 23-02-T2 | ⬜ pending |
| 02 | 23-02-T2 | 23-02 | 1 | TIMING-02 (sum) | unit (total duration invariant) | `pytest tests/test_reels_timing.py::test_build_scene_timings_sums_to_total -x` | 23-01-T1 | 23-02-T2 | ⬜ pending |
| 03 | 23-02-T2 | 23-02 | 1 | TIMING-05 | unit (50 cenas, realistic distribution) | `pytest tests/test_reels_timing.py::test_float_drift_across_many_cenas -x` | 23-01-T1 | 23-02-T2 | ⬜ pending |
| 04 | 23-03-T3 | 23-03 | 2 | TIMING-03 (gate) | integration (mock `align_srt_with_script`; assert NOT called) | `pytest tests/test_reels_timing.py::test_run_step_srt_uses_new_path_when_tts_cenas_present -x` | 23-01-T1 | 23-03-T3 | ⬜ pending |
| 05 | 23-03-T3 | 23-03 | 2 | TIMING-03 (fallback) | integration (mock `align_srt_with_script`; assert called once) | `pytest tests/test_reels_timing.py::test_run_step_srt_falls_back_to_legacy_without_tts_cenas -x` | 23-01-T1 | 23-03-T3 | ⬜ pending |
| 06 | 23-04-T2 | 23-04 | 3 | TIMING-01 | integration (mock `_trim_clips_to_durations` via fake ffmpeg) | `pytest tests/test_reels_timing.py::test_concat_clips_with_audio_consumes_new_scene_timings -x` | 23-01-T1 | 23-04-T2 | ⬜ pending |
| 07 | 23-04-T2 | 23-04 | 3 | TIMING-04 (regression lock) | integration (simulates route handler step_data assembly; asserts `step_state.tts.duration == sum(tts.cenas[i].duration)`) | `pytest tests/test_reels_timing.py::test_editor_audio_items_total_duration_matches_per_cena_sum -x` | 23-01-T1 | 23-04-T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Coverage

| Requirement | Behavior | Test(s) | Plan(s) |
|-------------|----------|---------|---------|
| TIMING-01 | `concat_clips_with_audio` consumes new `scene_timings` (built from `tts.cenas`) | #06 | 23-04 |
| TIMING-02 | Scene timings built via cumulative sum of per-cena durations (shape + total invariant) | #01, #02 | 23-02 |
| TIMING-03 | `align_srt_with_script` bypassed when `tts.cenas` present; legacy fallback preserved | #04, #05 | 23-03 |
| TIMING-04 | Editor `audioItems[0]` duration matches `sum(tts.cenas.duration)` (regression lock — frontend already reads `stepState.tts.duration` directly, no new backend field) | #07 | 23-04 |
| TIMING-05 | No float drift across 50 cenas (`round(cursor * 1000) / 1000` at every cumulative step) | #03 | 23-02 |

All 5 TIMING requirements have at least one automated test. TIMING-03 has two programmatic checks (both gate directions). TIMING-04 is a regression lock per RESEARCH.md §4 Option C (frontend reads `stepState.tts.duration` directly, so the assertion is `step_state.tts.duration == sum(tts.cenas[i].duration)` within 1ms ffmpeg concat tolerance).

---

## Wave 0 Requirements

- [ ] `tests/test_reels_timing.py` — created by **23-01-T1** as 7 xfail stubs (`pytest.fail("Stub — ...")`). Each stub has the exact test name listed above. Separate from `test_reels_tts.py` to keep phase commits atomic (Phase 22's `22-VALIDATION.md` is already frozen ✅ green).
- [ ] `src/reels_pipeline/timing.py` — empty scaffold with `def build_scene_timings_from_cenas(tts_cenas: list[dict]) -> list[dict]: raise NotImplementedError`. Created by **23-01-T2** (optional — Wave 1 can create and implement together).
- pytest framework install — **not needed** (Phase 22 already uses it)
- pytest-asyncio — **not needed** (`asyncio_mode = "auto"` already configured)
- Conftest fixtures — **not needed** (helper is pure; `run_step_srt` integration tests mock dependencies inline)

**Wave 0 completion gate:** After 23-01 commits, `pytest tests/test_reels_timing.py -q` exits 0 with all 7 tests in `xfail` state, AND `pytest tests/ -q --ignore=tests/test_bible_e2e.py` still GREEN.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Gate |
|----------|-------------|------------|-------------------|------|
| Biblical reel plays in sync end-to-end after TIMING refactor | TIMING-01..05 integration | Perceptual — video playback sync is not unit-testable | 1. Regenerate an existing biblical reel's `srt` step (or `tts` then `srt`). 2. Open `/reels/{jobId}/edit`. 3. Play timeline end-to-end. 4. Confirm no scene lags behind audio in the final 3-4 cenas (the "Cenas desalinhadas após a terceira" bug from ref doc §9). | `/gsd:verify-work` |
| Editor waveform still renders correctly | TIMING-04 regression | Visual check on Remotion preview | 1. Same reel. 2. Confirm waveform length matches timeline. 3. Confirm scene durations on the clips track match the audio beats. 4. Confirm no visual drift at the end of the timeline. | `/gsd:verify-work` |

---

## Validation Sign-Off

- [x] All 7 test rows have a bound `{PLAN_ID}-T{N}` task ID
- [x] Every TIMING-01..TIMING-05 requirement is covered by at least one automated test
- [x] TIMING-03 has two programmatic checks (new path + legacy fallback)
- [x] TIMING-04 is a regression lock per RESEARCH.md §4 Option C (no new backend field; frontend already reads `stepState.tts.duration` directly)
- [x] Sampling continuity: Wave 1 (23-02) lands 3 tests; Wave 2 (23-03) lands 2 tests; Wave 3 (23-04) lands 2 tests — no 3-consecutive-task gap without a test flip (Nyquist compliant)
- [x] Wave 0 covers all MISSING references (`tests/test_reels_timing.py`, `src/reels_pipeline/timing.py` scaffold)
- [x] No watch-mode flags used in commands (`-x -q`)
- [x] Feedback latency <5s per commit (pure unit + mock-based integration, no Gemini/ffprobe I/O)
- [x] `nyquist_compliant: true` set in frontmatter (all task IDs bound)

**Approval:** bound 2026-04-08 — ready for execute-phase
