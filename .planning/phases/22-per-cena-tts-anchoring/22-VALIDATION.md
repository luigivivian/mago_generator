---
phase: 22
slug: per-cena-tts-anchoring
status: bound
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
bound: 2026-04-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `22-RESEARCH.md §Validation Architecture`. Task IDs bound to PLAN.md files on 2026-04-08.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode = "auto"` in `pyproject.toml`) |
| **Config file** | `/Users/luigivivian/meme-lab/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `pytest tests/test_reels_tts.py -x -q` |
| **Full suite command** | `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` |
| **Estimated runtime** | ~30 seconds (mock Gemini client); ~2 minutes for full suite |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_reels_tts.py -x -q`
- **After every plan wave:** Run `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py`
- **Before `/gsd:verify-work`:** Full suite must be green + manual editor smoke test on one regenerated reel
- **Max feedback latency:** 30 seconds per commit

---

## Plan → Wave Map

| Plan | Wave | Depends On | Role |
|------|------|------------|------|
| 22-01 | 0 | — | Wave 0 — test infrastructure (conftest.py + test_reels_tts.py xfail stubs) |
| 22-02 | 1 | 22-01 | Biblical clamp (D-11/D-12) + classify_tts_error helper inside tts.py |
| 22-03 | 2 | 22-01, 22-02 | Per-cena loop refactor in run_step_tts + _concat_cena_wavs ffmpeg helper + batch-mode caller update |
| 22-04 | 3 | 22-03 | Route handler rewrite for new signature + cena_indices body param (selective retry) |
| 22-05 | 4 | 22-03, 22-04 | Editor compat programmatic check (final xfail flipped) |

---

## Per-Task Verification Map

Task ID format: `{PLAN_ID}-T{TASK_N}` — bound to the Task N inside `22-{PLAN_ID}-PLAN.md`.

| # | Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Stub Created By | Flipped By | Status |
|---|---------|------|------|-------------|-----------|-------------------|-----------------|------------|--------|
| 01 | 22-03-T3 | 22-03 | 2 | TTS-01 | unit (mock Gemini) | `pytest tests/test_reels_tts.py::test_generates_one_file_per_cena -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 02 | 22-03-T3 | 22-03 | 2 | TTS-02 | unit (real ffmpeg-generated silence) | `pytest tests/test_reels_tts.py::test_ffprobe_duration_measured_per_cena -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 03 | 22-03-T3 | 22-03 | 2 | TTS-03 | integration (in-memory JSON mutation + callback) | `pytest tests/test_reels_tts.py::test_step_state_cenas_persisted -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 04 | 22-03-T3 | 22-03 | 2 | TTS-04 | unit (assert ffmpeg `-f concat -c copy`; Gemini called N times not N+1) | `pytest tests/test_reels_tts.py::test_concat_not_single_call -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 05 | 22-03-T3 | 22-03 | 2 | TTS-04 (tolerance) | unit on real PCM files | `pytest tests/test_reels_tts.py::test_sum_matches_concat_within_tolerance -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 06 | 22-02-T2 | 22-02 | 1 | TTS-05 | unit (captures args passed to fake client) | `pytest tests/test_reels_tts.py::test_biblical_clamps_speed_to_1 -x` | 22-01-T2 | 22-02-T2 | ✅ green |
| 07 | 22-02-T2 | 22-02 | 1 | TTS-05 (log) | unit (`caplog` on `clip-flow.reels.tts`) | `pytest tests/test_reels_tts.py::test_biblical_clamp_logged -x` | 22-01-T2 | 22-02-T2 | ✅ green |
| 08 | 22-03-T3 | 22-03 | 2 | TTS-06 | unit (fake client raises on specific cena) | `pytest tests/test_reels_tts.py::test_single_cena_failure_isolated -x` | 22-01-T2 | 22-03-T3 | ✅ green |
| 09 | 22-02-T2 | 22-02 | 1 | TTS-06 (classifier) | unit (typed errors 400 vs 429 vs 5xx) | `pytest tests/test_reels_tts.py::test_error_classification -x` | 22-01-T2 | 22-02-T2 | ✅ green |
| 10 | 22-04-T3 | 22-04 | 3 | Success #4 | integration (selective retry via `cena_indices`) | `pytest tests/test_reels_tts.py::test_selective_retry_preserves_others -x` | 22-01-T2 | 22-04-T3 | ✅ green |
| 11 | 22-05-T1 | 22-05 | 4 | Success #5 | unit (assert top-level `tts.path` / `tts.duration` still written) | `pytest tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written -x` | 22-01-T2 | 22-05-T1 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Coverage

