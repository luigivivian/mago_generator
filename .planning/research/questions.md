# Research Questions

## RQ-001: Kling multi-image scene composition API
**Date:** 2026-04-10
**Context:** Product Studio v2 needs to pass 3-4 product images to Kling for each take.
**Questions:**
- What's Kling 3.0's exact API for multi-image-to-video? How are multiple reference images passed?
- Does the Kie.ai aggregator support multi-image input, or do we need direct Kling API?
- What are the constraints? (max images, resolution requirements, aspect ratio per image)
- How does multi-image affect generation quality vs single image?
- Cost per generation with multi-image input vs single?

## RQ-002: Audio SFX library sourcing and licensing
**Date:** 2026-04-10
**Context:** Need a pre-built sound library for ASMR, epic hits, ambient pads, category-specific SFX.
**Questions:**
- What royalty-free SFX libraries have API access? (Freesound, Epidemic Sound, Artlist)
- Can we bundle a starter library (~50-100 sounds) with clear commercial licensing?
- What format/specs for web audio mixing? (WAV vs MP3, sample rate, normalization)
- How to categorize sounds per product category (food ASMR, tech whoosh, fashion ambient)?
