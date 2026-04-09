# Phase 24: Script Schema v2 - Research

**Researched:** 2026-04-09
**Domain:** Gemini structured JSON output / Pydantic models / LLM prompt engineering / backward-compat migration
**Confidence:** HIGH (all claims verified against installed `google-genai 1.68.0`, existing codebase, and reference doc)

## Summary

Phase 24 extends the existing `ROTEIRO_SCHEMA` dict (lines 22-50 of `script_gen.py`) with four new per-cena fields (`image_prompt`, `mood`, `transition_in`, `transition_out`) and one top-level field (`character_card`), then updates all three language-variant system prompts (pt-BR, en-US, es-ES) plus the three bible-specific prompts to instruct the LLM to populate these fields. A migration function back-fills defaults for legacy roteiros that lack the new fields.

The core risk is low: the Gemini `response_schema` dict format already used by `ROTEIRO_SCHEMA` supports `enum` (verified locally with `google-genai 1.68.0`), so enforcing `mood` and `transition_in/out` as enums at the API level is straightforward. The `character_card` is top-level and optional (nullable), populated only when `character_context` is provided to `generate_script`.

**Primary recommendation:** Add the five new fields to `ROTEIRO_SCHEMA`, update `CenaSchema` Pydantic model, write a `migrate_legacy_roteiro()` pure function that fills defaults, and inject it at every `step_state.get("script", {}).get("json", {})` read point in `reels.py`. Do NOT modify the frontend `step-script.tsx` Cena interface yet (out of scope per v4.0 -- frontend changes are backlog) but ensure the new fields pass through harmlessly as extra JSON keys.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (infrastructure phase).

Key constraints from success criteria:
- Every cena must have `image_prompt` (English, 4-layer), `mood` (enum of 7), `transition_in`, `transition_out`
- Top-level `character_card` present when tenant has recurring character
- Bible system prompt must also produce v2 schema
- Legacy roteiros must not crash -- fill missing fields with defaults (`mood=calm`, `transition_in/out=fade`, `image_prompt` derived from `legenda_overlay`)
- `image_prompt` distinct from `legenda_overlay` (English vs PT-BR)

### Claude's Discretion
All implementation choices -- pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRIPT-01 | `ROTEIRO_SCHEMA` adds top-level `character_card: {description, style_seed}` | Schema extension pattern verified; `character_dna` field on `Character` DB model (line 47 of `database/models.py`) provides source data; reference doc section 2.1 defines exact shape |
| SCRIPT-02 | Each cena gets `image_prompt` (English, 4-layer: subject, environment, visual_style, camera) | New STRING field in cenas.items; system prompt instructs LLM to generate in English; distinct from `legenda_overlay` (PT-BR visual description currently used as image prompt) |
| SCRIPT-03 | Each cena gets `mood` enum (7 values) | `enum` field verified working in google-genai 1.68.0 dict schema; reference doc section 3.3 defines mood-to-lighting map |
| SCRIPT-04 | Each cena gets `transition_in` and `transition_out` enums (4 values) | `enum` field in schema; replaces global `transition_type` in `video_builder.py` (consumed by Phase 26); FFmpeg xfade supports all 4 values |
| SCRIPT-05 | System prompts updated (regular + bible, 3 languages each) | 6 prompt templates identified: `_SYSTEM_PROMPTS` (3 langs) + `_BIBLE_SYSTEM_PROMPTS` (3 langs) + `_SYSTEM_PROMPT_FALLBACK` (1); each needs image_prompt/mood/transition instructions |
| SCRIPT-06 | Migration compat layer: legacy roteiros get defaults | Pure function `migrate_legacy_roteiro(script_dict)` fills missing fields; injection points identified in `reels.py` (15+ reads of `step_state.script.json`) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-genai | 1.68.0 | Gemini structured JSON output with `response_schema` | Already installed; `enum` support verified locally |
| pydantic | (existing) | `CenaSchema` / `RoteiroSchema` model validation | Already used in `models.py`; add new Optional fields |

### Supporting
No new libraries needed. Phase 24 is purely schema + prompt changes + migration function.

## Architecture Patterns

