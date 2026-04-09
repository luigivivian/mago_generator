# Phase 1: Per-scene config write-back to backend - Research

**Researched:** 2026-04-09
**Domain:** Editor state persistence / pipeline regeneration / write-back architecture
**Confidence:** HIGH — all findings from direct codebase inspection, zero external search required

## Summary

The editor already has a partial write-back system: `useAutosave` debounces 2s then calls `PATCH /reels/{jobId}/editor-state`, which saves the full `EditorPersistState` (scenes/subtitles/transitions/audioItems) into `step_state.editor`. On reload, the editor page reads `stepState.editor` and restores the visual timeline from it.

The problem is in **what is and isn't in `EditorPersistState`**. The autosave captures `voiceConfig.voice`, `voiceConfig.speed`, `durationInFrames`, `trimFrom`, and `transition` — they all live on `EditorScene`. But when `regenerateStep("tts")` fires, the backend at line 1272 does `step_state.pop("editor", None)`, wiping all editor state. Even if it didn't wipe it, `run_step_tts()` reads voice/speed exclusively from `config_override` (which comes from `ReelsConfig`), never from `step_state.editor`. The TTS step also reads `script.cenas[i].narracao` for the text — it does not consult any per-scene voice/speed stored in the editor.

The clips step (`run_step_video_kie`) reads `clips.scenes[i].duration` from step_state for clip duration, but again this is set by the pipeline, not by editor edits. `trimFrom` and `freeze` are editor-only concepts — they have no backend representation in `script.cenas` or `clips.scenes`.

The fix requires three things: (1) a `step_state.editor_config` bucket (or augmenting `script.cenas[i]`) to hold per-scene voice/speed/trim/freeze overrides persistently; (2) `regenerateStep()` must NOT wipe this bucket; (3) the TTS and clips execution path must read per-scene overrides from this bucket and apply them.

**Primary recommendation:** Add `step_state.editor_config.cenas[i]` as the write-back bucket for per-scene editor overrides. The existing `patchEditorState` endpoint can be extended (or a new `PATCH /reels/{jobId}/scene-config/{index}` added) to write per-scene data. `run_step_tts` must check `config_override.per_cena_config[i]` for voice/speed before falling back to the global config.

## Standard Stack

### Core (all already present — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | existing | Frontend state store | Already the editor state manager |
| FastAPI | existing | Backend API routing | Existing pattern for all editor endpoints |
| SQLAlchemy async | existing | ORM for step_state persistence | All step_state writes use this pattern |
| SWR | existing | Frontend data fetching + revalidation | useStepState hook already uses it |

No new libraries required. This is a data-plumbing phase entirely within existing patterns.

## Architecture Patterns

### Current State (the gap)

```
User edits voice/speed in PropertiesPanel
        ↓
useEditorStore.setState() — store updated in memory
        ↓
useAutosave fires 2s later
        ↓
PATCH /reels/{jobId}/editor-state → step_state.editor.scenes[i].voiceConfig
        ↓ (saved but ignored by pipeline)

User clicks "Regenerar Narracao"
        ↓
regenerateStep(jobId, "tts")
        ↓
backend: step_state.pop("editor", None)   ← WIPE: all voice/speed lost
        ↓
_execute_step_task → run_step_tts(script, job_dir)
        ↓
generate_narration(voice=self.config.get("tts_voice"))  ← reads global config only
```

### Target Architecture

```
User edits voice/speed in PropertiesPanel
        ↓
useEditorStore.setState() — store updated in memory
        ↓
Immediate PATCH /reels/{jobId}/scene-config  (or augmented editor-state endpoint)
writes to step_state.editor_config.cenas[i] = {voice, speed, trim_from, freeze_frames, duration_override}
        ↓
useAutosave continues to save full editor state (scenes/subtitles/etc.) — unchanged
        ↓

User clicks "Regenerar Narracao"
        ↓
regenerateStep(jobId, "tts")
        ↓
backend: step_state.pop("editor", None)  — still wipes visual timeline (correct)
       but does NOT touch step_state.editor_config  ← NEW: preserved
        ↓
_execute_step_task reads per_cena_configs from step_state.editor_config.cenas
        ↓
run_step_tts calls generate_narration(
    voice=per_cena_config.get("voice") or self.config.get("tts_voice"),
    speed=per_cena_config.get("speed") or self.config.get("tts_speed"),
)
        ↓
clips step reads per_cena_config.get("duration_override") to set clip duration
```

