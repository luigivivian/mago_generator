---
phase: 22
slug: per-cena-tts-anchoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `22-RESEARCH.md §Validation Architecture`.

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

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-XX-01 | TBD | TBD | TTS-01 | unit (mock Gemini) | `pytest tests/test_reels_tts.py::test_generates_one_file_per_cena -x` | ❌ W0 | ⬜ pending |
| 22-XX-02 | TBD | TBD | TTS-02 | unit (real ffmpeg-generated silence) | `pytest tests/test_reels_tts.py::test_ffprobe_duration_measured_per_cena -x` | ❌ W0 | ⬜ pending |
| 22-XX-03 | TBD | TBD | TTS-03 | integration (JSON mutation + `flag_modified`) | `pytest tests/test_reels_tts.py::test_step_state_cenas_persisted -x` | ❌ W0 | ⬜ pending |
| 22-XX-04 | TBD | TBD | TTS-04 | unit (assert ffmpeg `-f concat -c copy`; no Gemini concat call) | `pytest tests/test_reels_tts.py::test_concat_not_single_call -x` | ❌ W0 | ⬜ pending |
| 22-XX-05 | TBD | TBD | TTS-04 (tolerance) | unit on real PCM files | `pytest tests/test_reels_tts.py::test_sum_matches_concat_within_tolerance -x` | ❌ W0 | ⬜ pending |
| 22-XX-06 | TBD | TBD | TTS-05 | unit (monkeypatch `client.models.generate_content` args) | `pytest tests/test_reels_tts.py::test_biblical_clamps_speed_to_1 -x` | ❌ W0 | ⬜ pending |
| 22-XX-07 | TBD | TBD | TTS-05 (log) | unit (`caplog`) | `pytest tests/test_reels_tts.py::test_biblical_clamp_logged -x` | ❌ W0 | ⬜ pending |
| 22-XX-08 | TBD | TBD | TTS-06 | unit (monkeypatched Gemini, cena 3 raises) | `pytest tests/test_reels_tts.py::test_single_cena_failure_isolated -x` | ❌ W0 | ⬜ pending |
| 22-XX-09 | TBD | TBD | TTS-06 (classifier) | unit (typed errors 400 vs 429) | `pytest tests/test_reels_tts.py::test_error_classification -x` | ❌ W0 | ⬜ pending |
| 22-XX-10 | TBD | TBD | Success #4 | integration (selective retry via `cena_indices`) | `pytest tests/test_reels_tts.py::test_selective_retry_preserves_others -x` | ❌ W0 | ⬜ pending |
| 22-XX-11 | TBD | TBD | Success #5 | unit (assert top-level `tts.path` / `tts.duration` still written) | `pytest tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written -x` | ❌ W0 | ⬜ pending |

*Task ID `22-XX-NN` = `22-{PLAN_ID}-{TASK_N}`. Bound to concrete plan/task IDs after `gsd-planner` creates PLAN.md files. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_reels_tts.py` — new file covering TTS-01..TTS-06 + success criteria #2/#4/#5 programmatic checks
- [ ] `tests/conftest.py` (or local fixtures) — add `fake_gemini_tts_client` monkeypatch helper and `make_fake_tts_wavs(tmp_path, n_frames_list)` fixture that writes real PCM 24kHz mono 16-bit WAV files for ffprobe/concat verification
- [ ] pytest framework install — **not needed** (already in use, 20+ test files in `tests/`)
- [ ] pytest-asyncio — **not needed** (`asyncio_mode = "auto"` already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Biblical reel audio is audibly slower than non-biblical reel of the same text | Success criterion #3 | Perceptual quality — cannot be asserted programmatically | Generate one biblical reel and one non-biblical reel with the same `tema`; listen to both `audio.wav` files back-to-back; confirm biblical version has slower delivery |
| Editor loads regenerated reel with identical waveform + scene durations | Success criterion #5 | Visual/interactive check on the Remotion preview — out of scope for unit tests | 1. Pick an existing v3.0 reel. 2. Regenerate its TTS step with Phase 22 code. 3. Open `/reels/{jobId}/edit`. 4. Confirm waveform track renders the same length, scene durations match, no visual drift, timeline scrub works end-to-end. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify entries tied to the commands above OR Wave 0 dependency acknowledged
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/test_reels_tts.py`, `fake_gemini_tts_client` fixture)
- [ ] No watch-mode flags used in commands
- [ ] Feedback latency < 30s per commit
- [ ] `nyquist_compliant: true` set in frontmatter after gsd-planner binds task IDs

**Approval:** pending
