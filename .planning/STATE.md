---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: — Pipeline Fidelity Refactor
status: Phase complete — ready for verification
stopped_at: Completed 24-04-PLAN.md
last_updated: "2026-04-09T15:09:53.943Z"
last_activity: 2026-04-09
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 13
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Pipeline compoe e publica memes automaticamente — simples, rapido, sem depender de APIs caras de geracao de imagem
**Current focus:** Phase 24 — script-schema-v2

## Current Position

Phase: 24 (script-schema-v2) — EXECUTING
Plan: 4 of 4

## Progress

```
[████░░░░░░░░░░░░░░░░] 1/5 phases
[████████████████████] 5/5 plans (Phase 22)
```

**Phases:**

| # | Phase | Reqs | Status |
|---|-------|------|--------|
| 22 | Per-Cena TTS Anchoring | 6 | Complete (pending verify) |
| 23 | Audio-Anchored Timing Propagation | 5 | Not started |
| 24 | Script Schema v2 | 6 | Not started |
| 25 | Structured Image Generation | 4 | Not started |
| 26 | Mood-Driven Ken Burns | 5 | Not started |

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v4.0)
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans (carried from v3.0 tail):
  | Phase 1001 P04 | 9min | 3 tasks | 4 files |
  | Phase 999.11 P01 | 4min | 2 tasks | 10 files |
  | Phase 999.11 P03 | 6min | 2 tasks | 8 files |
  | Phase 999.11 P02 | 12min | 2 tasks | 7 files |
  | Phase quick-260407-2cj P01 | 5min | 3 tasks | 5 files |

- Trend: v3.0 shipped 2026-04-07

| Phase 22 P01 | 3min | 2 tasks | 2 files |
| Phase 22 P02 | 4min | 2 tasks | 2 files |
| Phase 22 P03 | 9min | 3 tasks | 4 files |
| Phase 22 P04 | 4min | 3 tasks | 2 files |
| Phase 22 P05 | 2min | 1 tasks | 2 files |
| Phase 23 P01 | 3min | 1 tasks | 1 files |
| Phase 23 P02 | 4min | 2 tasks | 2 files |
| Phase 23 P03 | 28min | 3 tasks | 3 files |
| Phase 23 P04 | 8min | 2 tasks | 1 files |
| Phase 24 P01 | 1min | 1 tasks | 1 files |
| Phase 24 P02 | 3min | 2 tasks | 4 files |
| Phase 24 P03 | 3min | 2 tasks | 2 files |
| Phase 24 P04 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

**v4.0 (2026-04-08):**

