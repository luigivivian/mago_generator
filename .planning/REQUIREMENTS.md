# Requirements

## Phase 1002: Product Studio v2 — Cinematic Multi-Scene Ads

### REQ-PS2-01: Multi-image upload
Upload 3-4 product images (different angles of same product). Validate image count, format, and resolution.

### REQ-PS2-02: Image treatment pipeline
Process uploaded images for video input: resize, optimize, normalize for Kling multi-image API requirements.

### REQ-PS2-03: AI scene & script generation
Given product images + category, generate scene suggestions with camera moves, actions, and durations. Return structured storyboard data.

### REQ-PS2-04: Take editor UI
Card-based editor where each take has: thumbnail preview, camera move dropdown (dolly, orbit, macro zoom, static, crane), action description (editable text), duration slider (3-10s), transition type selector (dissolve, cut, whip pan, fade).

### REQ-PS2-05: Category-aware prompt templates
Deterministic prompt templates for 7+ product categories (food_cookies, food_burger, food_chocolate, beauty_skincare, tech_electronics, fashion_shoes, beverage) with per-category defaults for surface, lighting, mood, lens, camera moves.

### REQ-PS2-06: Kling multi-image video generation
Pass up to 4 reference images per take to Kling via Kie.ai. Generate video per take with configured camera move and action.

### REQ-PS2-07: Audio SFX library
Pre-built sound library with category-based auto-selection. Categories: ASMR (crunch, sizzle, pour), epic (hits, risers, whoosh), ambient (warmth, nature, urban). Swappable per take.

### REQ-PS2-08: Audio mixing
Auto-compose final audio track from per-take SFX selections with crossfades, volume normalization, and layering (ambient base + SFX hits).

### REQ-PS2-09: Video composition
Stitch generated video takes with configured transitions. Handle timing, frame matching, and smooth transition rendering.

### REQ-PS2-10: Multi-format export
Export final composed video in 9:16 (Reels/TikTok), 16:9 (YouTube/web), 1:1 (feed). Also export individual takes and auto-generated thumbnail.

### REQ-PS2-11: Replace existing /ads routes
Backward compatible URLs. Existing /ads/new and /ads/jobs routes serve the new cinematic pipeline. Old single-image jobs still visible in history.

## Phase 1003: Pro Video Prompt Engineering

### REQ-PPE-01: Skool-level SHOT_PLANS rewrite
Every SHOT_PLAN prompt grows from ~150 chars to 400-500 chars with exhaustive scene description, camera-as-sentence, physics micro-details, environmental micro-motion, lens+DOF, color grade, and stability suffix.

### REQ-PPE-02: Per-category physics micro-details
Each category gets domain-specific physics micro-details (food: steam/drip/melt, tech: screen glow pulsing, beauty: water/light refraction, fashion: dust particles in backlight).

### REQ-PPE-03: Per-shot-type stability suffixes
Replace global VIDEO_QUALITY_SUFFIX with per-shot stability instructions (macro: locked camera, orbit: smooth orbital, push-in: controlled dolly, dynamic: controlled motion).

### REQ-PPE-04: 2000 char prompt budget
Raise build_product_prompt() cap from 463 to 2000 chars to use full Kling 2500 char budget (leaving 500 for @element overhead).

### REQ-PPE-05: Three new categories
Add jewelry_watches, candles_scented, supplements_bottles — each with full CATEGORY_CONFIG, SHOT_PLANS, element library.

### REQ-PPE-06: Variable shot depth per category
Food categories get 4-5 shots (more visual variety), tech/fashion/beauty stay at 3 (cleaner, controlled).

### REQ-PPE-07: Per-category negative prompts
Domain-specific negatives per category (food: unappetizing/raw, tech: fingerprints/screen glare) plus per-shot-type negatives (macro: out of focus subject, orbit: wobbly rotation).

### REQ-PPE-08: Negative prompt consolidation
All negative prompt constants in config.py as single source of truth. Runtime concatenation: shot-type -> category -> global base -> PRODUCT_PRESERVE_NEGATIVE.

### REQ-PPE-09: Gemini smart fallback
Few-shot examples (3-5 per category type) for unknown categories. Pro-level system instruction with lens vocab and Skool patterns.

### REQ-PPE-10: Hybrid storyboard fallback
Gemini suggests action + atmosphere + micro_detail; build_product_prompt() wraps with category-aware surface, lighting, lens, stability.

### REQ-PPE-11: Template variable system
Rich placeholders ({product}, {hero_action}, {atmosphere}, {micro_detail}) in SHOT_PLANS, resolved at runtime with random selection for variety.

### REQ-PPE-12: Color grade identity
Per-category color grade string injected into every shot prompt for cross-shot visual coherence.

### REQ-PPE-13: Per-category element/prop library
Text-based prompt fragments per category (food: scattered chocolate chips, cinnamon sticks; beauty: water droplets, flower petals) injected into scene prompts.

### REQ-PPE-14: Free prompt mode
Users can write free prompts. Pipeline appends stability suffix + PRODUCT_PRESERVE_NEGATIVE. 2000 char limit enforced.

### REQ-PPE-15: Frame chaining toggle
Optional "high consistency" mode that chains frames sequentially (shot 1 last frame as image_reference to shot 2). Default: parallel generation.

### REQ-PPE-16: Pytest prompt linting
Automated test suite checking every SHOT_PLAN prompt for: lens specification, camera movement sentence, micro-detail/atmosphere term, stability keywords.
