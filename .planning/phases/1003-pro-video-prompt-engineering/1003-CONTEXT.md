# Phase 1003: Pro Video Prompt Engineering - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Elevate all video prompt generation in the product studio pipeline to professional commercial standards. Applies Skool-level prompt techniques (exhaustive scene description, camera-as-sentence, physics micro-details, environmental micro-motion, per-shot stability) across SHOT_PLANS, CATEGORY_CONFIGS, build_product_prompt(), build_video_prompt(), and generate_storyboard(). Also adds new categories, per-category element/prop libraries, free prompt mode, and a pytest prompt linting suite.

</domain>

<decisions>
## Implementation Decisions

### Prompt Structure Overhaul
- **D-01:** Full Skool-level rewrite of all SHOT_PLANS prompts — each prompt grows from ~150 chars to 400-500 chars with exhaustive scene description, camera-as-sentence, physics micro-details, environmental micro-motion, lens+DOF, color grade, and stability suffix.
- **D-02:** Every category gets physics micro-details, not just food. Tech: subtle screen glow pulsing. Fashion: dust particles in backlight. Beauty: water/light refraction. Each category has its OWN micro-detail vocabulary.
- **D-03:** Per-shot-type stability suffixes replace the global VIDEO_QUALITY_SUFFIX. Macro: "locked camera, no movement". Orbit: "smooth orbital, no jitter". Push-in: "controlled dolly, stable tracking". Dynamic: "controlled motion, stable tracking".
- **D-04:** Use the full 2500 char Kling budget — raise build_product_prompt() cap from 463 to 2000 chars (leaving 500 for @element overhead and API metadata).

### Category Expansion & Depth
- **D-05:** Add 3 new categories: jewelry_watches, candles_scented, supplements_bottles. Each gets full CATEGORY_CONFIG + SHOT_PLANS + element library.
- **D-06:** Shot plan depth is variable per category — food categories get 4-5 shots (more visual variety), tech/fashion/beauty stay at 3 (cleaner, more controlled).
- **D-07:** Hero actions are embedded directly into SHOT_PLANS prompts. Each act in the 3-act structure uses a DIFFERENT hero_action from the category's hero_actions list.

### Negative Prompt Strategy
- **D-08:** Per-category + per-shot-type negative prompts. Each category gets domain-specific negatives (food: "unappetizing, raw", tech: "fingerprints, screen glare"). Each shot type gets its own (macro: "out of focus subject", orbit: "wobbly rotation").
- **D-09:** Shot-type negatives are global (one macro set, one orbit set, etc. — ~5 total), not per-category-per-shot matrix. Categories can override when domain knowledge matters.
- **D-10:** Stability instructions go in BOTH positive and negative prompts. Positive: "ultra smooth motion, stable camera". Negative: "jitter, drift, deformation". Reinforces from both sides per Skool recommendation.
- **D-11:** PRODUCT_PRESERVE_NEGATIVE stays as a single global constant — generic terms cover all domains.
- **D-12:** All negative prompt constants consolidated in config.py as single source of truth. NEGATIVE_PROMPTS_BASE, category negatives in CATEGORY_CONFIGS, NEGATIVE_PROMPTS_SHOT_TYPE as separate dict.
- **D-13:** Runtime concatenation order: most specific first. Shot-type negatives -> category negatives -> global base -> PRODUCT_PRESERVE_NEGATIVE.

### Gemini Prompt Generation
- **D-14:** Upgrade Gemini as smart fallback — SHOT_PLANS cover known categories. Gemini handles unknown/custom categories with few-shot examples of pro-level prompts. Inject category context, lens vocab, Skool patterns into system instruction.
- **D-15:** Few-shot examples: 3-5 examples per category type, stored in config.py as FEW_SHOT_EXAMPLES dict alongside CATEGORY_CONFIGS.
- **D-16:** Hybrid storyboard fallback: Gemini suggests action + atmosphere + micro_detail. build_product_prompt() wraps them with category-aware surface, lighting, lens, stability.
- **D-17:** Update BOTH paths — build_video_prompt() (v1) gets pro system instruction + few-shot. generate_storyboard() fallback gets the hybrid approach. Both produce pro-quality output.

### Prompt Testing & Validation
- **D-18:** Automated prompt linting via pytest + one-time manual sample review (1 full storyboard per category after rewrite).
- **D-19:** Pytest prompt linter checks every SHOT_PLAN prompt for: lens specification (focal length), camera movement sentence, micro-detail/atmosphere term, stability keywords.
- **D-20:** Manual review: 1 full storyboard generation per category (10 categories = 10 test runs).

### build_product_prompt() Evolution
- **D-21:** Raise char cap to 2000 (simple limit change). No model-aware routing needed now.
- **D-22:** Dual source: SHOT_PLANS for deterministic path (known categories), expanded CATEGORY_CONFIGS for dynamic/Gemini fallback path.
- **D-23:** Smart truncation when over 2000 chars: drop least important parts. Priority: scene desc > camera > lens > micro-detail > atmosphere > stability suffix.

### Template Variable System
- **D-24:** Rich template variables: {product}, {hero_action}, {atmosphere}, {micro_detail} placeholders in SHOT_PLANS.
- **D-25:** Variable resolution happens in build_product_prompt() — receives category + shot index, resolves all variables from CATEGORY_CONFIGS.
- **D-26:** {atmosphere} and {micro_detail} have multiple options per category (3-4 each), randomly selected at runtime for variety across generations.