### Key Architectural Insight: Two Different Buckets

`step_state.editor` is the **visual timeline state** (scene ordering, subtitle positions, audio block offsets, undo history-compatible shape). It is intentionally wiped on TTS/SRT/script regen because the audio changes and the visual layout becomes stale.

`step_state.editor_config` (to be created) is the **intent/preference layer** (voice, speed, per-scene trim, freeze). It must survive regeneration because it represents the user's desired configuration, not the layout state derived from a particular audio run.

This is the central architectural decision the planner must make: whether to:
- **Option A**: Add `step_state.editor_config` as a separate key (cleanest separation)
- **Option B**: Store per-scene config inside `script.cenas[i]` (closest to source-of-truth)
- **Option C**: Read per-scene config from `step_state.editor.scenes[i]` without wiping it on regen (simplest but conflates layout state with config intent)

Option A is recommended because it preserves the current "wipe editor on regen" semantics (which are correct for the layout) while adding a stable config layer.

### Recommended Write-Back Bucket Shape

```python
# step_state.editor_config (new key, never wiped by regenerate_step)
{
  "cenas": {
    "0": {
      "voice": "Puck",          # overrides config.tts_voice for this cena
      "speed": 1.2,             # overrides config.tts_speed for this cena
      "trim_from": 15,          # frame offset for left-trim in editor
      "freeze_frames": 0,       # freeze frame count
      "duration_override": 90   # durationInFrames user pinned for this scene
    },
    "1": { ... }
  }
}
```

Keys are cena index as string (JSON dict key). Only cenas with user overrides have entries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-scene debounce | Custom timer per scene | One debounced patch for the full scene-config map | Multiple inflight patches race; one PATCH with full map is atomic |
| Per-scene voice API | New endpoint per property | Single `PATCH /scene-config` that accepts the full per-scene map | Minimize round-trips; same pattern as existing editor-state endpoint |
| Config migration | Custom converter | Extend existing `migrate_legacy_roteiro` for legacy jobs lacking `editor_config` | Migration already handles schema evolution |
| Backend validation | New Pydantic model | Extend existing `EditorStatePayload` or add parallel `EditorConfigPayload(BaseModel)` | Pydantic already validates all editor payloads |

## Common Pitfalls

### Pitfall 1: Wiping editor_config during regenerate
**What goes wrong:** Developer adds the new bucket but forgets it must be excluded from the pop at reels.py:1272.
**Why it happens:** The wipe line is `step_state.pop("editor", None)` — a new `editor_config` key won't be touched, but only if it's a separate key. If someone merges it into `editor`, it gets wiped.
**How to avoid:** Keep `editor_config` as a completely separate top-level key in `step_state`. The pop is key-specific.
**Warning signs:** After a regen, the PropertiesPanel reverts voice/speed to global defaults.

### Pitfall 2: Index drift after cena splits
**What goes wrong:** The visual splitter in `run_step_srt` can expand one long cena into two sub-cenas. After this, `editor_config.cenas["2"]` may now refer to a different cena than originally.
**Why it happens:** The splitter modifies `script.cenas` list in-place and saves to DB. Index `i` before split != index `i` after.
**How to avoid:** Store the override keyed by the original cena index at save time. Document that after a SRT regen (which may trigger splitting), the editor-config is advisory, not authoritative. OR: store overrides keyed by cena narracao hash instead of index. For Phase 1, index-keying is acceptable — flag as known limitation.
**Warning signs:** Voice sounds different on specific cenas after a SRT regen even when editor_config was set.

