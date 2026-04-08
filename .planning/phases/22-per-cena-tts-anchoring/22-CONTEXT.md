# Phase 22: Per-Cena TTS Anchoring - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor `run_step_tts` (src/reels_pipeline/main.py:355) and the tts.py surface so a reels job produces **one Gemini TTS file per `script.cenas[i]`**, each measured via ffprobe, with per-cena durations persisted as the authoritative ground truth in `step_state.tts.cenas[i].duration`. `narracao_completa.wav` keeps existing as a concatenated file (editor compat). Biblical tone forces `speaking_rate = 1.0`. A single cena failure does not abort the step.

**In scope:** per-cena generation, ffprobe measurement, bounded-parallel scheduling, failure/retry handling, concat-from-per-cena, biblical speed clamp.

**Out of scope (belongs to later phases):**
- Scene-timings construction from per-cena durations → Phase 23 (TIMING-02)
- SRT generation directly from per-cena files → Phase 23 (TIMING-03)
- Script schema v2 fields (`image_prompt`, `mood`, `transition_in/out`, `character_card`) → Phase 24
- Ken Burns driven by per-cena duration → Phase 26

</domain>

<decisions>
## Implementation Decisions

### Concurrency strategy (Area A — discussed)
- **D-01:** Per-cena Gemini TTS calls scheduled via `asyncio.Semaphore(3)`. Each cena call acquires the semaphore, generates, releases. Balances latency (~7s for 20 cenas) against Gemini RPM risk on biblical reels.
- **D-02:** Per-call retry on 429/5xx: **3 attempts with exponential backoff (1s, 2s, 4s)**. After all retries fail, the cena is marked `cenas[i].failed = true` and the loop continues with the remaining cenas. No whole-step abort on single-cena failure.
- **D-03:** Progress reporting via **per-cena status writes** inside `step_state.tts.cenas[i].status` (`pending` → `generating` → `complete` | `failed`). Frontend SWR (2s polling) surfaces "Generating TTS 7/20". Must use the same `get_session_factory()` + `_scene_lock` pattern from `run_step_video_kie`'s `on_scene_update` (src/api/routes/reels.py:276-298) to avoid racing the parent transaction.
- **D-04:** Phase 22 generates exactly `N = len(script.cenas)` per-cena files at the moment TTS runs. If `run_step_srt` later expands the script via the scene splitter (M > N), `tts.cenas` stays at N. Reconciliation is **explicitly deferred to Phase 23** (which reworks `scene_timings` and the SRT-step flow). Phase 22 must document this mismatch clearly; do not try to solve it here.

### Failure + selective retry semantics (Area B — Claude's discretion, constrained by D-02)
- **D-05:** Step-level status convention: `step_state.tts.status = "complete"` if all cenas succeed, `"complete_with_failures"` if any cenas[i].failed is true (user can still advance but sees a warning), `"failed"` only if the concat itself fails or zero cenas succeeded.
- **D-06:** Selective retry flows through the **existing** `/reels/{jobId}/step/tts` endpoint. Add an optional `cena_indices: int[]` parameter (empty / absent = regen all). When provided, only those indices are regenerated; all others are left intact; `narracao_completa.wav` is re-concatenated after any successful retry. No new endpoint.

### step_state.tts shape & editor compat (Area C — Claude's discretion, hard constraint from 999.13)
- **D-07:** Shape is **purely additive**. Existing readers keep working unchanged:
  - `step_state.tts.path` → still points to `narracao_completa.wav` (the concatenated file) — editor fallback at `memelab/src/stores/editor-store.ts:167` depends on this.
  - `step_state.tts.duration` → still a float, now the sum of per-cena durations measured via ffprobe on the concat file (editor reads at line 198).
  - **Added:** `step_state.tts.cenas: [{index, narracao, path, duration, status, failed?}]` — new authoritative per-cena data.
  - **Added:** `step_state.tts.total_duration_source = "ffprobe_concat"` for Phase 23 to trust-check against.
- **D-08:** Per-cena files live at `{job_dir}/audio/cena_{i:03d}.wav` (3-digit zero-padded for stable sort). Concat output stays at `{job_dir}/audio.wav` to preserve the editor's convention fallback. Create the `audio/` subdirectory on demand.

