# Phase 23: Audio-Anchored Timing Propagation — Research

**Researched:** 2026-04-08
**Domain:** Backend data flow / float cursor arithmetic / editor state contract
**Confidence:** HIGH (all findings verified against actual source, not library docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Flow**
- `scene_timings` construction — New helper `build_scene_timings_from_cenas(tts_cenas)` in `src/reels_pipeline/timing.py` is the single source of truth. Reused by clips, srt, and editor paths. Zero duplication.
- Consumer access pattern — Caller reads `step_state.tts.cenas` and passes the result through the existing `scene_timings` parameter on `concat_clips_with_audio` and the srt path. **No downstream signature changes.** This keeps the refactor surgical.
- Legacy jobs (no `tts.cenas`) — Fall back to `align_srt_with_script` char-offset path, gated by `if not tts.get("cenas"):`. New path bypasses legacy entirely for Phase 22+ jobs.
- `scene_timings` shape — Preserved as `{index, start, end, duration, narracao}`. All downstream code works unchanged.

**SRT Strategy**
- SRT source — Keep Gemini raw SRT text unchanged (byte-for-byte). Per-cena `scene_timings` are derived from `tts.cenas[i].duration`, not from char offsets. Gemini word-level timings (preserved in quick-260407-2cj) remain authoritative for subtitle rendering.
- `align_srt_with_script` deprecation — Kept as legacy fallback only. New code path never calls it when `tts.cenas` exists. Not dead-code removed.
- Timestamp math — `start = round(sum(cenas[0..i-1].duration) * 1000) / 1000`, `end = round((start + cenas[i].duration) * 1000) / 1000`. Millisecond precision consistently.
- Success criterion #5 verification — Unit test uses `unittest.mock.patch` on `align_srt_with_script` and asserts `assert_not_called()` when run with a Phase-22-style job (has `tts.cenas`). Grep-based lint is not used — mock-based is more precise.

**Editor + Float Drift**
- `audioItems[0].total_duration` source — Backend writes `sum(tts.cenas[i].duration)` into `step_state.editor.audioItems[0].total_duration` during the clips step (or wherever editor state is assembled). Single source of truth. Frontend does NOT recompute.
- Bug 7 regression lock — New backend test `test_editor_audio_items_total_duration_matches_per_cena_sum` asserts `step_state.editor.audioItems[0].total_duration == sum(tts.cenas[i].duration)` (within 1ms tolerance for float concat).
- Cursor rounding scope — Apply `round(cursor * 1000) / 1000` at EVERY cumulative step (accumulation AND emission). Belt-and-suspenders to fully eliminate the drift described in ref doc section 9.
- `concat_clips_with_audio` trimming — When `scene_timings` is passed (built from `tts.cenas`), it is used as authoritative. Current code at `video_builder.py:850` already prefers `scene_timings` over proportional fallback. **No signature change.** Only the construction site changes.

### Claude's Discretion
- Exact file path for the new helper (`src/reels_pipeline/timing.py` recommended, but can collapse into `transcriber.py` if natural)
- Test file organization (new `tests/test_reels_timing.py` vs extending `tests/test_reels_tts.py`)
- Whether to gate the whole legacy path behind a named const (`_LEGACY_TIMING_ENABLED`) or just the `if not tts.get("cenas"):` check

### Deferred Ideas (OUT OF SCOPE)
- ElevenLabs integration (Gemini TTS remains sole provider for v4.0)
- Script Schema v2 migration (Phase 24)
- Ken Burns motion (Phase 26 — depends on `mood` field from Phase 24)
- Removal of `align_srt_with_script` (kept as legacy fallback)
- Frontend-side total_duration recomputation (rejected — backend is the source of truth)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIMING-01 | `concat_clips_with_audio` consumes `tts.cenas[i].duration` directly as ground truth for trimming Kie.ai clips (eliminates char-offset fallback) | `video_builder.py:850-855` already prefers `scene_timings` over proportional fallback; only the **construction site** (in `main.py::run_step_srt` and `reels.py::_execute_step_task.clips`) needs to change. `_trim_clips_to_durations` at `video_builder.py:493` already consumes `durations` as-is. |
| TIMING-02 | `scene_timings` is built by summing per-cena durations: `start = sum(cenas[0..i-1].duration)`, `end = start + cenas[i].duration` | New helper `build_scene_timings_from_cenas(tts_cenas)` in `src/reels_pipeline/timing.py`. Output shape matches exactly what `align_srt_with_script` returns so `split_long_scenes_in_script` and `concat_clips_with_audio` see no shape change. |
| TIMING-03 | `align_srt_with_script` is replaced by direct construction from `tts.cenas[i].duration` — SRT generated per-cena and offset by cumulative sum (legacy path kept as fallback) | `main.py:647` is the single call site. Gate: `if script and script.get("cenas") and tts_cenas_from_step_state:` → new path; `else:` → existing legacy `align_srt_with_script` branch. Raw Gemini SRT stays byte-for-byte unchanged (it already does after quick-260407-2cj). |
| TIMING-04 | Editor (`step_state.editor.audioItems`) continues to receive `total_duration` correct (sum of per-cena durations), maintaining Bug 7 compat in `ReelComposition.tsx` | **CRITICAL CAVEAT:** Editor today does NOT read `step_state.editor.audioItems[0].total_duration` — it reads `stepState.tts?.duration` directly (`editor-store.ts:197-201`). See "Editor Contract Reality Check" in §2. Backend already writes the correct value to `step_data["duration"]` via ffprobe on `audio.wav` (Phase 22). The spirit of TIMING-04 is already satisfied at the `tts.duration` level. What Phase 23 must additionally do is make `sum(cenas[i].duration)` equal the ffprobe concat (already tested to < 1ms in Phase 22's `test_sum_matches_concat_within_tolerance`). |
| TIMING-05 | Cumulative cursor uses `round(cursor * 1000) / 1000` to eliminate float drift (ref doc §9 — "Cenas desalinhadas após a terceira") | Apply rounding inside `build_scene_timings_from_cenas` at every accumulation (`cursor += dur` → `cursor = round((cursor + dur) * 1000) / 1000`) AND at every emission (`round(start*1000)/1000`, `round(end*1000)/1000`). Also verify `duration` field is re-computed from rounded bounds (`round(end - start, 3)`) not carried as a pre-rounded value. |
</phase_requirements>

## Summary

Phase 23 is a **surgical data-flow refactor**: every downstream timing consumer (clip trimming in `concat_clips_with_audio`, the SRT post-processing in `run_step_srt`, and the editor's `audioItems[0].duration`) must read per-cena durations from `step_state.tts.cenas[i].duration` (Phase 22 ground truth) instead of the char-offset approximation returned by `align_srt_with_script`. There are **no external signature changes** — the `scene_timings` parameter already exists on `concat_clips_with_audio` (`video_builder.py:788-855`) and on the backend's srt-step handler (`reels.py:295-306`). What changes is the **construction site**: a new helper `build_scene_timings_from_cenas(tts_cenas)` becomes the single source of truth, and the call sites swap `align_srt_with_script` → the new helper (gated by `if tts.get("cenas"):`). The legacy char-offset path stays in place for pre-Phase-22 jobs.

The float drift bug (ref doc §9, "Cenas desalinhadas após a terceira") is fixed with `round(cursor * 1000) / 1000` applied at **every** cumulative step — both on accumulation and on emission. The existing `align_srt_with_script` also rounds to 3 decimals (`transcriber.py:439-440`), but it does so AFTER the char-offset computation, so the drift survived in a different form. The new helper must round at the accumulation step, which is the only place where errors can compound across iterations.

**Primary recommendation:** Add `src/reels_pipeline/timing.py` with a single pure function `build_scene_timings_from_cenas(tts_cenas: list[dict]) -> list[dict]`. Gate both call sites on `if tts.get("cenas"):`. Keep `align_srt_with_script` untouched. Mirror Phase 22's xfail-stub → active-GREEN test pattern in a new `tests/test_reels_timing.py` (5–7 tests, one per TIMING-01..05 plus float-drift edge cases).

## 1. Current State Analysis — Consumer Map

Every timing consumer currently sources `scene_timings` from the SRT step's char-offset path. This table enumerates each consumer, its current source, and where it needs to read from after Phase 23.

### Consumer 1 — Clip trimming in `concat_clips_with_audio`

| Property | Current | After Phase 23 |
|----------|---------|----------------|
| File | `src/reels_pipeline/video_builder.py:788-867` | (unchanged) |
| Signature | `concat_clips_with_audio(..., scene_timings: list[dict] \| None = None)` | (unchanged) |
| Consumer code | `scene_durs = [t["duration"] + transition_duration for t in scene_timings]` at L852-854 | (unchanged) |
| Data source | Caller passes `step_state["srt"]["scene_timings"]` from `align_srt_with_script` | Caller passes `build_scene_timings_from_cenas(step_state["tts"]["cenas"])` |
| Call sites | `reels.py:365-376` (clips branch), `reels.py:405-416` (video branch), `reels.py:2008-2020` (retry), `reels.py:2194-2203` (rebuild), `main.py:899` (economic mode inside `run_step_video_kie`), `main.py:1110` (batch mode) | All call sites read from the new helper (single place of change per site). |

**Key insight:** `video_builder.py` line 850 already has the correct preference order:
```python
if scene_timings and len(scene_timings) == n_clips:
    # Use exact per-scene durations from SRT alignment (most accurate)
    scene_durs = [t["duration"] + transition_duration for t in scene_timings]
```
Phase 23 doesn't touch this — it just ensures a correct `scene_timings` reaches this point.

### Consumer 2 — SRT timing post-processing in `run_step_srt`

| Property | Current | After Phase 23 |
|----------|---------|----------------|
| File | `src/reels_pipeline/main.py:567-686` | (signature unchanged) |
| Call | `aligned, scene_timings = align_srt_with_script(srt_text, script)` at L647 | Gated: new path when `tts.cenas` exists |
| Output | Returns `(srt_path, cost_usd, scene_timings, expanded_script)` | (unchanged) |
| Current bug | Char-offset approximation gives ~50-200ms drift on biblical reels (narracao_completa has ~42% preamble/CTA not in per-cena narracao) | Fixed by sourcing directly from ffprobe-measured per-cena durations |

**Concrete gate:**
```python
# main.py run_step_srt, replacing L629-650 block
scene_timings = None
expanded_script = None
if script and script.get("cenas"):
    tts_cenas = (self.config.get("tts_cenas_from_step_state") or [])  # or threaded via arg
    repaired = repair_shattered_script(script)
    if repaired is not script:
        script = repaired
        expanded_script = repaired

    if tts_cenas:
        # NEW PATH (TIMING-02, TIMING-03)
        scene_timings = build_scene_timings_from_cenas(tts_cenas)
        # SRT text stays untouched (Gemini raw is already preserved by
        # quick-260407-2cj + the align_srt_with_script rewrite that
        # returns srt_text verbatim)
    else:
        # LEGACY PATH
        with open(srt_path, "r", encoding="utf-8") as f:
            srt_text = f.read()
        aligned, scene_timings = align_srt_with_script(srt_text, script)
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(aligned)

    # Visual rhythm splitter (unchanged — scene_timings shape is preserved)
    ...
```

**Threading `tts_cenas` into `run_step_srt`:** Two options (Claude's discretion):
1. Read from `step_state` inside the route handler and pass via `config_override["tts_cenas"]` before calling `pipeline.run_step_srt` (clean, no signature change)
2. Add an explicit `tts_cenas: list[dict] | None = None` kwarg to `run_step_srt` (explicit, slightly more intrusive)

**Recommendation:** Option 2 — explicit kwarg. `run_step_srt` is called from `reels.py:298-302` (3 args), `main.py:1273` (batch mode, 3 args). Adding a kwarg is backwards-compatible. Avoiding `config_override` for step-specific data matches Phase 22's D-06 rationale (D-06 used config_override for `cena_indices` which is step-execution, not data; `tts_cenas` is data from the previous step's output).

### Consumer 3 — Editor `audioItems` wire-up

**THIS IS THE ONE THAT NEEDS CAREFUL READING.** The CONTEXT.md says:
> Backend writes `sum(tts.cenas[i].duration)` into `step_state.editor.audioItems[0].total_duration` during the clips step

But the actual frontend reality (verified against `memelab/src/stores/editor-store.ts:115-260`, `edit/page.tsx:85-133`) is:

1. `loadFromStepState` (editor-store.ts:115) is what reads from the step_state JSON on first load.
2. It reads `stepState.tts?.path` (L167) → `audioUrl`
3. It reads `stepState.tts?.duration` (L198) → `realAudioSeconds` → `durationInFrames` on `audioItems[0]`
4. **It does NOT read `stepState.editor.audioItems[0].total_duration`.**
5. `stepState.editor` is the *autosave target* (`reels.py:882-896`), not the initial source. `edit/page.tsx:95-122` only loads from `savedEditor` when it has a non-empty `scenes[]` array AND isn't stale — otherwise it falls through to `loadFromStepState(stepState, jobId)`.

**Interpretation:** The CONTEXT decision's intent is satisfied today at the `step_state.tts.duration` level (written by Phase 22 as `get_video_duration(audio.wav)`, the ffprobe measurement of the concat file). What Phase 23 should **actually** do for TIMING-04:

- **Option A (minimal, consistent with CONTEXT intent):** Add a new field `step_state.tts.cenas_total_duration = round(sum(c["duration"] for c in cenas_meta), 3)` and teach `editor-store.ts` to use it as an additional `isSane` fallback. But this changes frontend code, which CONTEXT says is out of scope.

- **Option B (write to `step_state.editor` as CONTEXT says):** Backend proactively writes a minimal `step_state.editor` skeleton during the clips step, with `audioItems[0].durationInFrames` computed from `sum(cenas.duration) * fps`. Frontend's `edit/page.tsx:116-122` would then pick it up via the `savedEditor` path. But this requires the editor skeleton to include `scenes`, `subtitles`, etc., which makes it a much larger write.

- **Option C (RECOMMENDED — reconcile with existing data flow):** Interpret TIMING-04 as "assert that `sum(tts.cenas[i].duration) ≈ step_state.tts.duration` within tolerance, which is what the editor will read." This requires NO new backend field — the Phase 22 test `test_sum_matches_concat_within_tolerance` already verifies this at <1ms tolerance. Phase 23 adds a **regression lock** test at the route-handler level: after `run_step_tts` runs, assert `abs(sum(cenas[i].duration) - tts.duration) < 0.050`. This is the "single source of truth" the CONTEXT wants, verified programmatically.

**Decision required from planner:** Which option is the actual target. Recommend Option C (matches current architecture, no frontend touches) — surface this in PLAN-CHECK for the user. If Option B, the PLAN has to also specify what minimal `step_state.editor` skeleton looks like and how it reconciles with existing autosave behavior.

### Consumer 4 — `split_long_scenes_in_script` (splitter)

| Property | Current | After Phase 23 |
|----------|---------|----------------|
| File | `src/reels_pipeline/scene_splitter.py:48-72` | (unchanged) |
| Consumes | `scene_timings: list[dict]` with shape `{index, start, end, duration, narracao}` | (unchanged — shape preserved) |
| Integration | Called from `run_step_srt` at `main.py:666-669` when any cena duration > `SCENE_MAX_DURATION` (30s in economic mode, otherwise 6s) | (unchanged) |

**Critical constraint:** The new `build_scene_timings_from_cenas` output must be **byte-identical in shape** to `align_srt_with_script`'s output:
```python
{"index": int, "start": float, "end": float, "duration": float, "narracao": str}
```
Any shape drift breaks the splitter. Shape regression test is mandatory.

### Consumer 5 — `run_step_video_kie` / clips execution

| Property | Current | Phase 23 |
|----------|---------|----------|
| File | `src/reels_pipeline/main.py:771-900` | (unchanged) |
| Consumes | `scene_timings: list[dict] \| None` as kwarg | (unchanged — just receives better data) |
| Pass-through | L899: `concat_clips_with_audio(..., scene_timings=scene_timings)` | (unchanged) |

**No change needed.** It's a passthrough.

### Reconciliation with Phase 22's D-04 (splitter mismatch)

Phase 22's D-04 explicitly deferred to Phase 23: if `run_step_srt` invokes `split_long_scenes_in_script` and expands N cenas into M > N sub-cenas, then `tts.cenas` (still at N) no longer aligns with the expanded `scene_timings` (now at M). This is a real edge case.

**Current behavior (verified):** In economic mode (`self.config.get("economic_mode")`), the effective threshold is 30s (`main.py:660`), which effectively disables the splitter. So for the common path, M == N. For non-economic mode with very long cenas, splitting still happens.

**Phase 23 handling options:**
1. **Don't reconcile** — biblical/economic mode dominates; document the edge case and leave `tts.cenas` at N. Splitter still rewrites `scene_timings` in place for the split sub-cenas, and they get proportional slices of the parent's per-cena duration. Acceptable for v4.0 since splitter is an edge case for non-biblical, non-economic reels.
2. **Reconcile** — after splitter expansion, re-derive `scene_timings` from the pre-split `tts.cenas[i]` durations + splitter's sub-division math. More correct but adds complexity.

**Recommendation:** Option 1. Document the known mismatch in the splitter path in PLAN comments. This was explicitly called out as Phase 23 work in 22-CONTEXT D-04, but that was to reexamine it — reexamining concludes "deferred past v4.0, surface as known limitation." Add a code comment at the splitter call site: `# Note: if splitter expands N cenas to M, sub-cena durations are proportional slices of tts.cenas[i]; full reconciliation deferred.`

## 2. Data Flow Design — Single Source of Truth

### New Helper: `build_scene_timings_from_cenas`

**File:** `src/reels_pipeline/timing.py` (new, ~50 lines)

**Signature:**
```python
def build_scene_timings_from_cenas(
    tts_cenas: list[dict],
) -> list[dict]:
    """Build scene_timings from per-cena ffprobe durations.

    This is the Phase 23 replacement for align_srt_with_script's char-offset
    approximation. The source of truth is tts.cenas[i].duration (measured
    by ffprobe in Phase 22, stored in step_state.tts.cenas[i]).

    Input shape (from step_state.tts.cenas):
        [{"index": int, "narracao": str, "path": str, "duration": float,
          "status": "complete"|"failed", "failed"?: bool}, ...]

    Output shape (matches align_srt_with_script byte-for-byte):
        [{"index": int, "start": float, "end": float, "duration": float,
          "narracao": str}, ...]

    Notes:
        - Failed cenas (cenas[i]["failed"] == True) contribute their stored
          duration even though the audio is a silent placeholder (Phase 22
          concat's current behavior is to skip them). We still emit a timing
          entry so downstream scene_timings[i] lines up with script.cenas[i].
          Open question for planner: how to handle this cleanly. Recommended:
          treat failed cenas as duration=0 in the emitted span but preserve
          the index slot.
        - TIMING-05: cursor is rounded at every accumulation step AND every
          emission to prevent float drift across long scripts.
    """
    scene_timings = []
    cursor = 0.0
    for cena in tts_cenas:
        dur = float(cena.get("duration") or 0.0)
        # Skip / zero-out failed cenas so they don't advance the cursor
        if cena.get("failed"):
            dur = 0.0
        start = round(cursor * 1000) / 1000
        end = round((cursor + dur) * 1000) / 1000
        scene_timings.append({
            "index": int(cena["index"]),
            "start": start,
            "end": end,
            "duration": round(end - start, 3),  # re-derived from rounded bounds
            "narracao": cena.get("narracao", ""),
        })
        cursor = round((cursor + dur) * 1000) / 1000  # TIMING-05 accumulation
    return scene_timings
```

### Data Flow Diagram (before → after)

```
BEFORE (current):
                           ┌──────────────────────────────┐
step_state.tts.cenas[]  →  │ (unused by timing consumers) │
(from Phase 22)            └──────────────────────────────┘

step_state.srt.path     →  align_srt_with_script(srt_text, script)
                                  │
                                  │ char-offset path
                                  │ (~50-200ms drift)
                                  ▼
                              scene_timings
                                  │
                                  ▼
                          step_state.srt.scene_timings
                                  │
                       ┌──────────┼──────────┐
                       ▼          ▼          ▼
                 concat_clips  splitter  editor-store
                 _with_audio               (via SRT)

AFTER (Phase 23):
step_state.tts.cenas[]  ──── build_scene_timings_from_cenas ────┐
(from Phase 22)              (Phase 23 helper)                  │
                                    │                           │
                                    │ ffprobe-measured          │
                                    │ (<1ms drift)              │
                                    ▼                           │
                              scene_timings                     │
                                    │                           │
                         ┌──────────┼──────────┐                │
                         ▼          ▼          ▼                │
                  concat_clips  splitter   step_state           │
                  _with_audio    (if       .srt.scene_timings   │
                                  needed)    (same field)       │
                                                │               │
                                                ▼               │
                                         editor-store           │
                                         reads .scene_timings   │
                                                                │
LEGACY JOBS (no tts.cenas):                                    │
step_state.srt.path ─── align_srt_with_script ── scene_timings  │
(only path)                                                     │
                                                                │
Both paths converge on step_state.srt.scene_timings ────────────┘
```

**Where the gate lives:**
```python
# Inside run_step_srt (src/reels_pipeline/main.py around L647)
if tts_cenas:  # Phase 22+ job
    scene_timings = build_scene_timings_from_cenas(tts_cenas)
    # SRT text already untouched (Gemini raw preserved by quick-260407-2cj)
else:  # Legacy
    aligned, scene_timings = align_srt_with_script(srt_text, script)
```

**Single write site for `step_state.srt.scene_timings`:** `src/api/routes/reels.py:305-306`:
```python
if scene_timings:
    step_data["scene_timings"] = scene_timings
```
This stays unchanged. The field still lives under `step_state.srt.*` to preserve the editor's existing reader at `editor-store.ts:122`.

## 3. Float Drift Analysis — Where Cursor Accumulates Today

Ref doc §9 (`pipeline-historia-narracao-imagem.md:683-693`) identifies:
> | Cenas desalinhadas após a terceira | Cursor acumulando erro de float | Use `Math.round(cursor * 1000) / 1000` |

### Where float accumulation happens in the current codebase

| Location | Accumulation Pattern | Current Rounding | Drift Risk |
|----------|---------------------|------------------|------------|
| `transcriber.py:352-354` | `audio_duration = max(audio_end - audio_start, 0.1)` | None | N/A — single subtraction |
| `transcriber.py:411-416` | `time_center = audio_start + (char_mid / total_chars) * audio_duration` | None | LOW — single mult |
| `transcriber.py:424-430` | `t_start = (anchored_centers[i-1] + anchored_centers[i]) / 2` | Rounded to 3 at L439-440 AFTER computation | MEDIUM — rounding after accumulation hides drift in `anchored_centers` |
| `transcriber.py:439-440` | `t_start = round(t_start, 3); t_end = round(t_end, 3)` | Correct rounding direction | OK for emission, NOT OK for accumulation |
| `main.py:717-721` | `total_duration = sum(c.get("duracao_segundos") for c in cenas)` | None | LOW — `duracao_segundos` is integer |
| `video_builder.py:852-854` | `scene_durs = [t["duration"] + transition_duration ...]` | None (downstream consumer) | LOW — scene_durs is used once, not accumulated |
| `video_builder.py:894` | `durations = [get_video_duration(p) for p in clip_paths]` | None (ffprobe returns already-rounded floats) | LOW — independent measurements |

**The actual drift bug:** When `align_srt_with_script` builds spans via midpoints (L424), the `anchored_centers` list is computed from char ratios, producing floats with 10+ decimal digits. By the time cena 3 is emitted, cena 0's rounding error has compounded through two midpoint computations. The L439-440 rounding fixes emission but not the internal computation — so `scene_timings[i].start` might be 4.4729999999999999 or 4.473 depending on accumulation path, and the rounding to 3 gives 4.473 either way (✓) but the downstream `duration = round(end - start, 3)` computation (L456) can still give 3.0000000001 → rounded → 3.0 (✓). **In the current `align_srt_with_script`, rounding is applied at enough points to paper over most drift.**

**Where the drift still manifests:** The char-offset anchoring itself. Biblical reels have ~42% of narracao_completa outside any cena.narracao (hook, lesson, CTA), so the char-to-time ratio is not monotonic with audio time. The drift isn't float arithmetic — it's the char-offset approximation model. **Phase 23 doesn't need to fix float drift in `align_srt_with_script`** — it sidesteps it by using ffprobe-measured durations.

### Where rounding MUST be added in `build_scene_timings_from_cenas`

```python
cursor = 0.0
for cena in tts_cenas:
    dur = float(cena.get("duration") or 0.0)
    start = round(cursor * 1000) / 1000          # (A) emission boundary
    end = round((cursor + dur) * 1000) / 1000    # (B) emission boundary
    scene_timings.append({
        ...
        "start": start,
        "end": end,
        "duration": round(end - start, 3),       # (C) re-derive from rounded bounds
        ...
    })
    cursor = round((cursor + dur) * 1000) / 1000  # (D) accumulation — CRITICAL
```

- **(A) and (B)** are emission rounding. They ensure the stored values have ≤ 3 decimal places.
- **(C)** re-derives duration from the rounded bounds. Without this, `duration` would be the original unrounded `dur`, which might not equal `end - start`. Downstream consumers like `compute_scene_durations_from_script` (video_builder.py) sometimes use `duration` and sometimes use `end - start`; keeping them strictly equal prevents drift between the two.
- **(D)** is the critical fix. Without rounding cursor at each step, a 20-cena script accumulates ~20 × ε error (where ε ≈ 1e-16 per IEEE 754 addition with mixed-precision floats). In practice this is invisible for ≤10 cenas but can hit ms-range error for 50+ cena biblical reels.

**Test for this:** `test_float_drift_across_many_cenas` — simulate 50 cenas with durations like `[3.333, 3.777, 3.111, ...]` (values chosen so a naive sum has drift), assert that `scene_timings[i].start - scene_timings[i-1].end < 0.001` (monotonic with 1ms tolerance) and `scene_timings[-1].end == round(sum(durations) * 1000) / 1000` (final sum matches rounded total).

## 4. Editor Contract Reality Check (TIMING-04)

**CLAIM** (from CONTEXT.md Decisions):
> Backend writes `sum(tts.cenas[i].duration)` into `step_state.editor.audioItems[0].total_duration` during the clips step. Single source of truth. Frontend does NOT recompute.

**REALITY** (verified against `memelab/src/stores/editor-store.ts:164-217`):
```typescript
const ttsPath = stepState.tts?.path ?? "audio.wav";
const audioItems: EditorAudioItem[] = [];
if (ttsPath) {
  const sceneTotalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  const isSane = (n): n is number => typeof n === "number" && n >= 0.5 && n <= 600;
  const lastTimingEnd = sceneTimings?.[sceneTimings.length - 1].end ?? null;
  const realAudioSeconds =
    (isSane(stepState.tts?.duration) && stepState.tts!.duration) ||
    (isSane(stepState.srt?.duration) && stepState.srt!.duration) ||
    (isSane(lastTimingEnd) && lastTimingEnd) ||
    null;
  const audioFrames = realAudioSeconds
    ? Math.round(realAudioSeconds * fps)
    : sceneTotalFrames;
  audioItems.push({
    id: genId("audio"),
    audioUrl: reelFileUrl(jobId, ttsPath),
    from: 0,
    durationInFrames: audioFrames,
    sourceVersion: realAudioSeconds != null ? String(realAudioSeconds) : undefined,
  });
}
```

### Findings

1. **Frontend does NOT read `stepState.editor.audioItems[0].total_duration`**. Nothing in the frontend codebase reads that field (grep verified: `total_duration` returns zero matches in `memelab/src/stores/`).
2. **Frontend reads `stepState.tts.duration` directly.** This is already populated by Phase 22 with `get_video_duration(audio.wav)` — the ffprobe measurement of the concat file. It's already correct.
3. **`stepState.editor` is the autosave target**, written by `PATCH /reels/{jobId}/editor-state` (`reels.py:882-896`), not by backend code during the clips step. `edit/page.tsx:95-116` only loads from it when a saved state exists and isn't stale; otherwise it falls through to `loadFromStepState`.
4. **Phase 22's Success #5 test already verifies the editor compat contract**: `test_editor_compat_tts_path_and_duration_still_written` (`tests/test_reels_tts.py:366-422`) asserts `step_data["duration"]` is a float in [0.5, 600] and `step_data["path"]` ends with `audio.wav`.

### What TIMING-04 ACTUALLY needs

The spirit of TIMING-04 is: **the editor's audio timeline should match the sum of per-cena durations**. Today:
- `stepState.tts.duration` (what the editor reads) = `get_video_duration(audio.wav)` = ffprobe measurement of concat file
- `sum(stepState.tts.cenas[i].duration)` = sum of individual ffprobe measurements

Phase 22's `test_sum_matches_concat_within_tolerance` already proves these are equal to < 1ms. **TIMING-04 at the data level is ALREADY SATISFIED** by Phase 22.

### Recommended Phase 23 action for TIMING-04

**Add a regression lock test** that binds the contract explicitly at the Phase 23 layer, not at the TTS layer. Name: `test_editor_audio_items_total_duration_matches_per_cena_sum`. Target: assert after `run_step_tts` + route-handler step_data assembly that:
```python
assert abs(step_data["duration"] - sum(c["duration"] for c in step_data["cenas"] if not c.get("failed"))) < 0.050
```
This is a NEW test, not a dupe of Phase 22's test — it asserts the contract from the **route handler's output perspective**, covering the step_state shape the editor actually reads.

**Surface this to user via PLAN-CHECK.** The CONTEXT.md decision's literal wording ("writes to `step_state.editor.audioItems[0].total_duration`") doesn't match the current architecture. The planner needs to confirm: does the user want Option A (new step_state.editor write, requires frontend change), Option B (editor skeleton written by backend, non-trivial), or Option C (regression lock on existing fields, zero frontend change)? My strong recommendation is Option C — it matches what's already working.

## 5. Test Strategy — Mirror Phase 22 TDD Pattern

Phase 22 shipped 11 tests as xfail stubs in Wave 0 (`22-01-T2`), then flipped each to active GREEN as the corresponding implementation wave landed. Phase 23 mirrors this exactly.

### Recommended test file: `tests/test_reels_timing.py` (new)

Separate from `test_reels_tts.py` to keep phases cohesive and allow Phase 23 test commits to be atomic (Phase 22's 22-VALIDATION.md is already frozen and marked `✅ green`).

### Test plan (6 tests + 1 shape regression)

| # | Test | Binds To | Type | Wave | Command |
|---|------|----------|------|------|---------|
| 01 | `test_build_scene_timings_shape_matches_legacy` | TIMING-02 | unit | Wave 1 (helper) | `pytest tests/test_reels_timing.py::test_build_scene_timings_shape_matches_legacy -x` |
| 02 | `test_build_scene_timings_sums_to_total` | TIMING-02 | unit | Wave 1 | `pytest tests/test_reels_timing.py::test_build_scene_timings_sums_to_total -x` |
| 03 | `test_float_drift_across_many_cenas` | TIMING-05 | unit | Wave 1 | `pytest tests/test_reels_timing.py::test_float_drift_across_many_cenas -x` |
| 04 | `test_run_step_srt_uses_new_path_when_tts_cenas_present` | TIMING-03 | integration (mock `align_srt_with_script`) | Wave 2 (integration) | `pytest tests/test_reels_timing.py::test_run_step_srt_uses_new_path_when_tts_cenas_present -x` |
| 05 | `test_run_step_srt_falls_back_to_legacy_without_tts_cenas` | TIMING-03 | integration | Wave 2 | `pytest tests/test_reels_timing.py::test_run_step_srt_falls_back_to_legacy_without_tts_cenas -x` |
| 06 | `test_concat_clips_with_audio_consumes_new_scene_timings` | TIMING-01 | integration (mock `_trim_clips_to_durations` via fake ffmpeg) | Wave 3 (call sites) | `pytest tests/test_reels_timing.py::test_concat_clips_with_audio_consumes_new_scene_timings -x` |
| 07 | `test_editor_audio_items_total_duration_matches_per_cena_sum` | TIMING-04 | integration (simulates route handler step_data assembly) | Wave 3 | `pytest tests/test_reels_timing.py::test_editor_audio_items_total_duration_matches_per_cena_sum -x` |

### Wave → Task mapping (draft for planner)

| Wave | Plan | Owns |
|------|------|------|
| Wave 0 | 23-01 | Create `tests/test_reels_timing.py` with 7 xfail stubs; no production code |
| Wave 1 | 23-02 | Implement `src/reels_pipeline/timing.py::build_scene_timings_from_cenas`; flip tests 01-03 from xfail to GREEN |
| Wave 2 | 23-03 | Gate `run_step_srt` on `tts.cenas` presence; thread `tts_cenas` through route handler; flip tests 04-05 |
| Wave 3 | 23-04 | Update `reels.py` `_execute_step_task` clips/srt/video/retry branches to source `scene_timings` from new helper (or ensure they're read from `step_state.srt.scene_timings` built by Wave 2); flip tests 06-07 |

**Nyquist compliance:** 4 waves × ≥1 test flipped per wave = no 3-consecutive-task gap. ✅

### Key test patterns (mirror Phase 22)

1. **Shape regression**: `test_build_scene_timings_shape_matches_legacy` builds a minimal script, runs it through both `align_srt_with_script` (with a fake SRT) and `build_scene_timings_from_cenas` (with fake `tts.cenas`), and asserts the two outputs have identical key sets per entry. This is the contract lock that prevents `split_long_scenes_in_script` from breaking.

2. **Mock `align_srt_with_script` for fallback assertion**: Success #5 verification (per CONTEXT decisions) uses `unittest.mock.patch("src.reels_pipeline.main.align_srt_with_script")` and asserts `mock.assert_not_called()` when `tts.cenas` is present, and `mock.assert_called_once()` when absent. Mirrors Phase 22's monkeypatch-based testing.

3. **Pure unit tests for the helper**: No async, no ffmpeg, no I/O. `build_scene_timings_from_cenas` is pure data transformation — tests run in <50ms total.

4. **Float drift test uses realistic durations**: Build 50 cenas with durations sampled from a realistic distribution (e.g., `[3.127, 4.891, 2.453, ...]`), verify monotonic and final-sum-matches-rounded-total.

5. **Integration test at route-handler level**: For test 07 (editor audio items), construct a `step_data` dict by calling `run_step_tts` and then manually assembling the same dict the route handler does at `reels.py:277-293`. Assert the sum invariant. No FastAPI test client needed — isolates pipeline contract.

## 6. Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 7.x + pytest-asyncio (`asyncio_mode = "auto"`) |
| Config file | `/Users/luigivivian/meme-lab/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `pytest tests/test_reels_timing.py -x -q` |
| Full suite command | `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` |
| Estimated runtime | <5 seconds (pure unit tests + 2 integration that don't invoke Gemini/ffprobe) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIMING-01 | `concat_clips_with_audio` consumes new `scene_timings` | integration | `pytest tests/test_reels_timing.py::test_concat_clips_with_audio_consumes_new_scene_timings -x` | ❌ Wave 0 |
| TIMING-02 | Scene timings built via sum of per-cena durations | unit (shape + sum) | `pytest tests/test_reels_timing.py::test_build_scene_timings_shape_matches_legacy -x` AND `::test_build_scene_timings_sums_to_total -x` | ❌ Wave 0 |
| TIMING-03 | `align_srt_with_script` bypassed when `tts.cenas` present | integration (mock-based) | `pytest tests/test_reels_timing.py::test_run_step_srt_uses_new_path_when_tts_cenas_present -x` AND `::test_run_step_srt_falls_back_to_legacy_without_tts_cenas -x` | ❌ Wave 0 |
| TIMING-04 | Editor `audioItems[0]` duration matches `sum(tts.cenas.duration)` | integration (step_data assembly) | `pytest tests/test_reels_timing.py::test_editor_audio_items_total_duration_matches_per_cena_sum -x` | ❌ Wave 0 |
| TIMING-05 | No float drift across 50 cenas | unit (pure) | `pytest tests/test_reels_timing.py::test_float_drift_across_many_cenas -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_reels_timing.py -x -q` (<5s)
- **Per wave merge:** `pytest tests/test_reels_timing.py tests/test_reels_tts.py -x -q` (<10s — catches Phase 22 regressions if Phase 23 code unexpectedly touches TTS layer)
- **Phase gate:** `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` full suite GREEN before `/gsd:verify-work` (~2min)

### Wave 0 Gaps

- [ ] `tests/test_reels_timing.py` — covers TIMING-01..05, contains 7 xfail stubs (created by 23-01-T1)
- [ ] `src/reels_pipeline/timing.py` — empty scaffold with `def build_scene_timings_from_cenas(tts_cenas): raise NotImplementedError` (created by 23-01-T2, optional — Wave 1 can create and implement together)
- Framework install — **not needed** (pytest + pytest-asyncio already in use, covered by Phase 22's Wave 0)
- Conftest fixtures — **not needed** (helper is pure; tests for `run_step_srt` integration can reuse Phase 22's `fake_gemini_tts_client` fixture from `tests/conftest.py`)

### Manual-only verifications

| Behavior | Requirement | Why Manual | Instructions | Gate |
|----------|-------------|------------|--------------|------|
| Biblical reel plays in sync end-to-end after TIMING refactor | TIMING-01..05 integration | Perceptual (video playback sync is not unit-testable) | 1. Regenerate an existing biblical reel's `srt` step (or `tts` then `srt`). 2. Open `/reels/{jobId}/edit`. 3. Play timeline end-to-end. 4. Confirm no scene lags behind audio in the final 3-4 cenas. | `/gsd:verify-work` |
| Editor waveform still renders correctly | TIMING-04 regression | Visual check on Remotion preview | 1. Same reel. 2. Confirm waveform length matches timeline. 3. Confirm scene durations on the clips track match the audio beats. | `/gsd:verify-work` |

## 7. Risks and Unknowns

### Risk 1 — Editor contract ambiguity (CONTEXT decision vs. reality)
**Severity:** HIGH — could block planning if not resolved
**Details:** CONTEXT.md specifies writing to `step_state.editor.audioItems[0].total_duration`, but the frontend reads `stepState.tts.duration` directly. See §4. Three options surfaced (A/B/C); recommend Option C.
**Mitigation:** Planner MUST surface this in PLAN-CHECK and ask user to confirm interpretation. Options are enumerated in §4.

### Risk 2 — Splitter / `tts.cenas` mismatch (Phase 22 D-04 deferral)
**Severity:** MEDIUM — known edge case
**Details:** When `split_long_scenes_in_script` expands N cenas into M > N, `tts.cenas` (at N) no longer aligns 1:1 with `scene_timings` (at M). Economic mode effectively disables the splitter, so common path is unaffected. Biblical reels use economic mode.
**Mitigation:** Document as known limitation with a code comment. Defer full reconciliation beyond v4.0. Test: `test_splitter_on_expanded_scene_uses_parent_cena_duration` (optional, for edge case coverage).

### Risk 3 — Multiple `concat_clips_with_audio` call sites
**Severity:** MEDIUM — easy to miss one
**Details:** Verified call sites in `reels.py`: L408 (video branch), L2008-2020 (retry), L2194-2203 (rebuild), plus `main.py:899` (economic mode), `main.py:1110` (batch), `run_step_video_kie` at `main.py:771-900` consumes `scene_timings`. **All call sites must pass the new `scene_timings` (or trust the step_state.srt.scene_timings field).** The cleanest approach: write `scene_timings` to `step_state.srt.scene_timings` once in `run_step_srt`, and all downstream call sites read from there (which they already do — see `reels.py:365, 405, 2010, 2194`).
**Mitigation:** Confirm via grep that every `concat_clips_with_audio` call site either reads `step_state.srt.scene_timings` OR passes `scene_timings=None`. No call site constructs scene_timings locally. Add `test_all_concat_call_sites_read_step_state` as a static-analysis test (grep-based, run in CI).

### Risk 4 — Legacy job load path fails
**Severity:** LOW — covered by legacy fallback
**Details:** Jobs created before Phase 22 don't have `tts.cenas`. The legacy `align_srt_with_script` branch must stay wired. This is already built into the gate design.
**Mitigation:** `test_run_step_srt_falls_back_to_legacy_without_tts_cenas` explicitly tests this. `align_srt_with_script` stays untouched.

### Risk 5 — `failed` cena handling in new helper
**Severity:** LOW — design question
**Details:** If `cenas[3].failed == True`, what duration goes into `scene_timings[3]`? Current Phase 22 `_concat_cena_wavs` skips failed cenas in the concat, so the concat's total duration excludes failed cenas. For `scene_timings`, we need a position for every `script.cenas[i]` even if the cena failed, or downstream code (which indexes by position) breaks.
**Mitigation:** Emit `{duration: 0.0}` for failed cenas and don't advance cursor. Document in helper docstring. Test: `test_failed_cena_gets_zero_duration_slot`.

### Unknown 1 — Does `step_state.srt.duration` need updating?
Currently `run_step_srt` returns an estimated duration computed from file size (`main.py:680-684`: `audio_size / 48000`). The editor's `isSane` fallback reads this at `editor-store.ts:199`. With Phase 22's per-cena accuracy, should `run_step_srt` instead return `sum(tts.cenas[i].duration)`?

**Recommendation:** Yes. When `tts.cenas` is present, set `srt_step_duration = sum(cenas[i].duration)` (already rounded via `build_scene_timings_from_cenas[-1].end`). This is a trivial 2-line change and it makes the editor's SRT fallback path also audio-anchored. Planner should decide whether to scope this into Phase 23 or defer.

### Unknown 2 — Does `step_state.tts.cenas_total_duration` need to be added?
Phase 22 writes `step_state.tts.total_duration_source = "ffprobe_concat"`. Should Phase 23 add `step_state.tts.cenas_total_duration = round(sum(c.duration), 3)` as a belt-and-suspenders check? This field would let the editor (or a hypothetical third consumer) read the per-cena-sum without having to iterate the cenas list.

**Recommendation:** No — adds surface area without a current consumer. Keep the data normalized: per-cena durations are the source, any consumer sums them on-the-fly.

## 8. Code Examples (Verified Patterns)

### Pattern 1 — Gate on `tts.cenas` presence inside `run_step_srt`
```python
# src/reels_pipeline/main.py :: run_step_srt (around L647)
scene_timings = None
expanded_script = None
if script and script.get("cenas"):
    repaired = repair_shattered_script(script)
    if repaired is not script:
        script = repaired
        expanded_script = repaired

    if tts_cenas:  # NEW Phase 23 kwarg
        from src.reels_pipeline.timing import build_scene_timings_from_cenas
        scene_timings = build_scene_timings_from_cenas(tts_cenas)
        # Gemini raw SRT is already untouched (preserved since quick-260407-2cj)
    else:
        # LEGACY path — align_srt_with_script stays as fallback
        with open(srt_path, "r", encoding="utf-8") as f:
            srt_text = f.read()
        aligned, scene_timings = align_srt_with_script(srt_text, script)
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(aligned)
```

### Pattern 2 — Threading `tts_cenas` from route handler
```python
# src/api/routes/reels.py :: _execute_step_task (srt branch, around L295)
elif step_name == "srt":
    audio_path = step_state.get("tts", {}).get("path", "")
    script_json = step_state.get("script", {}).get("json", {})
    tts_cenas = step_state.get("tts", {}).get("cenas") or None  # NEW
    srt_path, duration, scene_timings, expanded_script = await pipeline.run_step_srt(
        audio_path=audio_path,
        job_dir=job_dir,
        script=script_json or None,
        tts_cenas=tts_cenas,  # NEW kwarg
    )
```

### Pattern 3 — Float drift prevention (the critical inner loop)
```python
# src/reels_pipeline/timing.py :: build_scene_timings_from_cenas
def build_scene_timings_from_cenas(tts_cenas: list[dict]) -> list[dict]:
    scene_timings = []
    cursor = 0.0
    for cena in tts_cenas:
        dur = 0.0 if cena.get("failed") else float(cena.get("duration") or 0.0)
        start = round(cursor * 1000) / 1000
        end = round((cursor + dur) * 1000) / 1000
        scene_timings.append({
            "index": int(cena["index"]),
            "start": start,
            "end": end,
            "duration": round(end - start, 3),
            "narracao": cena.get("narracao", ""),
        })
        cursor = end  # 'end' is already rounded — reuse it instead of recomputing
    return scene_timings
```

## 9. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | All | ✓ | (project baseline) | — |
| pytest + pytest-asyncio | Test suite | ✓ | Phase 22 already uses | — |
| ffmpeg/ffprobe | Consumed via `get_video_duration` — but NOT called by `build_scene_timings_from_cenas` itself | ✓ | (Phase 22 dependency) | — |
| google-genai | Not called by Phase 23 code (only by existing TTS layer) | ✓ | (Phase 22 dependency) | — |

**No new dependencies.** Phase 23 is pure data transformation on already-measured values.

## 10. Project Constraints (from CLAUDE.md)

Read `/Users/luigivivian/meme-lab/CLAUDE.md` and `/Users/luigivivian/.claude/CLAUDE.md`:

- **Stack alignment**: Python backend, existing `src/reels_pipeline/` layout. New helper goes into `src/reels_pipeline/timing.py` (follows the `tts.py`, `transcriber.py`, `video_builder.py` sibling pattern).
- **Style**: Concise code, minimal comments. Only comment non-obvious logic (the `round(cursor * 1000) / 1000` line deserves a short comment referencing ref doc §9).
- **No over-engineering**: Helper is 1 function, ~20 lines. No class, no config, no abstract interface. Direct and surgical.
- **Read existing code first**: This research has already read `video_builder.py`, `transcriber.py`, `main.py`, `reels.py`, `editor-store.ts`, `scene_splitter.py`. All listed call sites are verified against actual line numbers.
- **Don't create helpers unnecessarily**: Justified because the logic is reused by 4 consumers (clips, srt, splitter via srt, editor via srt).
- **Design & Build Loop**: For non-trivial code, spawn `code-reviewer` and `qa` subagents. Planner should include this gate in the execution-phase flow.
- **Three similar lines > premature abstraction**: `build_scene_timings_from_cenas` is NOT premature — it's replacing an existing 180-line function (`align_srt_with_script`) with a 20-line equivalent that's used identically by 4 consumers.
- **Only validate at system boundaries**: Helper trusts `tts_cenas` shape (Phase 22 is the producer, fully tested). No defensive validation inside.
- **No backwards-compatibility hacks**: Legacy fallback is a deliberate feature (supporting pre-Phase-22 jobs), not a hack. Document explicitly.
- **Commit atomically per task**: Mirror Phase 22's `feat(23-NN):` / `test(23-NN):` convention.

## Sources

### Primary (HIGH confidence — direct source inspection)
- `src/reels_pipeline/video_builder.py:788-867` — `concat_clips_with_audio` signature and scene_timings consumption
- `src/reels_pipeline/video_builder.py:493-530` — `_trim_clips_to_durations` (consumes durations directly)
- `src/reels_pipeline/transcriber.py:300-483` — `align_srt_with_script` full implementation
- `src/reels_pipeline/main.py:567-686` — `run_step_srt` with current `align_srt_with_script` call at L647
- `src/reels_pipeline/main.py:355-565` — `run_step_tts` (Phase 22 producer)
- `src/reels_pipeline/main.py:771-907` — `run_step_video_kie` scene_timings passthrough
- `src/reels_pipeline/scene_splitter.py:48-72` — `split_long_scenes_in_script` consumer contract
- `src/api/routes/reels.py:218-420` — `_execute_step_task` tts/srt/clips/video branches
- `src/api/routes/reels.py:882-896` — `patch_editor_state` (confirms `step_state.editor` is autosave target, not source)
- `memelab/src/stores/editor-store.ts:115-260` — `loadFromStepState` including the crucial `isSane` fallback chain
- `memelab/src/stores/editor-types.ts:42-55` — `EditorAudioItem` interface (no `total_duration` field)
- `memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx:85-133` — editor page's load logic (savedEditor vs loadFromStepState decision)
- `memelab/src/remotion/ReelComposition.tsx:43-100` — audioItems consumer at render time
- `pipeline-historia-narracao-imagem.md:683-693` — ref doc §9 "Erros Comuns e Soluções" (the canonical float-drift bug)
- `.planning/REQUIREMENTS.md` — TIMING-01..05 definitions
- `.planning/phases/22-per-cena-tts-anchoring/22-VERIFICATION.md` — Phase 22 success criteria and test patterns
- `.planning/phases/22-per-cena-tts-anchoring/22-VALIDATION.md` — Phase 22 Nyquist validation plan (template for Phase 23)
- `tests/test_reels_tts.py:1-422` — Phase 22 test pattern (xfail stubs → GREEN)

### Secondary (MEDIUM — design decisions derived from source + prior phase conclusions)
- Phase 22 CONTEXT D-04 — splitter reconciliation deferred to Phase 23
- Phase 22 CONTEXT D-07 — step_state.tts shape is additive, editor compat is a hard constraint
- `.planning/STATE.md` — "Float cursor drift is already a known bug — Phase 23 must fix with `round(cursor * 1000) / 1000`"

### Tertiary (none)
No WebSearch findings; this is entirely an internal-codebase refactor.

## Metadata

**Confidence breakdown:**
- Consumer map (§1): HIGH — every line number and signature verified in source
- Data flow design (§2): HIGH — pure restatement of locked CONTEXT decisions + code verification
- Float drift analysis (§3): HIGH — walked the actual cursor accumulation points in `align_srt_with_script` and verified rounding discipline
- Editor contract (§4): HIGH — confirmed the CONTEXT decision doesn't match frontend reality; three options enumerated
- Test strategy (§5): HIGH — mirror of Phase 22's verified-passing template
- Validation architecture (§6): HIGH — uses existing pytest infrastructure
- Risks (§7): HIGH for risks 1/3, MEDIUM for 2/4/5 (edge cases)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days — timing layer is stable, no moving library dependencies)
