---
phase: quick-260407-2cj
plan: 01
subsystem: reels-pipeline
tags: [reels, transcription, srt, alignment, editor, bugfix]
dependency-graph:
  requires:
    - "src/reels_pipeline/transcriber.py:_srt_ts_to_seconds (existing helper)"
    - "src/reels_pipeline/transcriber.py:transcribe_to_srt (Gemini chunked output)"
    - "src/api/routes/reels.py:240 (backend writer of step_state.srt.scene_timings)"
  provides:
    - "Real per-cena scene_timings backed by Gemini word-level timestamps"
    - "subtitles_raw.srt safety backup on disk"
    - "Frontend reads scene_timings from canonical step_state.srt key"
  affects:
    - "src/reels_pipeline/video_builder.py:concat_clips_with_audio (now trims clips against real narration spans, not equal time buckets — behavior improves with no code change)"
tech-stack:
  added:
    - "difflib (stdlib) for SequenceMatcher-based text alignment"
  patterns:
    - "Text-similarity span matching with sentence-end snap"
    - "Tuple-return contract enforced via test (guards latent type-hint bug)"
    - "Lazy local import of shutil inside try (mirrors run_step_srt's existing lazy-import pattern)"
key-files:
  created:
    - path: "src/reels_pipeline/test_transcriber_align.py"
      summary: "9 pytest contract tests for align_srt_with_script — raw-SRT preservation, index/narracao fields, monotonic spans, sentence-snap, empty-cenas tuple guard"
  modified:
    - path: "src/reels_pipeline/transcriber.py"
      summary: "Rewrote align_srt_with_script: returns Gemini SRT byte-for-byte + difflib-matched per-cena spans. Added _REELS_ALIGN_SIMILARITY=0.75 constant and `import difflib`."
    - path: "src/reels_pipeline/main.py"
      summary: "run_step_srt now copies subtitles.srt -> subtitles_raw.srt (lazy shutil import) before alignment as a safety net"
    - path: "memelab/src/stores/editor-store.ts"
      summary: "loadFromStepState reads scene_timings from stepState.srt (was stepState.tts — always undefined). Renamed local ttsTimings/ttsTiming -> sceneTimings/sceneTiming."
    - path: "memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx"
      summary: "Stale-check useEffect reads scene_timings from stepState.srt (was stepState.tts). Renamed locals to match."
decisions:
  - "Algorithm locked from approved plan async-painting-reef.md — no redesign during execution"
  - "Single atomic commit for all 5 files — backend key + frontend reader are tightly coupled and would leave system broken if split"
  - "Sentence snap uses threshold - 0.05 tolerance — extends span to next chunk only if similarity stays close, prevents drift on weak matches"
  - "Last cena claims all remaining entries unconditionally — guarantees full audio coverage even when text similarity drops at the tail"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-07"
  tasks_completed: 3
  files_changed: 5
  tests_added: 9
  tests_passing: 9
  commits: 1
---

# Quick Task 260407-2cj: Preserve Gemini Word-Level Timings in SRT Alignment Summary

Reels SRT alignment now keeps Gemini's authoritative chunk-level timestamps and emits real per-cena spans by text-matching narrations against contiguous chunks via difflib, instead of destroying timing data with equal-time bucketing.

## What Changed

Three coupled fixes shipped as one atomic commit:

1. **`align_srt_with_script` rewrite (transcriber.py)** — old code grouped entries into N equal time buckets per cena, replaced bucket text with `cena.narracao`, and emitted bucket-derived `scene_timings`. This destroyed Gemini's tight 4-5 word real-timestamp chunks. New code:
   - Returns input SRT byte-for-byte (chunks remain authoritative subtitles).
   - Walks chunks forward, accumulating into a "claimed_text" buffer per cena.
   - Per cena, claims chunks until `difflib.SequenceMatcher` ratio against normalized `cena.narracao` reaches `_REELS_ALIGN_SIMILARITY = 0.75`.
   - Snaps span boundary forward by one chunk if last claimed chunk doesn't end in `.!?` AND extending stays within `threshold - 0.05` of similarity.
   - Last cena unconditionally claims all remaining chunks (guarantees full audio coverage).
   - Logs warning when a non-final cena's similarity stays below threshold.
   - Emits `scene_timings` with `{index, start, end, duration, narracao}` per cena.
   - Returns proper tuple `(srt_text, [])` on empty-cenas branch (was returning bare `srt_text`, a latent type-hint violation).

