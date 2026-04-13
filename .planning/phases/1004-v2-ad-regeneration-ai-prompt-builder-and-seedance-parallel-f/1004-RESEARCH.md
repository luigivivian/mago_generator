# Phase 1004: V2 Ad Regeneration, AI Prompt Builder, and Seedance Parallel Flow - Research

**Researched:** 2026-04-12
**Domain:** Frontend wizard enhancement, AI prompt engineering UI, model-specific branching
**Confidence:** HIGH

## Summary

This phase addresses three interconnected gaps in the V2 ad creation pipeline. The codebase has **two parallel creation flows**: (1) the old `wizard.tsx` component that calls `createAdJob()` (V1 endpoint) and (2) the newer `ads/new/page.tsx` that correctly calls `createAdJobV2()`. The old wizard is still accessible and actively used but routes everything through V1, bypassing the multi-scene cinematic pipeline entirely.

The V2 creation page (`ads/new/page.tsx`) already has functional model selection (5 models including Seedance Lite/Fast), per-scene Kling prompt generation via `generateKlingPrompt()`, and compose-preview flow. However, it lacks: (a) a structured AI prompt builder with model-specific fields (5W1H for Kling, multi-shot for Seedance), (b) any Seedance-specific UI (shot count, camera moves, transitions), and (c) editable scene prompts on the detail/regeneration page.

The backend `regenerate-v2` endpoint exists and works but only accepts `video_model`, `clip_duration`, `audio_mode`, and `output_formats` overrides -- it does NOT accept `scene_prompts` or `takes` overrides. The `RegenerateV2Request` model needs extending to support prompt editing on regeneration.

**Primary recommendation:** Enhance the existing `ads/new/page.tsx` (not the old wizard.tsx) with model-conditional UI sections, add a client-side prompt builder modal, extend `RegenerateV2Request` to accept `scene_prompts`, and add Seedance-specific shot configuration.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | App Router, pages | Already in use [VERIFIED: memelab/CLAUDE.md] |
| React | 19 | UI components | Already in use [VERIFIED: memelab/CLAUDE.md] |
| Tailwind CSS | 4 | Styling | Already in use [VERIFIED: memelab/CLAUDE.md] |
| shadcn/ui (Radix) | latest | Select, Dialog, Textarea, Tabs | Already in use [VERIFIED: memelab/src/components/ui/] |
| SWR | latest | Data fetching, polling | Already in use for ad job polling [VERIFIED: hooks/use-ads.ts] |
| Lucide React | latest | Icons | Already in use [VERIFIED: wizard.tsx imports] |

### No New Libraries Needed
This phase is entirely implementable with existing stack. The AI prompt builder is client-side string assembly (no LLM call needed for structured fields -- the LLM call already exists in `generateKlingPrompt` backend endpoint). Seedance parameters are form fields mapped to existing `TakeConfig` model fields.

## Architecture Patterns

### Current File Structure (ads domain)
```
memelab/src/
  app/(app)/ads/
    page.tsx              # Ads listing
    new/page.tsx          # V2 creation wizard (calls createAdJobV2) 
    [jobId]/page.tsx      # Job detail + V1 stepper + V2 status view
  components/ads/
    wizard.tsx            # OLD V1 wizard (calls createAdJob -- BROKEN for V2)
    step-video.tsx        # V1 step video component with model selector
    step-*.tsx            # Other V1 step components
    stepper.tsx           # V1 step navigation
  lib/
    api.ts                # All API functions including createAdJobV2, regenerateAdJobV2
  hooks/
    use-ads.ts            # SWR hooks for ad polling
```

### Recommended Changes Structure
```
memelab/src/
  components/ads/
    prompt-builder-modal.tsx  # NEW: Structured prompt builder (5W1H / Seedance)
    seedance-config.tsx       # NEW: Seedance-specific shot/camera/transition panel
    scene-prompt-editor.tsx   # NEW: Editable scene prompt card for detail page
  app/(app)/ads/
    new/page.tsx              # MODIFY: Add model-conditional sections, prompt builder button
    [jobId]/page.tsx          # MODIFY: Add scene prompt editing to V2 regeneration panel
```