### Concat strategy (Area D — Claude's discretion)
- **D-09:** Use `ffmpeg -f concat -safe 0 -i list.txt -c copy -y {out}.wav` for the concat step. All per-cena files are identical format (24kHz mono 16-bit PCM WAV from `_wrap_pcm_as_wav` at src/reels_pipeline/tts.py:33), so `-c copy` is zero-reencoding and near-instant. No Python `wave`-module reassembly.
- **D-10:** **No silence padding** between cenas in the concat. Waveform stays dense; Phase 23 SRT math does not have to account for phantom gaps. If deliberate pacing gaps are needed later (UX concern), handle it in a visual phase, not in the audio ground truth.

### Biblical speaking_rate enforcement (Area E — Claude's discretion)
- **D-11:** Clamp at the **lowest layer** — inside `src/reels_pipeline/tts.py :: generate_narration`. First line after arg validation: `if tone == "biblical": speaking_rate = 1.0` (overrides any caller-supplied `speed`). This guarantees the contradiction between the existing `_TONE_STYLE_PROMPTS["biblical"]` "Speak slowly at key moments, pause between sentences" and the `1.35` default is eliminated regardless of how the function is called.
- **D-12:** Log the override at INFO level when it fires (`logger.info("Biblical tone: forcing speaking_rate=1.0 (was %s)", speed)`) so production traces can verify it. Keep the tone style prompt text as-is.

### Claude's Discretion
- Exact naming of the `cenas[i].status` enum values (`pending`/`generating`/`complete`/`failed` is the obvious canonical set; name choice is not a user concern).
- Whether `run_step_tts`'s signature becomes `(script, job_dir) -> (concat_path, total_duration, cost_usd, cenas_meta)` or stays `(narration_text, job_dir)` with script passed via `self.config`. Pick the cleanest signature that keeps `src/api/routes/reels.py:218` readable.
- Unit-test sizing for the retry/semaphore loop — recommended to ship with tests, but exact count is a plan-phase decision.
- Whether `flag_modified` commits are per-cena or batched in pairs (latency optimization).

### Folded Todos
None. Both matched todos explicitly kept in backlog by user decision — see Deferred Ideas section.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio-as-anchor principle (the whole point of v4.0)
- `pipeline-historia-narracao-imagem.md` §1 — "O áudio é sempre a âncora. Tudo se alinha a ele" — the architectural principle this phase delivers on
- `pipeline-historia-narracao-imagem.md` §4.3 — Expected per-scene TTS output structure (`audio_file`, `duration_s`, optional `word_timestamps`)
- `pipeline-historia-narracao-imagem.md` §5.1-5.2 — Timestamp-First principle and audio-duration measurement pattern
- `pipeline-historia-narracao-imagem.md` §9 — Common errors table; "Duração muito curta/longa → Meça sempre o arquivo gerado, nunca estime" (directly mandates ffprobe measurement over estimation)

### Phase requirements & roadmap
- `.planning/REQUIREMENTS.md` TTS-01..TTS-06 — the six requirements this phase must satisfy
- `.planning/ROADMAP.md` Phase 22 — goal statement and 5 success criteria

### Prior phase decisions (hard constraints)
- `.planning/phases/999.13-editor-ancoras-audio-legenda-cenas/999.13-CONTEXT.md` D-01..D-09 — editor timing model, `scene_timings` authority (Phase 23 rework target), `tts_speed` already plumbed through `ReelsConfigRequest`, editor's `narracao_completa.wav` waveform compat as hard constraint (Bug 7 fix in `ReelComposition.tsx`)

### Editor compat boundary
- `memelab/src/stores/editor-store.ts:118-210` — `loadFromStepState` reader; lines 167 (`tts.path`) and 198 (`tts.duration`) are the exact contract that must stay additive

