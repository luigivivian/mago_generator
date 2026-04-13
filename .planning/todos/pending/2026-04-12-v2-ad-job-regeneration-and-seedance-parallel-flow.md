---
created: 2026-04-12T23:57:18.545Z
title: V2 ad job regeneration and Seedance parallel flow
area: ui
files:
  - memelab/src/app/(app)/ads/[jobId]/page.tsx
  - memelab/src/app/(app)/ads/new/page.tsx
  - memelab/src/components/ads/wizard.tsx
  - memelab/src/components/ads/step-video.tsx
  - src/api/routes/ads.py
  - src/product_studio/models.py
  - src/product_studio/pipeline.py
---

## Problem

On the V2 ad job detail page (`/ads/[jobId]`), there is no way to regenerate the video after creation. The pipeline is terminal — no regeneration with different model, different images, or different prompt. User wants to:
1. Revisit the job page and regenerate using other video models
2. Change images from the "nano banana" step (previously configured)
3. Edit the prompt (per-scene) before regenerating
4. Have AI auto-generate improved prompts using the Kling/Seedance prompt engineering guides

Additionally, a **Seedance-specific parallel flow** is needed — Seedance has unique multi-shot, camera, and lighting parameters that generic forms don't expose.

Reference skill files studied:
- `895791832-Detailed-Kling-AI-Text-To-Image-System-Prompt.txt` — Kling 5W1H prompt framework
- `image-prompt-helper-SKILL (1).md` — image-to-video prompt vocabulary (camera, lighting, surfaces)
- `seedance-multishot-prompter-SKILL (1).md` — Seedance multi-shot structure, camera movements, scene chaining

## Solution

### Phase A — Regeneration on job detail page
- Add "Regenerate" panel to `/ads/[jobId]/page.tsx`
- Panel exposes: model selector, per-scene prompt editors, image swap (from stored nano-banana outputs or direct upload)
- Call existing `/ads/jobs/{job_id}/regenerate` backend endpoint (already implemented)
- Show side-by-side: current video vs regenerating

### Phase B — AI prompt auto-generation
- Add "Generate with AI" button per scene in the prompt editor
- Button calls a client-side prompt builder using 5W1H framework (Kling) or multi-shot structure (Seedance)
- UI shows structured fields (WHO/WHAT/WHERE/WHEN/WHY/HOW for Kling; SHOT/CAMERA/LIGHTING/SUBJECT for Seedance)
- Assembled prompt appears in editable textarea before submission

### Phase C — Seedance parallel flow
- New wizard variant at `/ads/new?model=seedance` or dedicated `/ads/new/seedance`
- Dynamic form with Seedance-specific parameters:
  - Shot type (establishing, medium, close-up, cutaway, etc.)
  - Camera movement (static, pan L/R, tilt up/down, dolly in/out, handheld, drone)
  - Lighting preset (golden hour, studio, neon, overcast, etc.)
  - Subject behavior (action verb, intensity, direction)
  - Scene chaining (link shot N output as reference for shot N+1)
  - Duration per shot (Seedance supports multiple durations)
- Scene generator: take an image (from nano-banana or file upload) + fill form → auto-assemble Seedance prompt
- Preview assembled prompt before sending to pipeline

### Backend gaps to check
- `RegenerateV2Request` model exists in `models.py` — verify it accepts `scene_prompts`, `clip_duration`, and `model` overrides
- May need `source_images` override on regenerate to swap images
- Seedance flow may need new pipeline variant or `model=seedance` branching in `_execute_v2_pipeline_task`

---

## Prompt Engineering Details (from skill file study)

### Kling 5W1H framework — form fields
- WHO: subject description (text area)
- WHAT: action/verb (text area)
- WHERE: environment + sensory details (text area)
- WHEN: time of day, season, era (select + text)
- WHY: emotional tone — serene, mysterious, vibrant, dramatic (multi-select)
- HOW: artistic style, perspective, lighting type, resolution (selects)
- Negative prompt: elements to exclude (text area)
- Output format: `[WHO] [WHAT] [WHERE] [WHEN] [WHY], [HOW], negative prompt: …`
- Length: 150-250 words, max 1500 chars

