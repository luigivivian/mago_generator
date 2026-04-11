# Phase 1003: Pro Video Prompt Engineering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 1003-pro-video-prompt-engineering
**Areas discussed:** Prompt structure overhaul, Category expansion & depth, Negative prompt strategy, Gemini prompt gen quality, Prompt testing & validation, build_product_prompt() char limit update, Template variable system, Cross-shot visual consistency, Per-category elements, Free prompt mode

---

## Prompt Structure Overhaul

| Option | Description | Selected |
|--------|-------------|----------|
| Full Skool-level rewrite | Rewrite all 21+ shot plan prompts to 400-500 chars with full pro vocabulary | ✓ |
| Structured layers approach | Composable layers assembled at runtime | |
| You decide | Claude picks best approach | |

**User's choice:** Full Skool-level rewrite
**Notes:** User wants maximum prompt quality, not incremental improvement.

| Option | Description | Selected |
|--------|-------------|----------|
| Every category | All categories get micro-motion details | ✓ |
| Food & beverage only | Only food-related categories | |
| Category-specific selection | Each category gets its own vocabulary | |

**User's choice:** Every category gets physics micro-details

| Option | Description | Selected |
|--------|-------------|----------|
| Keep global suffix | One VIDEO_QUALITY_SUFFIX for all | |
| Per-shot-type suffix | Different stability instructions per shot type | ✓ |
| Both: global base + shot override | Global base with overrides | |

**User's choice:** Per-shot-type suffix

| Option | Description | Selected |
|--------|-------------|----------|
| Use full 2500 char budget | Pro prompts at 800-1500 chars | ✓ |
| Tiered: short for elements, long for standalone | Different caps per API mode | |
| Keep conservative limits | Stay under 500 chars | |

**User's choice:** Use full 2500 char budget

---

## Category Expansion & Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add 3-5 new categories | New categories with full configs | ✓ |
| Deepen existing 7 only | Focus on improving current categories | |
| Both: deepen + add 2-3 key ones | Upgrade existing + add some new | |

**User's choice:** Add 3-5 new categories
**New categories selected:** Candles & scented products, Jewelry & watches, Supplements & bottles

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3-act structure | Rewrite prompts within same structure | |
| Expand to 5 shots per category | More variety with 5 shots | |
| Variable per category | Food gets 4-5, tech/fashion stays 3 | ✓ |

**User's choice:** Variable per category

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, embed hero_actions into SHOT_PLANS | Each act uses a different hero_action | ✓ |
| Keep separate | SHOT_PLANS camera-focused, hero_actions for Gemini only | |
| Optional hero_action slot | {hero_action} placeholder | |

**User's choice:** Embed hero_actions, each act uses a different one

---

## Negative Prompt Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-category + per-shot-type | Domain-specific + shot-specific negatives | ✓ |
| Per-category only | Expand category negatives, generic shot negatives | |
| Three-tier system | Global + category + shot all concatenated | |

**User's choice:** Per-category + per-shot-type

| Option | Description | Selected |
|--------|-------------|----------|
| Negative prompts | Stability in negatives only | |
| Both positive and negative | Reinforce from both sides | ✓ |
| Positive only | Describe what you want, not what to avoid | |

**User's choice:** Both positive and negative

| Option | Description | Selected |
|--------|-------------|----------|
| Global per shot-type | One macro set for all categories | ✓ |
| Per-category-per-shot matrix | ~70+ combinations | |
| Global base + category override | Global defaults with category overrides | |

**User's choice:** Global per shot-type

| Option | Description | Selected |
|--------|-------------|----------|
| All in config.py | Single source of truth | ✓ |
| Structured in CATEGORY_CONFIGS | Co-located with category | |
| Separate negative_config.py | Dedicated file | |

**User's choice:** All in config.py

| Option | Description | Selected |
|--------|-------------|----------|
| Keep global constant | PRODUCT_PRESERVE_NEGATIVE for all | ✓ |
| Category-aware preservation | Global + category-specific terms | |
| You decide | Claude picks | |

**User's choice:** Keep global constant

| Option | Description | Selected |
|--------|-------------|----------|
| Most specific first | Shot-type -> category -> global -> preserve | ✓ |
| Most important first | Preserve -> category -> shot-type -> global | |
| You decide | Claude picks based on Kling behavior | |

**User's choice:** Most specific first

---

## Gemini Prompt Gen Quality

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade Gemini as smart fallback | Few-shot examples, pro vocabulary | ✓ |
| Deprecate Gemini path | Deterministic templates only | |
| Gemini as prompt enhancer | Enhances templates, doesn't generate | |

