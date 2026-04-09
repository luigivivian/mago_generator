---
phase: 23
phase_name: audio-anchored-timing-propagation
gathered: 2026-04-09
status: Ready for planning
mode: smart-discuss (autonomous)
---

# Phase 23: Audio-Anchored Timing Propagation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Every downstream timing consumer (clip trimming in `concat_clips_with_audio`, SRT generation in `run_step_srt`, editor `audioItems[0].total_duration`) reads per-cena durations directly from `step_state.tts.cenas[i].duration` (landed in Phase 22), eliminating the char-offset approximation fallback (`align_srt_with_script`) in the new code path. Legacy jobs missing `tts.cenas` continue to work via a legacy fallback branch. Cumulative cursor drift ("Cenas desalinhadas após a terceira", ref doc section 9) is fixed with millisecond rounding at every step.

**In scope:** `concat_clips_with_audio`, `run_step_srt`, `audioItems` wire-up, float cursor rounding, legacy fallback gate, regression tests for TIMING-01..05.
**Out of scope:** Phase 22 work (done), script schema v2 (Phase 24), image prompts (Phase 25), Ken Burns (Phase 26).

</domain>

<decisions>
## Implementation Decisions

### Data Flow
- **scene_timings construction** — New helper `build_scene_timings_from_cenas(tts_cenas)` in `src/reels_pipeline/timing.py` is the single source of truth. Reused by clips, srt, and editor paths. Zero duplication.
- **Consumer access pattern** — Caller reads `step_state.tts.cenas` and passes the result through the existing `scene_timings` parameter on `concat_clips_with_audio` and the srt path. **No downstream signature changes.** This keeps the refactor surgical.
- **Legacy jobs (no `tts.cenas`)** — Fall back to `align_srt_with_script` char-offset path, gated by `if not tts.get("cenas"):`. New path bypasses legacy entirely for Phase 22+ jobs.
- **scene_timings shape** — Preserved as `{index, start, end, duration, narracao}`. All downstream code works unchanged.

### SRT Strategy
- **SRT source** — Keep Gemini raw SRT text unchanged (byte-for-byte). Per-cena `scene_timings` are derived from `tts.cenas[i].duration`, not from char offsets. Gemini word-level timings (preserved in quick-260407-2cj) remain authoritative for subtitle rendering.
- **`align_srt_with_script` deprecation** — Kept as legacy fallback only. New code path never calls it when `tts.cenas` exists. Not dead-code removed (to preserve legacy job loading).
- **Timestamp math** — `start = round(sum(cenas[0..i-1].duration) * 1000) / 1000`, `end = round((start + cenas[i].duration) * 1000) / 1000`. Millisecond precision consistently.
- **Success criterion #5 verification** — Unit test uses `unittest.mock.patch` on `align_srt_with_script` and asserts `assert_not_called()` when run with a Phase-22-style job (has `tts.cenas`). Grep-based lint is not used — mock-based is more precise.

### Editor + Float Drift
- **TIMING-04 interpretation (Option C — regression lock only)** — Research discovered frontend `editor-store.ts:164-217` reads `stepState.tts?.duration` directly, NOT `audioItems[0].total_duration`. Phase 22 already populates `stepState.tts.duration` correctly via ffprobe. So TIMING-04 is reframed as a **regression lock**: zero frontend change, zero new backend field. Add backend test `test_stepstate_tts_duration_equals_cena_sum` asserting `step_state.tts.duration == sum(tts.cenas[i].duration)` (within 1ms for ffmpeg concat tolerance).
- **`run_step_srt` duration source** — Replace file-size estimate at `main.py:680-684` with `sum(tts.cenas[i].duration)` when `tts.cenas` is present. Keep file-size heuristic as legacy fallback. 2-line change.
- **Failed cena handling** — New helper emits a zero-duration slot `{start: prev_end, end: prev_end, duration: 0, narracao: ...}` to preserve index alignment with `script.cenas`. Downstream consumers that care about failed cenas read `tts.cenas[i].failed`.
- **Cursor rounding scope** — Apply `round(cursor * 1000) / 1000` at EVERY cumulative step (accumulation AND emission). Belt-and-suspenders to fully eliminate the drift described in ref doc section 9.
- **`concat_clips_with_audio` trimming** — When `scene_timings` is passed (built from `tts.cenas`), it is used as authoritative. Current code at `video_builder.py:850` already prefers `scene_timings` over proportional fallback. **No signature change.** Only the construction site changes.