| Requirement | Test(s) | Plan(s) |
|-------------|---------|---------|
| TTS-01 | #01 | 22-03 |
| TTS-02 | #02 | 22-03 |
| TTS-03 | #03 | 22-03 |
| TTS-04 | #04, #05 | 22-03 |
| TTS-05 | #06, #07 | 22-02 |
| TTS-06 | #08, #09 | 22-02 (classifier) + 22-03 (isolation) |
| Success #4 (selective retry) | #10 | 22-04 |
| Success #5 (editor compat) | #11 | 22-05 |

All 6 TTS requirements have at least one automated test. Success criteria #2 and #4 have dedicated programmatic checks (#05 and #10). Success criterion #5 has one programmatic check (#11) plus a manual smoke gate (below). Success criterion #3 is manual-only (perceptual).

---

## Wave 0 Requirements

- [ ] `tests/test_reels_tts.py` — created by **22-01-T2** as 11 xfail stubs (`pytest.fail("Stub — ...")`). Each stub has the exact test name listed above.
- [ ] `tests/conftest.py` — created by **22-01-T1** with `fake_gemini_tts_client` monkeypatch fixture and `make_fake_tts_wavs(n_frames_list)` factory that writes real PCM 24kHz mono 16-bit WAV files. Uses `FakeGeminiClient` class that records all `generate_content` call args.
- pytest framework install — **not needed** (already in use, 20+ test files in `tests/`)
- pytest-asyncio — **not needed** (`asyncio_mode = "auto"` already configured)

**Wave 0 completion gate:** After 22-01 commits, `pytest tests/test_reels_tts.py -q` exits 0 with all 11 tests in `xfail` state, AND `pytest tests/ -q --ignore=tests/test_bible_e2e.py` still GREEN.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Gate |
|----------|-------------|------------|-------------------|------|
| Biblical reel audio is audibly slower than non-biblical reel of the same text | Success criterion #3 | Perceptual quality — cannot be asserted programmatically | Generate one biblical reel and one non-biblical reel with the same `tema`; listen to both `audio.wav` files back-to-back; confirm biblical version has slower delivery | `/gsd:verify-work` |
| Editor loads regenerated reel with identical waveform + scene durations | Success criterion #5 (visual) | Visual/interactive check on the Remotion preview — out of scope for unit tests | 1. Pick an existing v3.0 reel. 2. Regenerate its TTS step with Phase 22 code (`POST /reels/{jobId}/step/tts`). 3. Open `/reels/{jobId}/edit`. 4. Confirm waveform track renders the same length, scene durations match, no visual drift, timeline scrub works end-to-end. | `/gsd:verify-work` |

---

## Validation Sign-Off

- [x] All 11 test rows have a bound `{PLAN_ID}-T{N}` task ID
- [x] Every TTS-01..TTS-06 requirement is covered by at least one automated test
- [x] Success criteria #4 and #5 have programmatic checks in addition to the manual gates
- [x] Sampling continuity: Wave 1 (22-02) lands 3 tests; Wave 2 (22-03) lands 6 tests; Wave 3 (22-04) lands 1 test; Wave 4 (22-05) lands 1 test — no 3-consecutive-task gap without a test flip
- [x] Wave 0 covers all MISSING references (`tests/test_reels_tts.py`, `tests/conftest.py`, `fake_gemini_tts_client`, `make_fake_tts_wavs`)
- [x] No watch-mode flags used in commands (`-x -q`)
- [x] Feedback latency < 30s per commit (fake client + real ffmpeg on tiny PCM files)
- [x] `nyquist_compliant: true` set in frontmatter (all task IDs bound)

**Approval:** bound 2026-04-08 — ready for execute-phase