### Established per-cena progress pattern
- `src/api/routes/reels.py:276-298` — `_scene_update` + `on_scene_update` pattern from `run_step_video_kie`. Phase 22 reuses this shape for per-cena TTS status writes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/reels_pipeline/tts.py :: generate_narration()`** — single-call Gemini TTS function. Phase 22 wraps this in a per-cena loop + applies the biblical speed clamp inside it (D-11). No need to rewrite the Gemini API call machinery.
- **`src/reels_pipeline/video_builder.py:293 :: get_video_duration()`** — existing ffprobe helper. Works on any media file. Reuse directly for WAV duration measurement.
- **`src/api/routes/reels.py:276-298 :: _scene_update / on_scene_update`** — per-item async commit pattern using independent `get_session_factory()` sessions. Copy this shape for per-cena TTS progress writes.
- **`src/reels_pipeline/tts.py :: _wrap_pcm_as_wav()`** — PCM → WAV wrapping. Each per-cena call gets its own WAV; all identical format so ffmpeg `-c copy` concat works.

### Established Patterns
- `step_state.<step>` additive writes guarded by `flag_modified(j, "step_state")` — mandatory for JSON column mutation detection in SQLAlchemy
- Bounded parallelism via `asyncio.Semaphore` already used elsewhere in the codebase
- Independent `get_session_factory()` sessions for mid-step progress commits (avoids racing the parent transaction)
- Step state writers always update `status` last so polling frontends see a consistent read

### Integration Points
- **`src/reels_pipeline/main.py:355 :: run_step_tts`** — the method signature changes. Currently `(narration_text: str, job_dir: str) -> tuple[str, float]`. Phase 22 likely switches to taking `script` (or keeping it on `self`) so it can iterate cenas and write per-cena state.
- **`src/api/routes/reels.py:218-228`** — tts step handler. Currently pulls `narracao_completa` from script_json and calls `run_step_tts(narration_text, job_dir)`. Phase 22 updates this call site to pass the script and propagate per-cena progress. **Top-level writes to `step_data["path"]` and `step_data["duration"]` must remain** (D-07).
- **`src/reels_pipeline/main.py:1083`** — batch-mode caller in the non-interactive pipeline. Must also be updated to the new signature; keep it in sync.
- **`memelab/src/stores/editor-store.ts:118-210`** — do not touch. Smoke-test after Phase 22: load an existing reel in the editor, verify waveform + scene durations render identically.

</code_context>

<specifics>
## Specific Ideas

- The user flagged rate limits as a real concern for bible reels (>10 cenas) in STATE.md blockers — drove the `Semaphore(3) + 3x backoff` choice in D-01/D-02.
- Editor Bug 7 fix in `ReelComposition.tsx` (999.13) is the reason `narracao_completa.wav` stays non-negotiable. Any change to the audio track shape would re-open that bug.
- The existing `_TONE_STYLE_PROMPTS["biblical"]` prompt ("Speak slowly at key moments, pause between sentences") is kept verbatim — only the `speaking_rate` default is overridden. TTS-05 is about removing the contradiction between prompt and rate, not about rewriting the style prompt.
- "Mirror `on_scene_update` from `run_step_video_kie`" is not just a stylistic preference — it's the only pattern in this codebase known to safely commit progress during a long-running step without corrupting the parent transaction.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded — user decision)
- **`.planning/todos/pending/2026-04-07-tts-narracao-mais-rapida-e-fluida.md`** — ffmpeg `silenceremove` post-processing pass. Out of scope: it's an audio shape optimization orthogonal to per-cena anchoring. Revisit after v4.0 if bible reels still feel paced wrong. Important: if this lands later, it must run on per-cena files before ffprobe measurement, not on the concatenated file, to keep durations truthful.
- **`.planning/todos/pending/2026-04-06-refatorar-pipeline-para-gerar-esqueleto-do-editor-antes-do-video-final.md`** — pipeline routing restructure (editor opens before video render). Unrelated to TTS anchoring; belongs in its own phase.

### Implementation-level deferrals
- **Silence padding between cenas** — D-10 says none. If a UX phase later wants breathing room between cenas, it's a visual/audio authoring feature, not a ground-truth change.
- **Splitter / tts.cenas reconciliation when SRT expands cenas** — D-04 explicitly defers this to Phase 23, which reworks `scene_timings` and the SRT flow. Phase 22 leaves `tts.cenas` at the pre-splitter count.
- **Per-cena voice override** (different voice per cena, not just different speed) — already captured in Phase 999.15 backlog as part of the editor write-back story.
- **ElevenLabs integration** — v4.0 scope exclusion. Gemini TTS remains the sole provider.

</deferred>

---

*Phase: 22-per-cena-tts-anchoring*
*Context gathered: 2026-04-08*