### Pitfall 3: PropertiesPanel warning vs. actual write-back
**What goes wrong:** The current PropertiesPanel contains a yellow warning that says voice/speed are "apenas visualizacao" (display only). If the phase removes this warning but doesn't actually wire the write-back completely, users think it works but it doesn't.
**Why it happens:** The warning text was added deliberately to set expectations. Removing it is part of the phase deliverable, but only valid once the full pipeline (frontend → editor_config → run_step_tts) is wired.
**How to avoid:** Only remove the warning text in the same task that validates end-to-end: set a per-scene voice, regenerate TTS, confirm the per-scene WAV uses that voice.
**Warning signs:** Warning removed but `generate_narration` still receives `voice=None` for the cena.

### Pitfall 4: Autosave vs. immediate write for config
**What goes wrong:** Using the existing 2s autosave debounce for per-scene config means a regen triggered within 2s of changing voice/speed will use the old voice.
**Why it happens:** Autosave fires after 2s; `handleRegenNarration` fires immediately on button click.
**How to avoid:** Write `editor_config` synchronously (or with a very short debounce, 200ms) on change, separate from the 2s visual timeline autosave. Alternative: write on blur of the voice select. Simplest: write synchronously in `handleUpdateVoice`/`handleUpdateSpeed` in addition to the store mutation.
**Warning signs:** User changes voice, immediately clicks regenerate, resulting audio uses old voice.