### Claude's Discretion
- Exact file path for the new helper (`src/reels_pipeline/timing.py` recommended, but can collapse into `transcriber.py` if natural)
- Test file organization (new `tests/test_reels_timing.py` vs extending `tests/test_reels_tts.py`)
- Whether to gate the whole legacy path behind a named const (`_LEGACY_TIMING_ENABLED`) or just the `if not tts.get("cenas"):` check

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/reels_pipeline/tts.py`** — Phase 22 landed `run_step_tts` that populates `step_state.tts.cenas[i].duration` (ffprobe-measured). This is the ground truth we now consume.
- **`src/reels_pipeline/video_builder.py:788`** — `concat_clips_with_audio(clip_paths, audio_path, srt_path, output_path, ..., scene_timings)` already accepts `scene_timings` as a parameter and prefers it over proportional fallback (L850-855). **No signature change needed** — just swap the construction site.
- **`src/reels_pipeline/transcriber.py:300`** — `align_srt_with_script(srt_text, script) -> (aligned_srt, scene_timings)` is the char-offset path. It stays in place as the legacy fallback branch.
- **`src/reels_pipeline/main.py:647`** — Current call site for `align_srt_with_script` inside `run_step_srt`. This is where the new gate lives (`if tts.cenas:` → new path; `else:` → legacy).
- **`src/reels_pipeline/scene_splitter.py`** — `split_long_scenes_in_script` consumes `scene_timings` shape `{duration: ...}`. Preserved shape = no edit here.

### Established Patterns
- **Step state mutation** — Backend routes write to `step_state.<step>.*` inside `src/api/routes/reels.py` (`_execute_step_task`). Editor reads from `step_state.editor.*`. Phase 22 follows this pattern.
- **TDD-first** — Phase 22 landed tests first as `xfail`, then flipped to GREEN as features landed. Same pattern applies here.
- **Parallel bounded async** — Phase 22's `asyncio.Semaphore(3)` pattern is not needed here (no I/O); this is pure data transformation.
- **Commit atomically per task** — Phase 22 committed each task separately with the `feat(23-NN):` / `test(23-NN):` convention.

### Integration Points
- `_execute_step_task.clips` in `src/api/routes/reels.py` — already constructs the editor's `step_state.editor.audioItems`. Add the `total_duration` write here.
- `run_step_srt` in `src/reels_pipeline/main.py:620-686` — gate the new vs legacy SRT alignment branch here.
- `concat_clips_with_audio` in `src/reels_pipeline/video_builder.py:788` — caller passes the newly-built `scene_timings`. No internal changes needed.
- `memelab/src/remotion/ReelComposition.tsx` — reads `audioItems[0].total_duration` for waveform rendering. Bug 7 fix still applies.

</code_context>

<specifics>
## Specific Ideas

- Reference doc section 9 ("Cenas desalinhadas após a terceira") is the canonical bug report for TIMING-05 — the fix is `round(cursor * 1000) / 1000` at every cumulative step.
- Phase 22's pattern of keeping old signatures intact (editor compat preserved via top-level `tts.path` + `tts.duration`) applies here: NO signature changes to `concat_clips_with_audio`, `run_step_srt` externally. Refactor is about data flow, not API surface.
- Biblical reels (tone == "biblical") are the worst offenders for char-offset drift — they are THE use case this phase fixes.
- The `scene_timings` shape returned by the new helper must be 100% byte-equal to what `align_srt_with_script` returns (minus the drift) so downstream consumers (`scene_splitter.split_long_scenes_in_script`, `concat_clips_with_audio`) see no shape change.

</specifics>

<deferred>
## Deferred Ideas

- ElevenLabs integration (user decision — Gemini TTS remains sole provider for v4.0)
- Script Schema v2 migration (Phase 24)
- Ken Burns motion (Phase 26 — depends on `mood` field from Phase 24)
- Removal of `align_srt_with_script` (kept as legacy fallback; can be removed in a future cleanup milestone once all legacy jobs are migrated)
- Frontend-side total_duration recomputation (rejected — backend is the source of truth)

</deferred>