- Phase 22 (Per-Cena TTS Anchoring) is the architectural foundation — everything else consumes `tts.cenas[i].duration` as ground truth
- Phase 23 directly consumes Phase 22 output (clip trimming, SRT, editor audio items)
- Phase 24 (Script Schema v2) is independent of Phase 22/23 but blocks Phase 25 (needs image_prompt) and Phase 26 (needs mood field)
- Phase 25 depends on Phase 24 (can't use image_prompt without the schema)
- Phase 26 depends on BOTH Phase 22 (real per-cena durations for > 6s gate) and Phase 24 (mood field)
- Fine granularity (5 phases for 26 reqs) mirrors category boundaries without artificial splitting

**v3.0 carry-over:**

- Phase 999.9 added: Kie API credit system with per-model pricing, logs, and balance management
- Phase 1000 added: Character-scoped navigation — sidebar selector scoping all content by selected character
- Phase 1001 added: Biblical reels category — Gemini-generated faithful biblical narratives with AI/manual script options

### Decisions (active — v4.0)

- [v4.0 Roadmap]: Phase 22 ships FIRST because all other phases need real per-cena durations — this is the only arch refactor in the milestone
- [v4.0 Roadmap]: Script Schema v2 (Phase 24) sequenced after TIMING because TTS refactor works on the existing `cena.narracao` field and doesn't need new schema fields — the schema migration blocks IMAGE/MOTION but not TTS/TIMING
- [v4.0 Roadmap]: Ken Burns (Phase 26) is last because it needs BOTH real durations (> 6s rule) AND mood field (preset map)
- [v4.0 Roadmap]: 5 phases map 1:1 to the 5 requirement categories (TTS, TIMING, SCRIPT, IMAGE, MOTION) — the categories themselves are natural delivery boundaries, no artificial splits
- [v4.0 Roadmap]: `narracao_completa` continues to exist (concatenated from per-cena files) so editor waveform UI (Bug 7 fix) stays stable — compat is a hard constraint
- [v4.0 Roadmap]: ElevenLabs integration explicitly deferred (user decision) — Gemini TTS remains sole provider
- [v4.0 Roadmap]: Ads pipeline, meme manual pipeline, editor features, and subtitle style are all out of scope — v4.0 is exclusively reels pipeline fidelity

- [Phase 22-01]: Wave 0 xfail stubs -- all 11 tests created as xfail, later waves flip to active as features land
- [Phase 22-01]: Monkeypatch target: src.llm_client._get_client (source module) per plan spec -- may need adjustment in Wave 1 for from-import binding
- [Phase 22-02]: Biblical clamp at lowest layer (generate_narration entry) before speed default computation -- all callers auto-inherit
- [Phase 22-02]: classify_tts_error dispatches 400/403 as fail (non-retryable), 429/5xx/unknown as retry -- Plan 03 imports this
- [Phase 22-03]: Monkeypatch must also target tts module local binding (src.reels_pipeline.tts._get_client) because from-import creates local name that survives source-module patching
- [Phase 22-03]: Route handler at reels.py:221 left on old run_step_tts signature -- Plan 04 owns that update, interactive TTS step broken until then
- [Phase 22-04]: cena_indices threaded via config_override (no new _execute_step_task signature) -- keeps step-specific params in one place
- [Phase 22-04]: cena_indices=[] normalized to None (regen all) inside tts branch -- avoids surprising no-op
- [Phase 22-04]: validation only at route layer (non-negative ints, 400) -- upper-bound deferred to pipeline since route lacks script context
- [Phase 22-05]: Editor compat regression test built as direct run_step_tts call + manual step_data assembly (no FastAPI test client) -- isolates pipeline contract from DB/HTTP plumbing, runs in <1.1s
- [Phase 22-05]: Manual editor smoke test (load regenerated reel + check waveform) explicitly NOT automated -- documented in 22-VALIDATION.md as a /gsd:verify-work human gate
- [Phase 22-05]: Phase 22 validation suite at 11/11 GREEN -- closure ready for /gsd:verify-work

- [Phase 24-02]: character_card Optional at both Gemini schema and Pydantic level -- no-character jobs (generic, bible) remain valid
- [Phase 24-02]: v2 cena fields required in Gemini response_schema but Optional with defaults in Pydantic -- existing CenaSchema constructors continue working
- [Phase 24-02]: migrate_legacy_roteiro copies legenda_overlay as-is for image_prompt default -- no LLM translation in migration (pure function constraint)
- [Phase 23-01]: Wave 0 xfail stubs -- 7 tests installed at tests/test_reels_timing.py mirroring Phase 22 pattern; later waves grep test names verbatim and flip xfail markers
- [Phase 23-01]: TIMING-04 implemented as regression lock (Option C) -- frontend reads stepState.tts.duration directly, no new backend field needed
- [Phase 23-02]: Dedicated src/reels_pipeline/timing.py module with a single pure helper build_scene_timings_from_cenas -- keeps Phase 23 single-source-of-truth concept isolated, clean imports in Waves 2/3
- [Phase 23-02]: Cursor reuse via `cursor = end` (point D) instead of re-rounding cursor+dur -- end already rounded at point B, so reusing guarantees byte-exact start[i+1]==end[i] with no double-rounding drift
- [Phase 23-02]: Failed cena emits zero-duration slot at prev_end without advancing cursor -- preserves index alignment with script.cenas so splitter and trim loop stay balanced

- [Phase 24-01]: Wave 0 xfail stubs -- all 10 tests created as xfail/strict, later waves flip to active as features land
- [Phase 24-01]: Test naming mirrors requirement IDs (test_01 -> SCRIPT-01, etc.) for traceability

- [Phase 24-04]: Migration applied at both write and load points in reels.py for belt-and-suspenders coverage
- [Phase 24-04]: scene_splitter needs no code changes -- dict(orig_cena) already copies all v2 fields; only clarifying comments added

Decisions from v3.0 are preserved in PROJECT.md Key Decisions table and the v3.0 milestone archive.

### Pending Todos

0 pending todos in `.planning/todos/pending/`.

### Blockers/Concerns (v4.0)

- Per-cena Gemini TTS may hit rate limits on long biblical reels (>10 cenas) — Phase 22 must design backoff + selective retry
- Editor `narracao_completa` waveform compat is a hard constraint — any change to audio shape must pass the regression (Bug 7 fix in `ReelComposition.tsx`)
- Float cursor drift (ref doc section 9) is already a known bug — Phase 23 must fix with `round(cursor * 1000) / 1000`
- Legacy jobs in the DB with pre-v2 roteiros must continue to load — Phase 24 migration layer is mandatory, not optional

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-ie5 | Enhance ads wizard scene step with customizable presets | 2026-03-30 | 9e02cdc | [260330-ie5-...](./quick/260330-ie5-enhance-ads-wizard-scene-step-with-custo/) |
| 260330-tgu | Add Enhance Theme button to reels creation | 2026-03-31 | 073c33c | [260330-tgu-...](./quick/260330-tgu-add-enhance-theme-button-to-reels-creati/) |
| 260402-04t | Add loop option to reels | 2026-04-02 | 2d7d3d6 | [260402-04t-...](./quick/260402-04t-add-loop-option-to-reels-end-phrase-tran/) |
| 260407-2cj | Preserve Gemini word-level timings in SRT alignment | 2026-04-07 | 45d04d5 | [260407-2cj-...](./quick/260407-2cj-preserve-gemini-word-level-timings-in-sr/) |

## Session Continuity

Last activity: 2026-04-09
Last session: 2026-04-09T15:09:53.939Z
Stopped at: Completed 24-04-PLAN.md
Resume file: None
