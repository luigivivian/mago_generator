---
phase: 22-per-cena-tts-anchoring
verified: 2026-04-09T00:19:10Z
status: passed
score: 5/5 success criteria verified (6/6 requirements satisfied; 11/11 tests GREEN)
---

# Phase 22: Per-Cena TTS Anchoring — Verification Report

**Phase Goal:** A reels job's TTS step produces one Gemini TTS file per cena, each with its real duration measured and persisted as ground truth for all downstream steps.
**Verified:** 2026-04-09T00:19:10Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `/reels/{jobId}/step/tts` produces one audio file per `script.cenas[i]` in addition to concatenated `narracao_completa` | VERIFIED | `src/reels_pipeline/main.py:472-526` fan-out writes `{job_dir}/audio/cena_{i:03d}.wav` per cena then concats to `{job_dir}/audio.wav`; `tests/test_reels_tts.py::test_generates_one_file_per_cena` asserts both exist and PASSES |
| 2 | `step_state.tts.cenas[i].duration` contains ffprobe-measured float for every cena; sum equals concat duration within 50ms | VERIFIED | `main.py:493` calls `get_video_duration(cena_path)` per cena and stores in `cenas_meta[i].duration`; `main.py:547` measures concat via same ffprobe; `test_ffprobe_duration_measured_per_cena` + `test_sum_matches_concat_within_tolerance` PASS |
| 3 | Biblical tone forces `speaking_rate = 1.0` (audibly slower than default 1.35x) | VERIFIED | `src/reels_pipeline/tts.py:150-155` clamp inside `generate_narration` (lowest layer); `test_biblical_clamps_speed_to_1` + `test_biblical_clamp_logged` PASS |
| 4 | Single cena failure leaves others intact, marks `cenas[i].failed=true`, allows selective retry | VERIFIED | `main.py:472-523` per-cena try/except with `classify_tts_error` routing; `main.py:419-423` selective retry via `cena_indices`; `test_single_cena_failure_isolated` + `test_selective_retry_preserves_others` PASS |
| 5 | Editor still loads and plays waveform for `narracao_completa.wav` unchanged (compat preserved) | VERIFIED | `src/api/routes/reels.py:277-278` writes top-level `step_data["path"]` + `step_data["duration"]`; `memelab/src/stores/editor-store.ts:167` reads `stepState.tts?.path`, `:198` reads `stepState.tts?.duration`; `test_editor_compat_tts_path_and_duration_still_written` PASS |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/reels_pipeline/tts.py` | `classify_tts_error` helper + biblical clamp + `_concat_cena_wavs` + `generate_narration` | VERIFIED | 289 lines; `classify_tts_error` at L26, biblical clamp at L150-155, `_concat_cena_wavs` at L225, `generate_narration` at L110; all imported and used |
| `src/reels_pipeline/main.py` | `run_step_tts(script, job_dir, *, cena_indices, on_cena_update)` returning 4-tuple | VERIFIED | L355-565: signature matches exactly; uses `asyncio.Semaphore(3)` (L470), `process_cena` (L472), exponential backoff (L511), `classify_tts_error` (L502), `_concat_cena_wavs` (L540), `get_video_duration` (L493, L547); old `narration_text=` signature fully removed |
| `src/api/routes/reels.py` | tts branch calls new signature, `_cena_lock`, `cena_indices` body param, editor compat writes | VERIFIED | 2776 lines; tts branch L218-293 has `_cena_lock=asyncio.Lock()` (L236), `_cena_update` coroutine (L238-258) with independent session + `flag_modified`, `pipeline.run_step_tts(script, job_dir, cena_indices, on_cena_update)` (L267-272), D-05 status convention (L286-291), `body: dict \| None = Body` (L1006), validation (L1095-1107) |
| `tests/test_reels_tts.py` | 11 active tests, zero xfail, zero stubs | VERIFIED | 422 lines; `grep -c @pytest.mark.xfail` = 0, `grep -c 'pytest.fail("Stub'` = 0, 11 test functions discovered |
| `tests/conftest.py` | `FakeGeminiClient`, `fake_gemini_tts_client`, `make_fake_tts_wavs` fixtures | VERIFIED | 122 lines; all 3 fixtures defined; monkeypatches both `src.llm_client._get_client` and `src.reels_pipeline.tts._get_client` (the from-import binding fix from 22-03) |
| `src/reels_pipeline/main.py` batch caller | Uses new signature (no dangling old call site) | VERIFIED | L1266-1268 calls `self.run_step_tts(script, job_dir)` with 4-tuple unpack — migrated by 22-03 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `main.py::run_step_tts` | `tts.py::generate_narration` | per-cena loop | WIRED | `main.py:485` awaits inside `process_cena` |
| `main.py::run_step_tts` | `video_builder.py::get_video_duration` | ffprobe after each generate | WIRED | `main.py:493` (per-cena) + L547 (concat) |
| `main.py::run_step_tts` | `tts.py::_concat_cena_wavs` | ffmpeg concat after fan-out | WIRED | `main.py:540` |
| `main.py::run_step_tts` | `tts.py::classify_tts_error` | retry decision | WIRED | `main.py:502` |
| `routes/reels.py::_execute_step_task` | `main.py::run_step_tts` | new 4-tuple signature | WIRED | `reels.py:267-272` unpacks `(audio_path, total_duration, cost_usd, cenas_meta)` |
| `routes/reels.py::execute_step` | `_execute_step_task` (tts branch) | `config_override["cena_indices"]` | WIRED | `reels.py:1095-1107` validates + threads body param |
| `routes/reels.py::_cena_update` | `ReelsJob.step_state["tts"]["cenas"]` | independent session + `flag_modified` | WIRED | `reels.py:243-254` mirrors the clips `_scene_update` pattern |
| `routes/reels.py` tts branch | `memelab/src/stores/editor-store.ts` | top-level `tts.path` + `tts.duration` | WIRED | `reels.py:277-278` writes; editor reads at `editor-store.ts:167` + `:198` |
| `tts.py::generate_narration` | biblical clamp log | INFO log with `forcing speaking_rate=1.0` | WIRED | `tts.py:150-155` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `cenas_meta` in `run_step_tts` | `duration`, `path`, `status`, `failed` | real `get_video_duration(cena_path)` ffprobe (`main.py:493`) + real Gemini client (or `FakeGeminiClient` in tests) | Yes — measured per cena after each generate, not hardcoded | FLOWING |
| `step_state["tts"]["cenas"]` in DB | per-cena dicts | `cenas_meta` returned from `run_step_tts` → `step_data["cenas"] = cenas_meta` at `reels.py:279` → SQLAlchemy commit with `flag_modified` | Yes — additive writes with ground-truth durations | FLOWING |
| `step_data["duration"]` (editor compat) | `total_duration` float | `get_video_duration(audio.wav)` at `main.py:547` | Yes — ffprobe measurement of real concat output | FLOWING |
| `step_data["path"]` (editor compat) | `audio_path` string | `os.path.join(job_dir, "audio.wav")` at `main.py:408`, verified file after `_concat_cena_wavs` (`main.py:540`) | Yes — real file on disk | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 11 tests pass | `python -m pytest tests/test_reels_tts.py -q` | `11 passed in 2.91s` | PASS |
| `classify_tts_error` dispatches correctly | `classify_tts_error(ClientError(400))=='fail'; (429)=='retry'; (403)=='fail'; ServerError(500)=='retry'; ValueError=='retry'` | all assertions pass | PASS |
| `_concat_cena_wavs` rejects empty input | `_concat_cena_wavs([], '/tmp/foo.wav')` → raises `ValueError` | raised as expected | PASS |
| Module imports are clean | `from src.reels_pipeline.tts import classify_tts_error, generate_narration, _concat_cena_wavs, _wrap_pcm_as_wav, estimate_tts_cost` | OK | PASS |
| `run_step_tts` signature matches contract | `inspect.signature(ReelsPipeline.run_step_tts)` | `(self, script: dict, job_dir: str, *, cena_indices: list[int] \| None = None, on_cena_update=None) -> tuple[str, float, float, list[dict]]` | PASS |
| Route handler imports cleanly (no signature drift crash) | `from src.api.routes import reels` | OK | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TTS-01 | 22-03, 22-04 | `run_step_tts` generates one Gemini TTS file per cena | SATISFIED | `main.py:472-526` per-cena loop; `test_generates_one_file_per_cena` PASS |
| TTS-02 | 22-03, 22-04 | Each per-cena file has duration measured via ffprobe | SATISFIED | `main.py:493` calls `get_video_duration`; `test_ffprobe_duration_measured_per_cena` PASS |
| TTS-03 | 22-03, 22-04 | Per-cena durations persisted in `step_state.tts.cenas[i].duration` | SATISFIED | `reels.py:243-254` commits `cenas_list` with `flag_modified`; `reels.py:279` writes `step_data["cenas"] = cenas_meta`; `test_step_state_cenas_persisted` PASS |
| TTS-04 | 22-03, 22-04, 22-05 | `narracao_completa` continues as concat from per-cena via ffmpeg | SATISFIED | `tts.py:225-289` `_concat_cena_wavs` + `main.py:540`; `test_concat_not_single_call` + `test_sum_matches_concat_within_tolerance` PASS |
| TTS-05 | 22-02 | Biblical tone forces `speaking_rate=1.0` | SATISFIED | `tts.py:150-155` lowest-layer clamp + INFO log; `test_biblical_clamps_speed_to_1` + `test_biblical_clamp_logged` PASS |
| TTS-06 | 22-02, 22-03, 22-04 | Cena failure isolated + retry with backoff + selective regen | SATISFIED | `main.py:472-523` per-cena retry loop with `classify_tts_error` + exponential backoff (L511) + selective `cena_indices`; `test_single_cena_failure_isolated` + `test_error_classification` + `test_selective_retry_preserves_others` PASS |

**All 6 requirement IDs declared by plans are satisfied.** REQUIREMENTS.md traceability table confirms TTS-01..TTS-06 as `Complete` and mapped to Phase 22. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No TODO/FIXME/XXX/HACK/placeholder/stub markers in `tts.py`, `main.py` run_step_tts body (L355-570), or `reels.py` tts branch (L218-295). Clean. |

Grep scans for `TODO|FIXME|XXX|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented` against all Phase 22 scope files returned zero hits.

### Human Verification Required

The following perceptual check is explicitly documented in `22-VALIDATION.md` as a manual gate and is out of scope for automation:

1. **Editor waveform smoke test after regenerate TTS**
   - Test: Pick an existing v3.0 reel, POST `/reels/{jobId}/step/tts` (optionally with `cena_indices=[i]` for selective retry), open `/reels/{jobId}/edit`.
   - Expected: waveform renders the same length as before, per-scene durations match, no visual drift, timeline scrub end-to-end is smooth, biblical-tone reel audibly slower than default.
   - Why human: perceptual (audio pacing), Remotion preview visual, and waveform rendering are not unit-testable. The programmatic editor compat contract at `test_editor_compat_tts_path_and_duration_still_written` covers the pipeline-boundary side of the contract but cannot verify the actual UI rendering.

This does NOT block the `passed` verdict — all automated goal checks are GREEN, and the editor compat contract at the code/data level is pinned by the test suite.

### Gaps Summary

No gaps. All 5 Success Criteria from ROADMAP are satisfied, all 6 TTS-* requirements from REQUIREMENTS.md are satisfied, all 11 tests in `tests/test_reels_tts.py` are active and PASSING, all key links are WIRED, all data flows are FLOWING, and zero anti-patterns were found in the scope files. The architectural refactor (`tts.py` per-cena helpers, `run_step_tts` 4-tuple return, route handler rewrite, `cena_indices` body param, editor compat preservation) is complete and internally consistent. The only remaining gate is a manual editor smoke test, which is the documented human gate at `/gsd:verify-work` time and does not block phase closure at the automation level.

---

*Verified: 2026-04-09T00:19:10Z*
*Verifier: Claude (gsd-verifier)*