2. **Raw SRT backup (main.py)** — `run_step_srt` copies `subtitles.srt` to `subtitles_raw.srt` immediately after `transcribe_to_srt` and before alignment. Lazy `import shutil` inside the try block matches the file's existing lazy-import pattern. The post-alignment `f.write(aligned)` becomes a no-op (aligned == srt_text after the rewrite) but stays as a contract anchor.

3. **Frontend key fix (editor-store.ts + edit/page.tsx)** — both files used to read `scene_timings` from `stepState.tts.scene_timings`, but the backend has always written it under `stepState.srt.scene_timings` (`src/api/routes/reels.py:240`). Result: `ttsTimings` was always `undefined` in production and the editor silently fell back to clip duration. Fixed to read from `stepState.srt`. Local variables renamed `ttsTimings/ttsTiming` -> `sceneTimings/sceneTiming` for consistency.

## TDD Flow

- **RED**: Wrote `test_transcriber_align.py` with 9 contract tests. Ran against the current bucketing implementation — first test (`test_returns_raw_srt_unchanged`) failed immediately with byte-mismatch on the rebuilt SRT.
- **GREEN**: Rewrote `align_srt_with_script`. All 9 tests passed on the first run after implementation.
- **REFACTOR**: Not needed — implementation matched the locked algorithm from the approved plan.

## Verification

| Check | Result |
| --- | --- |
| `pytest src/reels_pipeline/test_transcriber_align.py -x -v` | 9/9 passed |
| Python AST parse on `transcriber.py` and `main.py` | clean |
| Node check: both frontend files contain `stepState.srt`, no `stepState.tts.*scene_timings` | passed |
| `npx tsc --noEmit` on the two modified TS files | zero errors (filtered grep) |
| Integration sanity: `run_step_srt` against `output/reels/reel_034_0406` | passed — `subtitles_raw.srt` created, `raw == aligned`, scene_timings have `index`/`narracao` fields, low-similarity warning fires correctly on legacy data |

## Deviations from Plan

**1. Argument order discovery during integration check** — when running the optional integration sanity check, I initially called `run_step_srt(job_dir, audio_path, script)` matching the plan's verification snippet, but the real signature is `run_step_srt(audio_path, job_dir, script)`. Self-corrected after the first run. The plan's verification snippet has the same arg order swap and would fail as written; not fixing the plan since this is a one-time verification command, not production code. Documented here for the next person who copy-pastes it.

## Deferred Issues

**Pre-existing TypeScript errors in `memelab/`** — `npx tsc --noEmit` reports 7 errors in `RemotionPreview.tsx`, `Scene.tsx`, `ReelComposition.tsx`, `use-audio-waveform.ts`, `use-autosave.ts`. None are in files I modified. Per SCOPE BOUNDARY rule, these are pre-existing and not caused by this task — out of scope. The two files I touched (`editor-store.ts`, `edit/page.tsx`) have zero typecheck errors.

## Known Stubs

None. All wired data flows through real backend keys after this fix.

## Next Manual Verification (optional)

The plan suggests a manual editor reload at `http://localhost:3000/reels/8303e35e26e9411b` to confirm the edit view shows per-cena durations driven by real narration spans. Not executed (no checkpoint required); the unit test contract + integration sanity check already prove the data path. New reels generated after this commit will populate `subtitles_raw.srt` automatically and the editor will pick up real narration durations on first load.

## Self-Check: PASSED

- File `src/reels_pipeline/transcriber.py`: FOUND
- File `src/reels_pipeline/test_transcriber_align.py`: FOUND
- File `src/reels_pipeline/main.py`: FOUND
- File `memelab/src/stores/editor-store.ts`: FOUND
- File `memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx`: FOUND
- Commit `45d04d5`: FOUND in git log