### Pitfall 5: loadFromStepState ignores editor_config
**What goes wrong:** When the editor reloads from step_state (after regen), `loadFromStepState` rebuilds `EditorScene.voiceConfig` using `DEFAULT_VOICE_CONFIG` (hardcoded Puck/1.1). The per-scene editor_config is never read back into the store.
**Why it happens:** `loadFromStepState` only looks at `stepState.clips.scenes` and `stepState.tts`, neither of which carries per-scene voice/speed.
**How to avoid:** In `loadFromStepState` (or the editor page's useEffect), read `stepState.editor_config.cenas[i]` and merge into each `EditorScene.voiceConfig` before calling `set({scenes})`.
**Warning signs:** After a regen, the PropertiesPanel shows the default voice instead of the previously configured one.

## Code Examples

Verified patterns from direct codebase inspection:

### How the autosave currently writes to the backend

```typescript
// memelab/src/hooks/use-autosave.ts
await patchEditorState(jobId, {
  scenes: scenes as unknown as Record<string, unknown>[],
  subtitles: subtitles as unknown as Record<string, unknown>[],
  transitions: transitions as unknown as Record<string, unknown>[],
  audioItems: audioItems as unknown as Record<string, unknown>[],
});
// → PATCH /reels/{jobId}/editor-state
```

### Backend writes to step_state.editor

```python
# src/api/routes/reels.py:895-909
@router.patch("/{job_id}/editor-state", ...)
async def patch_editor_state(job_id, payload, ...):
    step_state["editor"] = payload.model_dump()  # overwrites whole editor key
    job.step_state = step_state
    flag_modified(job, "step_state")
    await db.commit()
```

### The wipe that kills editor state on regen

```python
# src/api/routes/reels.py:1271-1273
if step_name in ("tts", "srt", "script"):
    step_state.pop("editor", None)  # wiped here — step_state.editor_config must NOT be here
```

### How run_step_tts reads voice/speed (must be extended)

```python
# src/reels_pipeline/main.py:484-488
await generate_narration(
    text=cena_narracao,
    output_path=cena_path,
    voice=self.config.get("tts_voice"),      # global only
    provider=self.config.get("tts_provider"),
    speed=self.config.get("tts_speed"),      # global only
    tone=tone,
)
# Must become:
per_cena = per_cena_configs.get(str(i), {})
await generate_narration(
    voice=per_cena.get("voice") or self.config.get("tts_voice"),
    speed=per_cena.get("speed") or self.config.get("tts_speed"),
    ...
)
```

### How regenerate_step builds config_override (where per_cena_configs must enter)

```python
# src/api/routes/reels.py:1280-1310 (regenerate_step)
config_override = {}
if job.config_id:
    # reads from ReelsConfig: tts_voice, tts_speed, etc.
    config_override = { "tts_voice": ..., "tts_speed": ... }
# Must also add:
editor_config = step_state.get("editor_config", {})
if editor_config.get("cenas"):
    config_override["per_cena_configs"] = editor_config["cenas"]
```

### PropertiesPanel handleUpdateVoice (currently store-only, must also write to backend)

```typescript
// memelab/src/components/editor/PropertiesPanel.tsx:79-85
const handleUpdateVoice = (voice: string) => {
  useEditorStore.setState((state) => ({
    scenes: state.scenes.map((s) =>
      s.id === scene.id ? { ...s, voiceConfig: { ...s.voiceConfig, voice } } : s
    ),
  }));
  // MISSING: immediate write to step_state.editor_config
};
```

### Where editor_config must be read back on load

```typescript
// memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx:84-133 (useEffect)
// After store.loadFromStepState(stepState, jobId):
// Must also apply stepState.editor_config?.cenas overrides to scene.voiceConfig
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single narracao_completa TTS | Per-cena TTS (Phase 22) | 2026-04-09 | Per-cena audio now individually measurable — enables per-cena voice overrides |
| Global voice/speed only | Same (not changed yet) | Phase 1 target | Per-cena config becomes feasible only now that TTS is per-cena |
| editor state wiped on regen | Same (intentional) | Unchanged | The wipe is correct for layout state; editor_config is the new stable layer |

## Runtime State Inventory

> Not a rename/refactor phase. Omit.

## Environment Availability

> Phase is code/config-only changes. No external dependencies beyond the existing running stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python/FastAPI backend | API routes | ✓ | Python 3.14 | — |
| Next.js 15 frontend | PropertiesPanel | ✓ | 15.x | — |
| pytest (backend) | Backend tests | ✓ | existing | — |
| vitest (frontend) | Frontend tests | ✓ | existing | — |

## Validation Architecture

> nyquist_validation: true — section required.

### Test Framework

**Backend:**
| Property | Value |
|----------|-------|
| Framework | pytest + asyncio |
| Config file | pyproject.toml `[tool.pytest.ini_options]` |
| Quick run command | `pytest tests/test_reels_tts.py -x -q` |
| Full suite command | `pytest tests/ -x -q` |

**Frontend:**
| Property | Value |
|----------|-------|
| Framework | vitest + jsdom |
| Config file | memelab/vitest.config.ts |
| Quick run command | `cd memelab && npx vitest run src/__tests__/editor-store.test.ts` |
| Full suite command | `cd memelab && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TBD-01 | `handleUpdateVoice` writes to `step_state.editor_config` within 500ms | unit (frontend) | `cd memelab && npx vitest run src/__tests__/editor-store.test.ts` | ❌ Wave 0 |
| TBD-02 | `regenerateStep("tts")` does NOT pop `editor_config` | unit (backend) | `pytest tests/test_reels_tts.py -x -q` | ❌ Wave 0 |
| TBD-03 | `run_step_tts` passes per-cena voice from `editor_config.cenas[i]` to `generate_narration` | unit (backend) | `pytest tests/test_reels_tts.py::test_per_cena_voice_override -x` | ❌ Wave 0 |
| TBD-04 | `loadFromStepState` merges `editor_config.cenas[i]` back into `EditorScene.voiceConfig` | unit (frontend) | `cd memelab && npx vitest run src/__tests__/editor-store.test.ts` | ❌ Wave 0 |
| TBD-05 | End-to-end: set per-scene voice → regen TTS → per-cena WAV uses correct voice | integration (backend) | `pytest tests/test_reels_tts.py::test_per_cena_voice_e2e -x` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `tests/test_per_scene_config.py` — covers TBD-02, TBD-03, TBD-05
- [ ] `memelab/src/__tests__/editor-config-writeback.test.ts` — covers TBD-01, TBD-04
- [ ] No framework changes needed — both test stacks exist

## Open Questions

1. **Scope: voice+speed only, or also trim/freeze/duration?**
   - What we know: `trimFrom` and `freeze_frames` are editor-side adjustments to an existing clip file, not pipeline inputs. They affect how Remotion renders the clip locally, not what the backend generates.
   - What's unclear: should they survive regen too? If the clip itself changes on a TTS regen (they don't — clips are separate step), trimFrom values remain valid. They're already persisted in `step_state.editor.scenes[i].trimFrom` — they just get wiped when `editor` is wiped.
   - Recommendation: include trimFrom and freeze_frames in `editor_config` too, so they survive TTS/SRT regen. They are user intent that should outlive regeneration.

