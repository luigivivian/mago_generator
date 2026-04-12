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