### Pattern 1: Model-Conditional UI Rendering
**What:** Show different form sections based on selected video model
**When to use:** When Seedance (bytedance/*) is selected, show multi-shot config; otherwise show standard fields
**Example:**
```typescript
// Source: existing pattern in ads/new/page.tsx
const isSeedance = videoModel.startsWith("bytedance/");

{isSeedance && (
  <SeedanceConfig
    shotCount={shotCount}
    onShotCountChange={setShotCount}
    preset={preset}
    onPresetChange={setPreset}
    shots={shots}
    onShotsChange={setShots}
  />
)}
```
[VERIFIED: codebase pattern from step-video.tsx conditional rendering]

### Pattern 2: Client-Side Prompt Assembly
**What:** Structured form fields assembled into a single prompt string
**When to use:** For the AI prompt builder modal
**Example:**
```typescript
// Source: spec from todo, Kling 5W1H framework
function assembleKlingPrompt(fields: {
  who: string; what: string; where: string;
  when: string; why: string; how: string;
  negative?: string;
}): string {
  const parts = [fields.who, fields.what, fields.where, fields.when, fields.why];
  let prompt = parts.filter(Boolean).join(", ");
  if (fields.how) prompt += `, ${fields.how}`;
  if (fields.negative) prompt += `, negative prompt: ${fields.negative}`;
  return prompt.slice(0, 1500); // Kling char limit
}
```
[ASSUMED: assembly format based on spec, needs validation with actual Kling behavior]

### Pattern 3: Regeneration with Scene Prompt Overrides
**What:** Extend `RegenerateV2Request` to accept `scene_prompts` and `takes` overrides
**When to use:** When user edits prompts on detail page before regenerating
**Backend change required:**
```python
# Source: src/product_studio/models.py -- extend existing model
class RegenerateV2Request(BaseModel):
    video_model: Optional[str] = None
    clip_duration: Optional[int] = None
    audio_mode: Optional[Literal["sfx", "music", "mute"]] = None
    output_formats: Optional[list[str]] = None
    scene_prompts: Optional[list[str]] = None  # NEW
    takes: Optional[list[dict]] = None          # NEW
```
[VERIFIED: current RegenerateV2Request missing these fields in models.py:114-119]

### Anti-Patterns to Avoid
- **Modifying wizard.tsx for V2 features:** The old wizard uses V1 API shape (`AdCreateRequest`). Adding V2 features there creates confusion. The `ads/new/page.tsx` is the correct V2 creation surface.
- **Server-side prompt assembly:** The prompt builder should be client-side string manipulation. The existing `generateKlingPrompt` backend endpoint already does LLM-powered prompt generation -- the structured builder is an alternative/complement, not a replacement.
- **Duplicating VIDEO_MODELS arrays:** Currently duplicated in `step-video.tsx` (10 models), `ads/new/page.tsx` (5 models), and `[jobId]/page.tsx` (5 models). Extract to shared constant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Character counter | Custom counter with re-renders | `value.length` display with color threshold | Simple enough; the 2480/1500 limits are static |
| Modal/Dialog | Custom overlay | Existing `@/components/ui/dialog` (Radix Dialog) | Already available in shadcn/ui set |
| Select dropdowns | Custom selects | Existing `@/components/ui/select` (Radix Select) | Already used throughout wizard |
| Form validation | Custom validation | Simple inline checks (existing pattern) | No form library in project; keep consistent |
| Video model detection | Regex parsing | Simple `startsWith("bytedance/")` check | Model IDs are stable, prefix-based |

## Common Pitfalls

### Pitfall 1: wizard.tsx vs ads/new/page.tsx Confusion
**What goes wrong:** Adding V2 features to the wrong creation component
**Why it happens:** Two creation flows exist -- `wizard.tsx` (old V1) and `ads/new/page.tsx` (V2)
**How to avoid:** All Phase 1004 work targets `ads/new/page.tsx`. The old `wizard.tsx` should either be deprecated or fixed with a single-line change (`createAdJob` -> `createAdJobV2`) as a separate task.
**Warning signs:** Import of `createAdJob` (V1) instead of `createAdJobV2`

### Pitfall 2: RegenerateV2Request Missing scene_prompts
**What goes wrong:** User edits prompts on detail page, regenerates, but old prompts are used
**Why it happens:** `RegenerateV2Request` doesn't accept `scene_prompts` -- the regenerate endpoint merges overrides into config but `scene_prompts` isn't in the model
**How to avoid:** Extend `RegenerateV2Request` in models.py AND update the merge logic in `regenerate_ad_job_v2()` route handler (line 1286-1295 of ads.py)
**Warning signs:** Regenerated video ignores prompt changes

### Pitfall 3: VIDEO_MODELS Array Fragmentation
**What goes wrong:** Three separate VIDEO_MODELS arrays with different entries get out of sync
**Why it happens:** Each component defines its own array: `step-video.tsx` (10 models), `ads/new/page.tsx` (5 models), `[jobId]/page.tsx` (5 models)
**How to avoid:** Extract to a shared `constants.ts` or `models.ts` file, import everywhere
**Warning signs:** Model available in one view but not another

### Pitfall 4: Seedance Character Limit (2480 chars)
**What goes wrong:** Assembled Seedance prompt exceeds 2480 char hard limit, gets truncated or rejected
**Why it happens:** Multi-shot prompts with detailed per-shot descriptions add up fast
**How to avoid:** Real-time character counter in UI, auto-truncation with warning, keep per-shot descriptions concise
**Warning signs:** Video generation fails silently or produces unexpected results

### Pitfall 5: Seedance Duration is INTEGER not STRING
**What goes wrong:** Sending duration as "5" string to Seedance endpoint causes error
**Why it happens:** Most models accept string duration, Seedance 1.5 requires integer (4/8/12)
**How to avoid:** The `kie_client.py` already handles this conversion (line 192: `sd_dur = min(int(duration), 12)`) but UI should show only valid Seedance durations (4/8/12s)
**Warning signs:** Seedance generation fails with type error
[VERIFIED: kie_client.py line 192]

### Pitfall 6: Seedance 1.5 vs Bytedance V1 Input Format Differences
**What goes wrong:** Sending wrong payload shape to different Seedance variants
**Why it happens:** `bytedance/v1-*` uses `image_url` (singular string), `bytedance/seedance-1.5-pro` uses `input_urls` (array 0-2)
**How to avoid:** The `kie_client.py` already branches correctly (line 180 vs 191). UI just needs to pass model ID; backend handles format.
**Warning signs:** "Invalid input" errors from Kie.ai
[VERIFIED: kie_client.py lines 180-200]

## Code Examples

### Existing Kling Prompt Generation (backend endpoint)
```python
# Source: src/api/routes/ads.py line 549
@router.post("/generate-kling-prompt")
async def generate_kling_prompt(req: dict, current_user=Depends(get_current_user)):
    # Accepts: product_name, category, scene_description, scene_index
    # Returns: { prompt: str }
```
[VERIFIED: ads.py line 549-617]

### Existing V2 Job Creation (frontend)
```typescript
// Source: memelab/src/app/(app)/ads/new/page.tsx line 269-280
const job = await createAdJobV2({
  product_name: productName.trim(),
  category,
  image_urls: selectedUrls,
  composed_urls: approvedComposed.map((c) => c.url),
  video_model: videoModel,
  clip_duration: clipDuration,
  scene_prompts: approvedComposed.map((c) => c.prompt),
});
```
[VERIFIED: ads/new/page.tsx line 270-278]

### Existing V2 Regeneration (frontend)
```typescript
// Source: memelab/src/app/(app)/ads/[jobId]/page.tsx line 111-124
async function handleRegenerateV2() {
  const overrides: Record<string, unknown> = {};
  if (regenModel) overrides.video_model = regenModel;
  if (regenDuration) overrides.clip_duration = parseInt(regenDuration);
  if (regenAudio) overrides.audio_mode = regenAudio;
  await regenerateAdJobV2(jobId, overrides as Parameters<typeof regenerateAdJobV2>[1]);
}
```
[VERIFIED: [jobId]/page.tsx line 111-124]

### TakeConfig Model (backend)
```python
# Source: src/product_studio/models.py line 77-90
class TakeConfig(BaseModel):
    id: str
    order: int
    prompt: str  # max 2000 chars
    camera_move: Literal["dolly", "orbit", "macro_zoom", "static", "crane",
        "static_macro", "dolly_out", "dolly_in", "push_in",
        "tilt_up", "pull_back", "product_rotate"]
    duration: int  # 3-10s
    transition_type: Literal["dissolve", "cut", "wipeleft", "fade", "fadeblack"]
    sfx_id: Optional[str]
    thumbnail_url: Optional[str]
```
[VERIFIED: models.py line 77-90]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 wizard (wizard.tsx) | V2 creation page (ads/new/page.tsx) | Phase 1002 (Apr 2026) | V2 page is the correct creation flow |
| Single prompt per job | Per-scene prompts (scene_prompts[]) | Phase 1002 (Apr 2026) | Each take gets its own prompt |
| Kling-only video gen | Multi-model (Kling, Wan, Hailuo, Seedance, Grok) | Phase 1002 (Apr 2026) | Model selector already exists |
| Manual prompt writing | AI-assisted prompt (generateKlingPrompt) | Phase 1002 (Apr 2026) | Backend endpoint exists, needs better UI |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Kling 5W1H prompt format assembles as `[WHO] [WHAT] [WHERE]...` concatenation | Architecture Patterns | Prompt quality may suffer; easy to adjust format string |
| A2 | Seedance 2480 char limit is enforced server-side by Kie.ai | Common Pitfalls | If not enforced, prompts may silently truncate; UI counter still valuable |
| A3 | The old wizard.tsx should be deprecated in favor of ads/new/page.tsx | Anti-Patterns | If users still need V1 flow, wizard.tsx needs V1/V2 toggle instead |
| A4 | Seedance multi-shot prompts use the same TakeConfig structure | Architecture | If Seedance needs different take fields, TakeConfig model needs extension |

## Open Questions

1. **Should wizard.tsx be deprecated or fixed?**
   - What we know: wizard.tsx calls V1 API, ads/new/page.tsx calls V2. Both are accessible.
   - What's unclear: Whether users still need the V1 step-by-step approval flow
   - Recommendation: Fix wizard.tsx with 1-line API call change as Phase 1 quick win, but all new features go to ads/new/page.tsx

2. **Does Seedance support multi-shot prompts natively?**
   - What we know: Kie client has `bytedance` and `seedance` input formats. The spec references Seedance 2.0 multi-shot capability.
   - What's unclear: Whether `bytedance/seedance-1.5-pro` on Kie.ai actually supports multi-prompt or if we need to generate separate clips and compose
   - Recommendation: Current pipeline already does per-take generation and xfade composition. Seedance shots can use the same per-take pattern with Seedance-specific prompts.

3. **How should "Keep storyboard, re-render video only" work?**
   - What we know: `RegenerateV2Request` currently re-runs the full pipeline. `run_v2_pipeline` checks if `scene_prompts` are provided and skips storyboard generation if so.
   - What's unclear: Whether "keep storyboard" should reuse existing takes or just skip the image composition step
   - Recommendation: Add `keep_storyboard: bool` to `RegenerateV2Request`. When true, pipeline reuses existing `takes_config` from the job row.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected for frontend (no jest/vitest config) |
| Config file | None |
| Quick run command | `cd memelab && npx tsc --noEmit` (type check) |
| Full suite command | `cd memelab && npm run build` (build check) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P1004-01 | Wizard calls createAdJobV2 not createAdJob | manual-only | Visual inspection | N/A |
| P1004-02 | Model selector shows all supported models | manual-only | Visual inspection | N/A |
| P1004-03 | Scene prompts collected and sent to backend | smoke | `curl POST /ads/create-v2` | N/A |
| P1004-04 | AI prompt builder assembles valid prompt | unit | Prompt assembly is pure function | Wave 0 |
| P1004-05 | Character counter shows correct count | manual-only | Visual | N/A |
| P1004-06 | RegenerateV2Request accepts scene_prompts | unit | `python -m pytest` with model test | Wave 0 |
| P1004-07 | Seedance config shows when bytedance model selected | manual-only | Visual | N/A |
| P1004-08 | Detail page shows editable scene prompts for V2 jobs | manual-only | Visual | N/A |

### Sampling Rate
- **Per task commit:** `cd memelab && npx tsc --noEmit`
- **Per wave merge:** `cd memelab && npm run build`
- **Phase gate:** Build green + manual walkthrough of creation and regeneration flows

### Wave 0 Gaps
- [ ] No test framework for frontend -- rely on TypeScript compilation and manual testing
- [ ] Backend: `pytest tests/test_models.py` could validate RegenerateV2Request schema -- check if test file exists

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `get_current_user` dependency on all endpoints [VERIFIED] |
| V4 Access Control | yes | `_get_user_job(job_id, user_id, db)` scopes queries to user [VERIFIED] |
| V5 Input Validation | yes | Pydantic models with Field constraints (max_length, Literal types) [VERIFIED] |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via scene_prompts | Tampering | Pydantic max_length=2000 on TakeConfig.prompt [VERIFIED] |
| IDOR on regenerate endpoint | Information Disclosure | `_get_user_job` enforces user ownership [VERIFIED] |
| XSS via prompt display | Tampering | React auto-escapes; textarea value binding is safe |

## Sources

### Primary (HIGH confidence)
- `memelab/src/app/(app)/ads/new/page.tsx` -- V2 creation wizard, current state
- `memelab/src/app/(app)/ads/[jobId]/page.tsx` -- V2 detail page with regeneration
- `memelab/src/components/ads/wizard.tsx` -- V1 wizard (calls wrong API)
- `memelab/src/components/ads/step-video.tsx` -- Video step with model selector
- `memelab/src/lib/api.ts` -- All API functions and types
- `src/api/routes/ads.py` -- Backend routes including regenerate-v2
- `src/product_studio/models.py` -- Pydantic models (AdCreateRequestV2, RegenerateV2Request, TakeConfig)
- `src/product_studio/pipeline.py` -- V2 pipeline orchestrator
- `src/video_gen/kie_client.py` -- Model-specific payload formatting (bytedance vs seedance)
- `src/product_studio/prompt_builder.py` -- Existing prompt building logic

### Secondary (MEDIUM confidence)
- `.planning/todos/pending/2026-04-12-v2-ad-job-regeneration-and-seedance-parallel-flow.md` -- Phase spec with UX audit findings and prompt engineering details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all existing
- Architecture: HIGH -- codebase fully mapped, all files read
- Pitfalls: HIGH -- identified from actual code analysis (duplicate arrays, wrong API calls, missing model fields)
- Prompt engineering spec: MEDIUM -- 5W1H and Seedance formats from skill files, not verified against live model behavior

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable -- internal codebase, no external API changes expected)