### Current Schema Architecture (what exists)

```
script_gen.py
  ROTEIRO_SCHEMA (dict)        -> Gemini response_schema constraint
  _SYSTEM_PROMPTS (3 langs)    -> LLM instructions (regular)
  _BIBLE_SYSTEM_PROMPTS (3 langs) -> LLM instructions (bible)
  _SYSTEM_PROMPT_FALLBACK      -> fallback for unsupported languages
  generate_script()            -> assembles prompt + calls Gemini

models.py
  CenaSchema (Pydantic)        -> validation model (4 fields)
  RoteiroSchema (Pydantic)     -> validation model (7 fields)
```

### Target Schema Architecture (v2)

```
script_gen.py
  ROTEIRO_SCHEMA (dict)        -> EXTENDED: +character_card top-level, +4 cena fields
  _SYSTEM_PROMPTS (3 langs)    -> UPDATED: instructions for image_prompt/mood/transition
  _BIBLE_SYSTEM_PROMPTS (3 langs) -> UPDATED: same new field instructions
  _SYSTEM_PROMPT_FALLBACK      -> UPDATED: same
  generate_script()            -> UPDATED: populate character_card from character_context
  migrate_legacy_roteiro()     -> NEW: backfill defaults on legacy dicts

models.py
  CenaSchema (Pydantic)        -> +image_prompt, +mood, +transition_in, +transition_out (Optional)
  RoteiroSchema (Pydantic)     -> +character_card (Optional)
```

### Pattern 1: Schema Extension with Enum Enforcement

The `ROTEIRO_SCHEMA` dict uses Gemini's OpenAPI-like format. Adding enum fields:

```python
# Verified working with google-genai 1.68.0
ROTEIRO_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        # ... existing fields ...
        "character_card": {
            "type": "OBJECT",
            "properties": {
                "description": {"type": "STRING"},
                "style_seed": {"type": "STRING"},
            },
            "required": ["description", "style_seed"],
        },
        "cenas": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    # ... existing 4 fields ...
                    "image_prompt": {"type": "STRING"},
                    "mood": {
                        "type": "STRING",
                        "enum": ["mysterious", "dramatic", "hopeful",
                                 "tense", "calm", "sad", "epic"],
                    },
                    "transition_in": {
                        "type": "STRING",
                        "enum": ["fade", "cut", "dissolve", "slide"],
                    },
                    "transition_out": {
                        "type": "STRING",
                        "enum": ["fade", "cut", "dissolve", "slide"],
                    },
                },
                "required": [
                    "imagem_index", "duracao_segundos", "narracao",
                    "legenda_overlay", "image_prompt", "mood",
                    "transition_in", "transition_out",
                ],
            },
        },
    },
    # character_card NOT in required -- absent for no-character jobs
    "required": [
        "titulo", "gancho", "narracao_completa", "cenas",
        "cta", "frase_loop", "hashtags", "caption_instagram",
    ],
}
```

**Critical detail:** `character_card` must NOT be in the top-level `required` list. When no character is present, the LLM should omit it. Gemini's structured output respects this -- non-required object fields are omitted from output.

### Pattern 2: Migration Function (Pure, Idempotent)

```python
MOOD_DEFAULT = "calm"
TRANSITION_DEFAULT = "fade"

def migrate_legacy_roteiro(script: dict) -> dict:
    """Backfill v2 fields on legacy roteiros. Idempotent."""
    if not script or not script.get("cenas"):
        return script
    for cena in script["cenas"]:
        if "image_prompt" not in cena:
            # Derive from legenda_overlay (translate PT-BR to English-ish)
            cena["image_prompt"] = cena.get("legenda_overlay", "")
        if "mood" not in cena:
            cena["mood"] = MOOD_DEFAULT
        if "transition_in" not in cena:
            cena["transition_in"] = TRANSITION_DEFAULT
        if "transition_out" not in cena:
            cena["transition_out"] = TRANSITION_DEFAULT
    # character_card: leave absent for legacy (downstream checks .get())
    return script
```

### Pattern 3: character_card Population from character_context