2. **Endpoint design: one new endpoint or extend existing?**
   - What we know: `PATCH /reels/{jobId}/editor-state` currently saves the full visual timeline. Adding per-scene config to this same payload would mix concerns again.
   - What's unclear: user preference between one-endpoint and two-endpoint design.
   - Recommendation: one new `PATCH /reels/{jobId}/scene-config` endpoint with payload `{ cenas: { [index: string]: SceneConfigOverride } }`. Keeps visual state and config state separate at the API level.

3. **Should duration_override also flow to clips step?**
   - What we know: `clips.scenes[i].duration` is set by the pipeline and read by the editor. If the user changes `durationInFrames` in the PropertiesPanel, it only changes the Remotion preview duration, not the actual clip length.
   - What's unclear: the phase goal says "duration must flow back". For TTS this means voice/speed determines audio duration. For clips, "duration" in the editor is the display length — the clip file itself is what it is.
   - Recommendation: `duration_override` in `editor_config` for use when assembling the final video (tells ffmpeg how long to use from each clip), but NOT fed back to the clips generation step (which would require re-rendering all Kie clips — expensive and out of scope).

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `/Users/luigivivian/meme-lab/` — all files read
  - `memelab/src/stores/editor-store.ts` — loadFromStepState, all store actions
  - `memelab/src/stores/editor-types.ts` — EditorScene shape, voiceConfig
  - `memelab/src/components/editor/PropertiesPanel.tsx` — handleUpdateVoice, handleUpdateSpeed, handleRegenNarration
  - `memelab/src/hooks/use-autosave.ts` — patchEditorState call, 2s debounce
  - `memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx` — editor load flow, editor_config read point
  - `memelab/src/lib/api.ts` — regenerateStep, patchEditorState, StepState, EditorPersistState types
  - `src/api/routes/reels.py` — patch_editor_state, regenerate_step, _execute_step_task, the wipe at line 1272
  - `src/reels_pipeline/main.py` — ReelsPipeline.__init__, run_step_tts, config_override flow
  - `src/reels_pipeline/tts.py` — generate_narration, voice/speed parameters
  - `src/reels_pipeline/models.py` — CenaSchema, EditorStatePayload, ReelsConfigRequest
  - `src/api/models.py` — EditorStatePayload backend shape

## Metadata

**Confidence breakdown:**
- Current gap analysis: HIGH — read all relevant source files, traced the full call chain
- Write-back architecture: HIGH — patterns are established in existing endpoints (editor-state, init-scenes)
- TTS per-cena wiring: HIGH — `run_step_tts` signature and config flow fully traced
- Pitfalls: HIGH — derived from direct code reading, not speculation
- Test gaps: HIGH — confirmed no test files exist for these behaviors

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (codebase is stable, no active v5.0 planning)

## Project Constraints (from CLAUDE.md)

Directives from `~/.claude/CLAUDE.md` and `memelab/CLAUDE.md`:

- **Stack:** Next.js 15 App Router, React 19, TypeScript, FastAPI, SQLAlchemy async — no new dependencies without cause
- **Read before modifying:** All files being changed must be read first
- **No scope creep:** Don't add features beyond what's asked — voice/speed/trim/freeze/duration write-back only
- **No premature abstraction:** Three similar lines > abstraction; don't create helpers for one-time ops
- **Validate at system boundaries only:** API boundary validation (Pydantic), not internal
- **No backwards-compat hacks:** Don't leave removal comments or unused vars
- **Code review + QA before ship:** Spawn `code-reviewer` and `qa` subagents for non-trivial changes
- **Parallelize subagents:** Review and QA can run in parallel when files are independent
- **DEVLOG.md:** Update in real-time during execution