### Image Prompt Helper — form fields for cinematic scene analysis
Three modes: (1) Image → Prompt, (2) Text → Prompt, (3) Reference + Product Swap
- Camera angle (14 types: eye level, low, high, bird's eye, OTS, POV, etc.)
- Shot size (8 levels: extreme wide → macro)
- Lens type (6 types: wide-angle, standard, portrait/85mm, telephoto, macro, anamorphic)
- Depth of field (shallow, deep, macro, bokeh quality)
- Lighting direction (frontal, backlit, side, rim, overhead)
- Lighting quality (hard, soft, diffused, dramatic, natural)
- Lighting color temp (warm, cool, golden hour, neon, tungsten)
- Composition (centered, rule of thirds, negative space, flat lay)
- Color grade (warm, cool, teal-orange, desaturated, monochrome, bleach bypass)
- Mood (luxurious, moody, energetic, serene, dramatic, minimal)
- Style (photorealistic, cinematic, product, fashion, illustration)
- Note: final prompt is a single flowing paragraph — no labels/sections exposed

### Seedance 2.0 Multishot — form fields (most complex)
Critical constraints:
- 2480 char hard limit per shot description sequence
- 4-12 shots per sequence, 1-4 seconds per shot
- @Image1-9, @Video1-3, @Audio1-3 reference tagging system
- First 20-30 words weighted most heavily by model

Narrative Patterns (select): Unwrapping, Pour/Drip, Transformation, Seduction, Destruction/Reveal, Environment Build, Custom

Style Directions (select): Product Commercial, Action/Sports, Narrative/Cinematic, Fashion/Editorial, Music Video/Experimental, Documentary/Raw

Act Structure (3 accordion panels):
- Act 1 Hook (0-4s): text area + hook type
- Act 2 Escalation (4-10s): text area + narrative logic
- Act 3 Payoff (10-15s): text area + hero moment type

Per-Shot Card (repeatable, 4-12 cards with 6 layers):
1. Subject + Action (text)
2. Camera angle + lens + movement (selects)
3. Effects: speed (full/slow-mo%/ramp/freeze/reverse), in-camera (rack focus, lens flare, film grain, chromatic aberration, vignette)
4. Lighting + atmosphere (selects for approach, atmosphere particles, color grade)
5. Motion blur + texture (selects)
6. Transition to next shot (movement-matched / impact / smooth — 15 named types)

Reference Manager:
- @Image1-9 roles: first frame, last frame, main character, style anchor, product hero
- @Video1-3 roles: camera movement ref, motion ref, action ref
- @Audio1-3 roles: background music, sound effects, beat sync

Real-time character counter with compression suggestions at 2000/2480 chars.

---

## UX Audit Findings (from codebase analysis)

### Current flow problems
1. **Wizard calls V1 API** — `createAdJob()` instead of `createAdJobV2()` (1-line bug)
2. **No model selection in wizard** — video model hardcoded to `kling-3.0/video`
3. **No scene_prompts in wizard** — V2 pipeline expects `scene_prompts[]`, wizard never collects them
4. **V2 jobs are terminal** — regeneration panel exists on detail page (model/duration/audio) but no storyboard/scene editing
5. **No step-state visibility** — users see only `status: complete`, not which pipeline step is running
6. **No "edit and re-run"** — can't go back to wizard inputs after job is created

### Proposed creation wizard (V2)
Section 1: Product + Images (keep as-is, add category)
Section 2: Model & Format (NEW)
  - Video model dropdown with model-specific subsection for Seedance
  - Duration per clip, output format
Section 3: Scene & Prompt Planning (REORGANIZED)
  - "Auto-generate storyboard" button → calls `/ads/storyboard-preview` (new endpoint)
  - 3-5 editable scene prompt fields
  - Live preview card per scene
Section 4: Audio & Metadata (keep, add tone + cost estimate)

### Proposed detail page enhancements
- Step timeline bar: analysis → storyboard → video_composition → export (requires `step_state` exposure)
- Expandable storyboard viewer: grid of take cards with editable prompts
- "Keep storyboard, re-render video only" toggle in regeneration panel (faster iteration)
- Regeneration history log (collapsed by default)

### New backend endpoints needed
1. `GET /ads/{jobId}/input-snapshot` — returns original wizard inputs for edit flow
2. `POST /ads/storyboard-preview` — generates take suggestions during wizard
3. `POST /ads/{jobId}/regenerate-step` — re-run specific step (not full restart)
4. Expose `step_state` + `current_step` in V2 job responses

### Seedance parallel flow (model-specific UX)
Detection: `if model in SEEDANCE_MODELS → showSeedanceMode = true`

Wizard Section 2B (shown only for Seedance):
- Number of shots: 2-4 (default 3)
- Preset: Product Showcase / Lifestyle / Dynamic / Custom
- Per-shot controls: Camera Move, Duration, Transition type

Detail page Seedance panel (when job is Seedance):
- "Keep storyboard, re-render" (preserve takes)
- "Re-compose shots" (regenerate takes + video)
- "Change composition preset" (auto-adjust camera moves)

### New frontend components needed
| Component | Location | Status |
|-----------|----------|--------|
| AdWizardV2 | `/ads/new` (replace wizard.tsx) | NEW |
| StoryboardSelector | wizard or new file | NEW |
| ModelSelector | wizard Section 2 | NEW |
| SeedanceComposer | detail page (modal/panel) | NEW |
| StepTimeline | detail page V2 header | NEW |
| ScenePromptEditor | detail page expandable | ENHANCE |
| VideoRegenPanel | detail page (keep-storyboard toggle) | ENHANCE |

### Implementation priority
Phase 1 (highest ROI, low effort):
- Fix wizard to call `createAdJobV2()` (1 line)
- Add model selector to wizard
- Add 3-5 `scene_prompts` text fields to wizard

Phase 2:
- Expose `step_state` in V2 responses
- Storyboard preview endpoint
- StoryboardSelector card grid
- Input snapshot endpoint

Phase 3:
- Seedance multi-shot composer
- Step timeline on detail page
- Scene prompt editor in detail page
- Regeneration history
