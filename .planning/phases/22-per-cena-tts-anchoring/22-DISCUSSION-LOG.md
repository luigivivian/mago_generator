# Phase 22: Per-Cena TTS Anchoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 22-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 22-per-cena-tts-anchoring
**Areas discussed:** Concurrency strategy (Area A only — user scoped discussion explicitly)
**Mode:** interactive (default pacing, no --batch, no --analyze, no advisor)

---

## Pre-Discussion: Gray Areas Presented

The orchestrator identified 5 gray areas worth discussing. User chose to deep-dive only Area A; B–E locked as Claude's discretion against codebase patterns and hard constraints.

| Area | Topic | User choice |
|------|-------|-------------|
| A | Per-cena generation concurrency | **Discussed** |
| B | Failure + selective retry semantics | Claude's discretion |
| C | step_state.tts shape + editor compat | Claude's discretion |
| D | Concat method + silence padding | Claude's discretion |
| E | Biblical speaking_rate enforcement layer | Claude's discretion |

---

## Pre-Discussion: Todo Matching

Two todos matched the phase keywords.

| Option | Description | Selected |
|--------|-------------|----------|
| None — keep both as backlog | Folding would expand scope beyond TTS-01..06 | ✓ |
| Fold silence-removal (todo #1) | ffmpeg silenceremove pass per cena before ffprobe | |
| Fold pipeline-skeleton (todo #2) | Editor-first routing, big scope bump | |

**User's choice:** None — both stay in backlog.

---

## Area A: Concurrency Strategy

### Q1 — Scheduling model

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded parallel, Semaphore(3) | ~7s for 20 cenas, safe margin vs Gemini RPM, matches kie_client pattern | ✓ |
| Sequential | Safest, simplest, 40-60s step latency on bible reels | |
| Full parallel (asyncio.gather) | Fastest for short reels but will fail bible reels with RPM cap | |
| Adaptive (parallel ≤6, sequential >6) | Best-of-both heuristic, adds edge case around N=7 | |

**User's choice:** Bounded parallel, `asyncio.Semaphore(3)`.
**Notes:** No additional commentary. Choice aligns with codebase-established pattern.

---

### Q2 — Retry/backoff on per-call 429 or 5xx

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 3x exponential (1s, 2s, 4s), then mark failed | Resilient to transient burst limits, matches image_gen.py pattern | ✓ |
| Retry 5x longer (2s, 5s, 10s, 20s, 40s) | More forgiving, but total worst-case ~77s risks frontend patience | |
| No per-call retry, fail fast | Simpler but bad UX on bible reels | |
| Retry 2x fast (500ms, 1s) | Too few retries for real rate-limit pressure | |

**User's choice:** 3x exponential (1s, 2s, 4s), then mark failed.
**Notes:** Consistent with existing Gemini retry conventions in the codebase.

---

### Q3 — Progress reporting to frontend

| Option | Description | Selected |
|--------|-------------|----------|
| Per-cena status writes (cenas[i].status) | Mirrors on_scene_update from run_step_video_kie; frontend shows "7/20" via SWR polling | ✓ |
| Single step status (current behavior) | Simplest, but stuck spinner for 10s | |
| Progress counter only (3/20) | Lighter but loses failed/success distinction | |

**User's choice:** Per-cena status writes.
**Notes:** Must use `get_session_factory()` + `_scene_lock` pattern to avoid racing the parent transaction.

---

### Q4 — Interaction with existing SRT-step scene splitter

**Context:** `run_step_srt` currently runs a visual-rhythm splitter that can expand `script.cenas` from N entries into M entries (M > N) when individual cena audio chunks exceed ~4s. With Phase 22 generating per-cena TTS at the pre-splitter count, `tts.cenas` can become stale relative to `script.cenas` after the SRT step runs.

| Option | Description | Selected |
|--------|-------------|----------|
| Scope-bounded: N files, defer reconciliation to Phase 23 | Keeps Phase 22 focused; Phase 23 already reworks scene_timings + SRT flow | ✓ |
| Move splitter logic into Phase 22 TTS step | Eliminates mismatch upfront but expands scope to script mutation + LLM regen | |
| Re-generate tts.cenas inside SRT step when splitter fires | Cross-step feedback loop, harder to reason about | |

**User's choice:** Scope-bounded, defer to Phase 23.
**Notes:** Phase 22 must document the mismatch clearly in CONTEXT so Phase 23's planner understands the handoff.

---

## Post-Area Check

**Question:** Explore areas B–E before writing context, or ready now?
**User's choice:** Ready for context — B–E as Claude's discretion.

---

## Claude's Discretion (recorded against codebase/constraint guidance)

- **B (failure semantics):** Mark-and-continue, `status = "complete_with_failures"` when any cena failed, selective retry via existing `/reels/{jobId}/step/tts` endpoint with optional `cena_indices: int[]` param. No new endpoint.
- **C (step_state.tts shape):** Purely additive. `tts.path` and `tts.duration` remain unchanged (editor hard constraint). Add `tts.cenas: [{index, narracao, path, duration, status, failed?}]` and `tts.total_duration_source = "ffprobe_concat"`.
- **C (file layout):** Per-cena files at `{job_dir}/audio/cena_{i:03d}.wav`, concat at `{job_dir}/audio.wav` (editor convention fallback).
- **D (concat):** `ffmpeg -f concat -safe 0 -i list.txt -c copy` — all files are identical 24kHz mono 16-bit PCM WAV, zero reencoding. No silence padding between cenas.
- **E (biblical clamp):** Inside `tts.py :: generate_narration`, first line after arg validation: `if tone == "biblical": speaking_rate = 1.0`. Log at INFO when it fires. Keep `_TONE_STYLE_PROMPTS["biblical"]` text verbatim.

## Deferred Ideas

- ffmpeg silenceremove post-processing → backlog todo kept, revisit post-v4.0
- Editor-first pipeline restructure → unrelated todo, kept in backlog
- Silence padding between cenas → not in v4.0
- Splitter/tts.cenas reconciliation → Phase 23
- Per-cena voice overrides → Phase 999.15 backlog
- ElevenLabs integration → v4.0 exclusion (user decision)