**User's choice:** Upgrade Gemini as smart fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 3-5 examples per category type | 20-35 examples total | ✓ |
| Yes, 1 universal example | One gold-standard example | |
| No few-shot, better system prompt | Rules over examples | |

**User's choice:** 3-5 examples per category type

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Gemini generates full pro prompts | Complete prompts from Gemini | |
| Keep current: Gemini suggests, template builds | Separation of creativity vs consistency | |
| Hybrid: Gemini suggests + template enriches | Gemini suggests, template wraps | ✓ |

**User's choice:** Hybrid

| Option | Description | Selected |
|--------|-------------|----------|
| In config.py as constants | FEW_SHOT_EXAMPLES dict | ✓ |
| Separate prompt_examples.py | New dedicated file | |
| In SHOT_PLANS themselves | Use shot plan prompts as examples | |

**User's choice:** In config.py as constants

| Option | Description | Selected |
|--------|-------------|----------|
| Update both | Both v1 and v2 paths get pro treatment | ✓ |
| Focus on storyboard only | v2 pipeline only | |
| Deprecate build_video_prompt() | Remove v1 entirely | |

**User's choice:** Update both

---

## Prompt Testing & Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Manual A/B comparison | Side-by-side review | |
| Automated quality checks | Prompt structure validation | |
| Both: automated + sample review | Pytest lint + manual review | ✓ |
| Out of scope | Ship and trust patterns | |

**User's choice:** Both automated checks + sample review

| Option | Description | Selected |
|--------|-------------|----------|
| Test suite (pytest) | Unit tests in CI | ✓ |
| Runtime validation | Checks at assembly time | |
| Both | Tests + runtime | |

**User's choice:** Test suite (pytest)

**Lint rules selected (multi-select):** Lens specification, Camera movement sentence, Micro-detail/atmosphere, Stability keywords

**Manual review:** 1 full storyboard per category (10 test runs)

---

## build_product_prompt() Char Limit

| Option | Description | Selected |
|--------|-------------|----------|
| Raise cap to 2000 chars | Simple limit change | ✓ |
| Remove cap, model-aware limits | Different per model | |
| Refactor into prompt assembler | Composable assembly function | |

**User's choice:** Raise cap to 2000 chars

| Option | Description | Selected |
|--------|-------------|----------|
| SHOT_PLANS as primary source | build_product_prompt becomes thin wrapper | |
| Expand CATEGORY_CONFIGS | Richer config fields | |
| Both: SHOT_PLANS deterministic, CATEGORY_CONFIGS dynamic | Two sources, two paths | ✓ |

**User's choice:** Both paths

**Truncation:** Smart truncation dropping least important parts (scene > camera > lens > micro-detail > atmosphere > stability)

---

## Template Variable System

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: {product} only | Single variable | |
| Medium: {product} + {hero_action} | Two variables | |
| Rich: {product} + {hero_action} + {atmosphere} + {micro_detail} | Full composition | ✓ |

**User's choice:** Rich variable system

**Hero action embedding:** Each act uses a different hero_action from the list

**Variable resolution:** In build_product_prompt()

**Variety:** Multiple options per category (3-4 each), randomly selected

---

## Cross-Shot Visual Consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Color grade identity in every prompt | Canonical color string per category | ✓ |
| Seed + cfg_scale is enough | No prompt-level consistency | |
| Color grade + lighting identity | Both color and lighting consistent | |

**User's choice:** Color grade identity in every prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, chain frames | Sequential generation with image_reference | |
| No, parallel is better | Speed over consistency | |
| Optional: user toggle | Default parallel, toggle for high consistency | ✓ |

**User's choice:** Optional user toggle

---

## Per-Category Elements & Free Prompt (from user free-text input)

**Elements:** Prompt fragments in config per category. Text-based, no image upload. Environmental props: fruits, flowers, chocolate, liquids, textures, creams per category.

**Free prompt:** User writes freely. Pipeline appends VIDEO_QUALITY_SUFFIX + stability suffix + PRODUCT_PRESERVE_NEGATIVE in negatives. 2000 char limit enforced.

---

## Claude's Discretion

- Internal pytest test suite structure
- FEW_SHOT_EXAMPLES organization within config.py
- Micro-detail vocabulary for new categories
- High consistency toggle frontend surfacing

## Deferred Ideas

- Image QA/review step — quality assurance workflow
- Image editor — treat/adjust images
- Background composition tool
- Element composition onto photos (photo editing)
- Kling @element image uploads for higher fidelity
