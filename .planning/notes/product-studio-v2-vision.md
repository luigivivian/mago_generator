---
title: Product Studio v2 — Cinematic Multi-Scene Ads Vision
date: 2026-04-10
context: Exploration session — replacing current single-image product ads pipeline
---

## Vision

Replace the current `/ads` pipeline with a cinematic multi-scene video production tool.
User uploads 3-4 product images (different angles of same product) and gets a fully
produced commercial-grade video ad.

## Key Design Decisions

1. **Full take editor** — Each take is a configurable card: thumbnail, camera move dropdown
   (dolly, orbit, macro zoom), action description (editable text), duration slider,
   transition type selector. Full creative control per scene.

2. **Audio: library + AI mix** — Pre-built SFX library (ASMR crunch, sizzle, whoosh, epic
   hits, ambient pads) auto-selected by product category. User can swap sounds per take.
   Final mix is auto-composed with crossfades.

3. **Replaces current ads** — Same /ads routes, upgraded experience. Not a separate tool.

4. **Kling multi-image** — Kling accepts up to 4 images per generation. Each take can
   reference the product from the optimal angle for that camera move.

## Pipeline Flow

1. Upload: 3-4 product images (different angles)
2. Image treatment: optimize/process for video input
3. AI scene generation: auto-suggest scenes + scripts based on category + images
4. Take editor: full card-based editor per take (camera, action, duration, transition)
5. Audio config: library SFX auto-selected, swappable per take
6. Video generation: Kling multi-image input per take
7. Composition: stitch takes with transitions, layer audio mix
8. Export: multi-format (9:16, 16:9, 1:1), final video + individual takes + thumbnail

## Reference

- Knowledge base: `guia-producao-visual-ai-produtos.md` (prompt templates, category configs, model landscape)
- Existing pipeline: `src/product_studio/pipeline.py` (8-step orchestrator to extend)
- Video provider: Kie.ai client already integrated (Kling 3.0 access)