In `generate_script()`, after getting the script from Gemini, inject `character_card` from the `character_context` dict that was already loaded:

```python
# In generate_script(), after json.loads(response.text):
if character_context and character_context.get("character_dna"):
    script["character_card"] = {
        "description": character_context.get("character_dna", ""),
        "style_seed": _build_style_seed(character_context),
    }
```

**Source data mapping:**
| character_card field | Source (Character DB model) |
|---------------------|---------------------------|
| `description` | `Character.character_dna` (Text, line 47) |
| `style_seed` | Derived from `Character.character_dna` + `Character.composition` |

### Pattern 4: System Prompt Update Strategy

Each of the 7 prompt templates needs an additional instruction block. The instruction must:
1. Tell the LLM that `image_prompt` is in English, 4-layer format
2. Tell the LLM that `mood` is one of 7 enum values
3. Tell the LLM that `transition_in/out` are one of 4 enum values
4. Distinguish `image_prompt` (English, for image generation) from `legenda_overlay` (user's language, for subtitle display)

**The legenda_overlay semantic shift:** Currently, `legenda_overlay` serves dual purpose -- both as subtitle display text AND as image generation prompt (see `image_gen.py:242`). Phase 24 splits these: `image_prompt` becomes the dedicated image generation prompt (English), while `legenda_overlay` returns to its original purpose (subtitle overlay text in the user's language). This is the key semantic change.

### Anti-Patterns to Avoid

- **Making character_card required in the schema:** Jobs without characters (generic themes, bible mode) must still produce valid roteiros. `character_card` is optional at the schema level.
- **Translating legenda_overlay to build image_prompt in migration:** The migration function should use `legenda_overlay` as-is for `image_prompt` default. Translation would require an LLM call, which is inappropriate for a migration function. The default is "good enough" -- legacy jobs won't have perfect English image prompts, but they'll render.
- **Modifying `CenaSchema` required fields:** The Pydantic model's new fields should be `Optional` with defaults so existing code that constructs `CenaSchema` objects (e.g., `parse_manual_script` in `bible_stories.py`) continues working.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum validation at runtime | Custom mood/transition validator | Gemini `response_schema` enum + Pydantic `Literal` | Schema-level enforcement is more reliable than post-hoc validation |
| Character DNA extraction | Manual parsing of character description | `Character.character_dna` DB field | Already structured and maintained per-character |
| Translation of legenda_overlay to English | LLM call in migration function | Use as-is for legacy default | Migration must be synchronous, pure, and fast |

## Existing Code Inventory

### Files to Modify

| File | What Changes | Lines Affected |
|------|-------------|----------------|
| `src/reels_pipeline/script_gen.py` | ROTEIRO_SCHEMA + 7 prompt templates + generate_script() | ~200 lines across schema, prompts, function |
| `src/reels_pipeline/models.py` | CenaSchema + RoteiroSchema Pydantic models | ~15 lines |
| `src/reels_pipeline/bible_stories.py` | `parse_manual_script()` -- add v2 defaults to manual cenas | ~5 lines |

### Files to Create

| File | Purpose |
|------|---------|
| `src/reels_pipeline/script_migration.py` | `migrate_legacy_roteiro()` pure function |
| `tests/test_reels_script_schema.py` | Validation suite for Phase 24 |

### Injection Points for Migration

The migration function must be called at every point where a legacy roteiro might be loaded. These are all reads of `step_state.get("script", {}).get("json", {})` in `reels.py`. Rather than patching 15+ call sites, the cleanest approach is:

**Option A (recommended):** Patch `_init_step_state` and the step/script handler to apply migration at write time (when script is first stored / loaded from DB). This means the migration runs once, and all downstream reads see v2 fields.

**Option B:** Wrap all reads with a migration call. Fragile -- easy to miss a call site.

**Option A detail:** In the reels.py step handler (line 207-214), after `run_step_script` returns, apply migration. For existing jobs loaded from DB, apply migration in the `_get_user_job` or step_state deserialization path.

The safest single injection point: when `step_state["script"]["json"]` is first populated (line 214: `step_data["json"] = script_result`), and when loading from DB (the `ReelsJob.step_state` JSONB column). The DB load path goes through `_get_user_job` which returns the raw `ReelsJob` -- `step_state` is accessed as `job.step_state` (JSONB).

**Best injection point:** A helper function called at the top of every step handler that touches script, or a single migration applied in `generate_script()` return path + a "load legacy" migration applied when reading step_state from DB.

### Downstream Consumers of New Fields

| Consumer | What It Reads | Phase |
|----------|---------------|-------|
| `image_gen.py:generate_reel_images_per_cena()` | `cena.image_prompt` (will replace `legenda_overlay` usage) | Phase 25 |
| `video_builder.py:build_reel_video()` | `transition_type` (will use per-cena `transition_in/out`) | Phase 26 |
| `video_builder.py:concat_clips_with_audio()` | Same | Phase 26 |
| Ken Burns preset map | `cena.mood` | Phase 26 |

**Phase 24 does NOT modify these consumers.** It only ensures the data is present in the roteiro. Phases 25 and 26 consume it.

### The legenda_overlay Semantic Split

**Before Phase 24:**
- `legenda_overlay` = visual description (used as image prompt AND subtitle text)
- In practice: PT-BR descriptions like "mago idoso meditando no topo de montanha"
- Used by `image_gen.py:242` as `overlay = cena.get("legenda_overlay", "")`

**After Phase 24:**
- `legenda_overlay` = short subtitle overlay text (PT-BR, for display on screen)
- `image_prompt` = English 4-layer image generation prompt (subject, environment, style, camera)
- Phase 25 will switch `image_gen.py` to read `image_prompt` instead of `legenda_overlay`
- Phase 24 only adds the field; it does NOT change image_gen.py's reader

**Prompt instruction for the LLM:**
The system prompt must clearly distinguish the two:
- `legenda_overlay`: Short subtitle text in the user's language (5-15 words, what appears on screen)
- `image_prompt`: English, detailed visual description for AI image generation (20-40 words, 4-layer format: "subject doing action, environment with details, visual style, camera angle, 9:16, no text, no watermark")

## Common Pitfalls

### Pitfall 1: Gemini Ignoring New Schema Fields
**What goes wrong:** Gemini may generate responses that don't include the new fields, especially if the prompt doesn't emphasize them.
**Why it happens:** The `response_schema` enforces structure, but the LLM still needs prompt guidance to generate meaningful content (not just placeholder values).
**How to avoid:** Add explicit instructions in the system prompt for each new field with examples. The `required` array in the schema enforces presence; the prompt ensures quality.
**Warning signs:** All `mood` values are "calm" or all `image_prompt` values match `legenda_overlay`.

### Pitfall 2: character_card as Required Breaking No-Character Jobs
**What goes wrong:** If `character_card` is in the schema `required` list, Gemini will hallucinate a character card even for generic/bible jobs.
**Why it happens:** Schema enforcement is strict -- required means the field must appear.
**How to avoid:** Keep `character_card` out of `required`. For no-character jobs, let it be absent. The migration function also leaves it absent for legacy jobs.
**Warning signs:** Bible reels generating a random "character_card" with fabricated data.

### Pitfall 3: Migration Function Not Being Idempotent
**What goes wrong:** Running migration twice on the same roteiro overwrites user edits to new fields.
**Why it happens:** Migration checks `if "field" not in cena` but after first run, the field exists.
**How to avoid:** Use `not in` checks (already idempotent). Once a field exists, migration skips it.
**Warning signs:** User-edited mood/transition values reverting to defaults.

### Pitfall 4: legenda_overlay vs image_prompt Confusion in Prompts
**What goes wrong:** The LLM puts the same content in both fields, defeating the purpose.
**Why it happens:** Old prompts say "legenda_overlay is used as prompt to generate the scene image" -- this instruction must be REMOVED and replaced with the new dual-field semantics.
**How to avoid:** Update ALL prompt templates to clearly distinguish: legenda_overlay = subtitle text (user's language), image_prompt = image generation prompt (English).
**Warning signs:** `image_prompt` values in PT-BR, or `legenda_overlay` containing English 4-layer prompts.

### Pitfall 5: Manual Bible Script Missing v2 Fields
**What goes wrong:** `parse_manual_script()` in `bible_stories.py:55` creates cenas without v2 fields. If the pipeline expects them before migration runs, it crashes.
**Why it happens:** `parse_manual_script` hardcodes the v1 cena shape.
**How to avoid:** Either update `parse_manual_script` to include v2 defaults, or ensure migration runs after manual script creation.

### Pitfall 6: scene_splitter Creating Cenas Without v2 Fields
**What goes wrong:** The scene splitter (`scene_splitter.py`) creates sub-cenas by copying parent fields. If the parent has v2 fields, sub-cenas should inherit them. But `_parent_legenda_overlay` pattern only copies `legenda_overlay`.
**Why it happens:** The splitter was written before v2 fields existed.
**How to avoid:** The splitter copies all dict keys from the parent cena (line 220-225: `sub_cena = {...}` with manual field listing). Must add `image_prompt`, `mood`, `transition_in`, `transition_out` to the copy. Or use `{**orig_cena, ...override_fields}` pattern.
**Warning signs:** Sub-cenas losing mood/transition after scene splitting in SRT step.

## Code Examples

### Current ROTEIRO_SCHEMA (to be extended)
```python
# Source: src/reels_pipeline/script_gen.py:22-50
ROTEIRO_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "titulo": {"type": "STRING"},
        "gancho": {"type": "STRING"},
        "narracao_completa": {"type": "STRING"},
        "cenas": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "imagem_index": {"type": "INTEGER"},
                    "duracao_segundos": {"type": "NUMBER"},
                    "narracao": {"type": "STRING"},
                    "legenda_overlay": {"type": "STRING"},
                },
                "required": ["imagem_index", "duracao_segundos", "narracao", "legenda_overlay"],
            },
        },
        "cta": {"type": "STRING"},
        "frase_loop": {"type": "STRING"},
        "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "caption_instagram": {"type": "STRING"},
    },
    "required": [
        "titulo", "gancho", "narracao_completa", "cenas",
        "cta", "frase_loop", "hashtags", "caption_instagram",
    ],
}
```

### Current CenaSchema Pydantic Model (to be extended)
```python
# Source: src/reels_pipeline/models.py:11-17
class CenaSchema(BaseModel):
    imagem_index: int = Field(..., description="Index of the image for this scene (0-based)")
    duracao_segundos: float = Field(..., description="Duration in seconds for this scene")
    narracao: str = Field(..., description="Narration text for this scene")
    legenda_overlay: str = Field(..., description="Short overlay text for subtitle display")
```

### Character DB Model (source for character_card)
```python
# Source: src/database/models.py:46-49
character_dna: Mapped[str] = mapped_column(Text, default="", nullable=False)
negative_traits: Mapped[str] = mapped_column(Text, default="", nullable=False)
composition: Mapped[str] = mapped_column(Text, default="", nullable=False)
```

### Reference Doc Schema (target shape)
```json
// Source: pipeline-historia-narracao-imagem.md:61-87
{
  "character_card": {
    "description": "homem de 60 anos, barba branca...",
    "style_seed": "realistic, detailed face, consistent lighting"
  },
  "scenes": [
    {
      "image_prompt": "subject, environment, style, camera, 9:16, no text",
      "mood": "mysterious",
      "transition_in": "fade",
      "transition_out": "cut"
    }
  ]
}
```

### Prompt Update Insertion Point (per-language)
```python
# New instruction block to insert into each system prompt template
# (pt-BR example; translate for en-US, es-ES)
"""
CAMPOS V2 OBRIGATORIOS POR CENA:
- image_prompt: prompt em INGLES para geracao de imagem. Formato 4 camadas:
  "sujeito realizando acao, ambiente com detalhes, estilo visual, angulo de camera, 9:16, no text, no watermark"
  Exemplo: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  DEVE ser em ingles independente do idioma do roteiro. NUNCA copie legenda_overlay para image_prompt.
- mood: estado emocional da cena. Um de: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Escolha baseado no tom narrativo da cena.
- transition_in: transicao de entrada. Um de: fade, cut, dissolve, slide
- transition_out: transicao de saida. Um de: fade, cut, dissolve, slide
  Use "cut" para cortes rapidos, "fade" para momentos lentos, "dissolve" para transicoes suaves.

IMPORTANTE - legenda_overlay MUDOU:
- legenda_overlay agora e o texto curto de legenda que aparece NA TELA (5-15 palavras, no idioma do roteiro)
- NAO coloque descricao visual em legenda_overlay. Use image_prompt para isso.
- legenda_overlay e para o ESPECTADOR ler, image_prompt e para o GERADOR DE IMAGEM.
"""
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (existing) |
| Config file | none (default pytest discovery) |
| Quick run command | `python3 -m pytest tests/test_reels_script_schema.py -x -q` |
| Full suite command | `python3 -m pytest tests/ -x -q --ignore=tests/test_agents_quick.py` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRIPT-01 | character_card in schema + populated from character_context | unit | `pytest tests/test_reels_script_schema.py::test_01_character_card_in_schema -x` | Wave 0 |
| SCRIPT-02 | image_prompt field per cena (English, 4-layer) | unit | `pytest tests/test_reels_script_schema.py::test_02_image_prompt_per_cena -x` | Wave 0 |
| SCRIPT-03 | mood enum field per cena (7 values) | unit | `pytest tests/test_reels_script_schema.py::test_03_mood_enum -x` | Wave 0 |
| SCRIPT-04 | transition_in/out enum per cena (4 values) | unit | `pytest tests/test_reels_script_schema.py::test_04_transitions_enum -x` | Wave 0 |
| SCRIPT-05 | System prompts updated (regular + bible) | unit | `pytest tests/test_reels_script_schema.py::test_05_system_prompts_updated -x` | Wave 0 |
| SCRIPT-06 | Legacy migration fills defaults | unit | `pytest tests/test_reels_script_schema.py::test_06_legacy_migration -x` | Wave 0 |

### Additional Tests
| Test | Behavior | Type |
|------|----------|------|
| test_07_migration_idempotent | Running migration twice doesn't overwrite | unit |
| test_08_manual_bible_script_has_v2_fields | parse_manual_script includes v2 defaults | unit |
| test_09_schema_character_card_optional | Schema validates without character_card | unit |
| test_10_image_prompt_distinct_from_overlay | New roteiros have distinct values | unit |

### Sampling Rate
- **Per task commit:** `python3 -m pytest tests/test_reels_script_schema.py -x -q`
- **Per wave merge:** `python3 -m pytest tests/ -x -q --ignore=tests/test_agents_quick.py`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_reels_script_schema.py` -- covers SCRIPT-01 through SCRIPT-06 (+ extras)
- [ ] Framework install: none needed (pytest already available)

## Sources

### Primary (HIGH confidence)
- `src/reels_pipeline/script_gen.py` -- current ROTEIRO_SCHEMA, all prompt templates, generate_script()
- `src/reels_pipeline/models.py` -- CenaSchema, RoteiroSchema Pydantic models
- `src/reels_pipeline/image_gen.py` -- generate_reel_images_per_cena() consuming legenda_overlay
- `src/reels_pipeline/bible_stories.py` -- parse_manual_script() creating cenas
- `src/reels_pipeline/scene_splitter.py` -- split_long_scenes() creating sub-cenas
- `src/database/models.py` -- Character model with character_dna field
- `pipeline-historia-narracao-imagem.md` -- reference doc defining v2 schema shape
- `google-genai 1.68.0` -- locally verified enum support in dict-based response_schema
- `src/api/routes/reels.py` -- all step_state.script.json read/write points

### Secondary (MEDIUM confidence)
- Reference doc mood-to-lighting table (section 3.3) -- aesthetic recommendations, not critical for schema
- Reference doc image_prompt format (section 2.1, 10) -- 4-layer format specification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all changes within existing code
- Architecture: HIGH -- schema extension pattern verified locally with google-genai 1.68.0
- Pitfalls: HIGH -- all identified from actual codebase analysis (scene_splitter, bible_stories, prompt templates)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- schema changes don't rot)