### Cross-Shot Visual Consistency
- **D-27:** Color grade identity string per category, injected into every shot prompt (e.g., "warm earth tones, slight desaturation, golden highlights"). Ensures visual coherence across the 3-act structure.
- **D-28:** Frame chaining (sequential shot building) is an optional user toggle. Default: parallel generation (fast). "High consistency" mode chains frames sequentially, passing shot 1's last frame as image_reference to shot 2.

### Per-Category Element/Prop Library
- **D-29:** Each category gets an "elements" list of prompt fragments in config — environmental props to enrich scenes. Food_cookies: ["scattered chocolate chips", "cinnamon sticks", "milk splash"]. Beauty: ["water droplets", "flower petals", "silk fabric"]. etc.
- **D-30:** Elements are text-based prompt fragments injected into scene prompts. No image upload required — pure prompt enrichment.

### Free Prompt Mode
- **D-31:** Users can write completely free prompts. Pipeline appends: VIDEO_QUALITY_SUFFIX + stability suffix in positive, PRODUCT_PRESERVE_NEGATIVE in negative. 2000 char limit enforced.

### Claude's Discretion
- Internal implementation structure of the prompt linting test suite
- How to organize FEW_SHOT_EXAMPLES within config.py (flat dict vs nested)
- Exact micro-detail vocabulary for each new category (jewelry, candles, supplements)
- How the "high consistency" toggle surfaces in the frontend take editor

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prompt Engineering Knowledge
- `~/.claude/projects/-Users-luigivivian-meme-lab/memory/reference_image_prompt_skill.md` — Camera, lighting, surface, color grading vocabulary
- `~/.claude/projects/-Users-luigivivian-meme-lab/memory/reference_skool_prompt_techniques.md` — Sequential shot building, style ref chaining, exhaustive scene description
- `~/.claude/projects/-Users-luigivivian-meme-lab/memory/reference_skool_video_prompts.md` — Camera movements, physics micro-details, stability instructions, food B-roll patterns

### Existing Implementation
- `src/product_studio/config.py` — CATEGORY_CONFIGS, SHOT_PLANS, NEGATIVE_PROMPTS, PRODUCT_PRESERVE_NEGATIVE, VIDEO_QUALITY_SUFFIX
- `src/product_studio/prompt_builder.py` — build_video_prompt(), build_product_prompt(), build_negative_prompt()
- `src/product_studio/scene_composer.py` — generate_storyboard() with fast-path SHOT_PLANS and Gemini fallback
- `src/video_gen/kie_client.py` — Kling API client with seed locking, cfg_scale, kling_elements support

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CATEGORY_CONFIGS` (config.py): 7 category dicts with surface, lighting, mood, lens, hero_actions, video_camera_moves, negative
- `SHOT_PLANS` (config.py): 3-act shot plan per category with prompt templates using {product} placeholder
- `VIDEO_QUALITY_SUFFIX` and `PRODUCT_PRESERVE_NEGATIVE` constants
- `build_product_prompt()`: template-based prompt assembly with 463 char cap and @element support
- `build_video_prompt()`: Gemini-based prompt generation (v1 path)

### Established Patterns
- Category config dict pattern: each category is a dict with standardized keys
- SHOT_PLANS use {product} as only template variable, replaced at runtime
- Negative prompts concatenated as comma-separated strings
- generate_storyboard() fast-path prefers SHOT_PLANS over Gemini when category matches

### Integration Points
- build_product_prompt() called from generate_storyboard() Gemini fallback path
- scene_composer.py fast-path reads SHOT_PLANS directly and appends VIDEO_QUALITY_SUFFIX + PRODUCT_PRESERVE_NEGATIVE
- kie_client.py receives the final prompt string — no awareness of prompt structure
- Pipeline (pipeline.py) passes seed and cfg_scale for cross-shot consistency

</code_context>

<specifics>
## Specific Ideas

- Skool pattern: "camera performs a slow smooth dolly backward, gradually revealing more environment while keeping product as central focal point" — camera as a full sentence, not a label
- Skool pattern: physics micro-details in every prompt — "melted cheese gently jiggles", "condensation droplets forming", "oil shimmers with heat"
- Per-category prop elements for scene enrichment: fruits, flowers, chocolate drizzle, liquids, textures, creams — prompt fragments that add environmental richness
- Color grade identity string per category repeated in every shot for cross-shot visual coherence

</specifics>

<deferred>
## Deferred Ideas

- **Image QA/review step** — Quality assurance workflow for reviewing generated images before video generation. New capability, own phase.
- **Image editor** — Ability to treat/adjust/edit images through an editor interface. New capability, own phase.
- **Background composition tool** — Compose/swap backgrounds onto product images. New capability, own phase.
- **Element composition onto photos** — Photo editing tool to layer elements (not prompt-based). New capability, own phase.
- **Kling @element image uploads** — Upload actual element images (fruit PNG, cream texture) for higher fidelity. Enhancement beyond text-based prompt fragments, possible future addition.

</deferred>

---

*Phase: 1003-pro-video-prompt-engineering*
*Context gathered: 2026-04-11*
