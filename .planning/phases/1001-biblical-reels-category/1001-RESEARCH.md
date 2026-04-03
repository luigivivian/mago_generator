# Phase 1001: Biblical Reels Category - Research

**Researched:** 2026-04-03
**Domain:** Reels pipeline extension (biblical content vertical) + wizard UI + DB schema
**Confidence:** HIGH

## Summary

This phase extends the existing reels pipeline to support a specialized "biblical stories" category. The codebase already has a `bible-stories` niche in `reel-niches.ts` (tier 4, with 15 subThemes, 5 hookTemplates, 4 ctaTemplates). The work involves: (1) adding conditional wizard fields when niche=bible-stories is selected (IA/manual toggle, story reference, reflection toggle, duration slider), (2) a dedicated Gemini system prompt for faithful biblical narration, (3) DB schema additions (bible_config JSON on ReelsJob, series support), (4) image generation prompt adapted for "Bible Project" illustration style, and (5) enriched script preview with highlighted verses.

The existing pipeline architecture (7 interactive steps: prompt > script > tts > srt > images > clips > video) remains unchanged. The biblical mode injects behavior through `config_override` and a specialized system prompt in `script_gen.py`, following the same pattern used by character personas. No new pipeline steps are needed.

**Primary recommendation:** Extend the existing niche system with conditional wizard fields and a biblical system prompt. Reuse `config_override` for bible-specific config. Add `bible_config` JSON column to ReelsJob and a simple Series model. Do not create separate endpoints or pipeline steps.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toggle IA/Manual in wizard step 'prompt' when niche=biblical-stories
- Mode IA: pre-defined story list (NT+AT) + free text field for any biblical reference
- Mode Manual: textarea for complete script; pipeline splits into scenes by paragraph/markers
- Faithful biblical citation: real biblical text as base, paraphrase only for narration flow, always include chapter/verse
- Evangelical canon (66 books); deuterocanonicals not in pre-defined list
- Toggle "Include modern reflection" (default: on), adds 2-3 closing sentences connecting to modern life
- Dedicated system prompt with guardrails: "Follow Scriptures faithfully. Cite chapter/verse. Do NOT invent facts. Do NOT add characters."
- Mandatory human review at 'script' step
- Visual style: modern/cartoon illustration a la 'The Bible Project' (YouTube) -- accessible, clean
- Character DNA does NOT influence biblical scenes -- style is fixed illustration. Character affects only voice/tone/channel branding
- Fields integrated inline in existing wizard with animation when niche=biblical-stories
- SubThemes expand to ~20-30 biblical stories
- Existing bible-stories niche (tier 4) as base, expanded with AI/manual script options
- TTS tone: engaging and dramatic, like a storyteller. Rhythm variation at key moments, calm for reflections
- Background track: cinematic instrumental (no lyrics), low volume under narration
- Duration slider 30-90s in wizard (default 60s for biblical)
- Scene count automatic based on duration (~1 scene per 10-12s baseline)
- SRT standard subtitles + special verse overlay (larger font, different color, verse reference in corner)
- Enriched preview at script step: verses highlighted in different color with inline references
- CTAs: use existing 5 bible-stories CTAs + expand
- Fixed hashtag set: #historiasbiblicas #biblia #fe #deus #jesus #versiculododia (auto-added on publish)
- Multi-language from start: PT-BR, EN, ES with appropriate Bible translations (NVI PT-BR, NIV EN, NVI ES)
- Thumbnail: most dramatic scene + title overlay, consistent with illustration style
- Crossfade transitions between scenes, reverent/cinematic
- Series support: series_id (FK nullable) + part_number (int) on ReelsJob, simple Series entity
- bible_config JSON on ReelsJob: story_ref, script_mode (ai/manual), include_reflection, bible_version
- E2E test script via CLI: creates test biblical reel (short story, 3 scenes, 30s), verifies script/images/video/verses

### Claude's Discretion
- Technical implementation of dedicated Gemini system prompt
- Exact structure of bible_config field in backend
- Whether character appears as visual narrator (frame/intro) or voice only
- Backend implementation: reuse endpoints vs new route
- Which ~20-30 biblical stories in initial pre-defined list
- How to serialize series in frontend (playlist UI)

### Deferred Ideas (OUT OF SCOPE)
- Per-scene sound effects (thunder, water, swords)
- Analytics dashboard for biblical reel performance vs other niches
- Automatic AI validation of biblical faithfulness (second Gemini call)
- Automatic checklist for biblical reference existence
</user_constraints>

## Architecture Patterns

### Recommended Approach: Extend, Don't Fork

The key architectural insight is that the biblical reels category is NOT a separate pipeline. It is a specialized configuration of the existing 7-step interactive pipeline. All changes should flow through existing extension points:

1. **Wizard UI**: Conditional fields when `selectedNiche === "bible-stories"` (already exists in niche selector)
2. **Config override**: Bible-specific params flow through `config_override` dict to pipeline steps
3. **System prompt**: New `_BIBLE_SYSTEM_PROMPTS` dict in `script_gen.py` (parallel to existing `_SYSTEM_PROMPTS`)
4. **Image prompt**: Bible-style prompt template in `image_gen.py` (bypasses character DNA when bible mode)
5. **DB persistence**: `bible_config` JSON column on ReelsJob + Series model

### Pattern: Conditional Wizard Fields

```typescript
// In reels/page.tsx GenerationForm, after niche selector
// When selectedNiche === "bible-stories", show biblical config inline
{selectedNiche === "bible-stories" && (
  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
    {/* IA/Manual toggle */}
    {/* Story selector (IA mode) or textarea (manual mode) */}
    {/* Reflection toggle */}
    {/* Duration slider 30-90s */}
  </div>
)}
```

This follows the existing pattern where sub-theme pills already appear conditionally based on `currentNiche`.

### Pattern: System Prompt Injection via config_override

The existing flow is: `config_override` dict -> `ReelsPipeline(config_override=...)` -> `generate_script(config_override=cfg)`. The bible system prompt should be injected through this same channel:

```python
# In script_gen.py — detect bible mode from config_override
def _get_bible_system_prompt(cfg: dict) -> str:
    """Build dedicated system prompt for biblical narration."""
    bible_config = cfg.get("bible_config", {})
    story_ref = bible_config.get("story_ref", "")
    include_reflection = bible_config.get("include_reflection", True)
    bible_version = bible_config.get("bible_version", "NVI")
    language = cfg.get("script_language", "pt-BR")
    # ... returns full system prompt with guardrails
```

### Pattern: Manual Script Parsing

When script_mode="manual", the user provides raw text. The pipeline should parse it into the standard `RoteiroSchema` format:

```python
def parse_manual_script(text: str, target_duration: int) -> dict:
    """Parse user-written script into standard roteiro JSON.
    
    Splits by double newline or --- markers into scenes.
    Distributes duration evenly across scenes.
    """
    paragraphs = [p.strip() for p in re.split(r'\n\n+|---+', text) if p.strip()]
    duration_per_scene = target_duration / max(len(paragraphs), 1)
    cenas = []
    for i, para in enumerate(paragraphs):
        cenas.append({
            "imagem_index": i,
            "duracao_segundos": duration_per_scene,
            "narracao": para,
            "legenda_overlay": para[:100],  # User edits in script step
        })
    return {
        "titulo": paragraphs[0][:50] if paragraphs else "Historia Biblica",
        "gancho": paragraphs[0] if paragraphs else "",
        "narracao_completa": text,
        "cenas": cenas,
        "cta": "",
        "frase_loop": "",
        "hashtags": [],
        "caption_instagram": "",
    }
```

### Pattern: Bible-Style Image Prompt (No Character DNA)

Per locked decision, character DNA does NOT influence biblical scenes. The image_gen module needs to detect bible mode and use a fixed illustration style:

```python
BIBLE_STYLE_DNA = (
    "Modern cartoon illustration style inspired by 'The Bible Project'. "
    "Clean lines, warm earth tones, soft cel-shading. "
    "Historical biblical setting with accurate period clothing and architecture. "
    "Accessible and visually appealing, not photorealistic. "
    "Vertical 9:16 composition (1080x1920)."
)
```

### Recommended Project Structure (Changes Only)

```
src/
  reels_pipeline/
    script_gen.py          # Add _BIBLE_SYSTEM_PROMPTS, bible story detection
    image_gen.py           # Add BIBLE_STYLE_DNA, bible-mode prompt bypass
    bible_stories.py       # NEW: pre-defined story list, manual script parser
  database/
    models.py              # Add bible_config to ReelsJob, add Series model
    migrations/versions/
      029_add_bible_config_and_series.py  # NEW migration
  api/
    routes/reels.py        # Extend create_interactive to pass bible_config

memelab/src/
  components/reels/
    reel-niches.ts          # Expand bible-stories subThemes to ~20-30
    bible-config.tsx         # NEW: conditional fields for biblical mode
    step-script.tsx          # Enhance with verse highlighting
  app/(app)/reels/
    page.tsx                 # Import and render BibleConfig conditionally
```

### Anti-Patterns to Avoid
- **Separate pipeline for biblical reels:** Would duplicate the entire 7-step flow. Use config_override instead.
- **New API endpoints:** The existing `/reels/interactive` + `/reels/{job_id}/step/{step_name}` work perfectly. Pass bible_config through the existing config flow.
- **Character DNA override for bible style:** Do NOT modify character DNA when bible mode is on. Instead, skip character DNA entirely and use the fixed BIBLE_STYLE_DNA.
- **Hardcoded story list in frontend:** Put the story list in a shared data file that both frontend and backend can reference (or just frontend with labelEn passed to API).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scene splitting from manual text | Complex NLP paragraph detection | Simple regex split on `\n\n` and `---` | Manual scripts are user-formatted; regex handles 95% of cases |
| Verse reference detection in script | Custom regex parser | Pattern `\d+\s+\w+\s+\d+:\d+` or similar | Simple pattern match for verse overlay highlighting |
| Bible translation text | Embedded bible text database | Gemini generates from training data + user review | Gemini knows biblical texts well; human review catches errors |
| Duration slider | Custom slider component | Native HTML range input | Per Phase 999.4 decision: native inputs, no Slider component |
| Inline animation | Custom animation library | Tailwind `animate-in` + `slide-in-from-top` | Already used in codebase for conditional sections |

## Common Pitfalls

### Pitfall 1: Gemini Hallucination on Biblical Facts
**What goes wrong:** Gemini invents characters, alters plot points, or merges different stories.
**Why it happens:** LLMs optimize for narrative coherence, not historical accuracy.
**How to avoid:** Dedicated system prompt with explicit guardrails ("Do NOT invent facts, Do NOT add characters, Cite chapter/verse"). Plus mandatory human review at script step (already in pipeline).
**Warning signs:** Generated script mentions characters not in the source story, or omits the verse reference.

### Pitfall 2: Character DNA Leaking into Biblical Scenes
**What goes wrong:** Biblical scenes show the channel's character (e.g., "O Mago Mestre") instead of biblical figures.
**Why it happens:** `generate_reel_images_per_cena` loads character context by default when `character_id` is set.
**How to avoid:** When `bible_config` is present in config_override, skip character DNA loading in image_gen and use BIBLE_STYLE_DNA instead. Character still influences TTS voice/tone.
**Warning signs:** Generated images show wizard/mage character in biblical settings.

### Pitfall 3: config_override Not Flowing Through All Steps
**What goes wrong:** Bible config set in wizard but not available in downstream steps (images, TTS).
**Why it happens:** `config_override` is built at step execution time from ReelsConfig, not from job-level state.
**How to avoid:** Persist `bible_config` in `step_state["config"]` (same pattern as `video_model`). The `_execute_step_task` already reads `step_state["config"]` keys into config_override.
**Warning signs:** Script step uses bible prompt but image step generates generic images.

### Pitfall 4: Manual Script Not Producing Valid Roteiro Schema
**What goes wrong:** Manual script parsed into scenes but missing required fields (cta, hashtags, caption).
**Why it happens:** Manual mode bypasses Gemini which normally generates all schema fields.
**How to avoid:** `parse_manual_script` must populate ALL required RoteiroSchema fields with sensible defaults. Pipeline already validates script has `cenas` before proceeding.
**Warning signs:** Steps after script fail with KeyError on missing fields.

### Pitfall 5: Series Continuity State Management
**What goes wrong:** Series parts don't know about previous parts, creating narrative gaps.
**Why it happens:** Each reel job is independent; no context about previous parts flows into Gemini.
**How to avoid:** When generating part N of a series, include a "Previously:" summary in the system prompt. Load previous parts' script summaries from DB.
**Warning signs:** Part 2 re-introduces characters or context already established in Part 1.

### Pitfall 6: Duration Slider Default Confusion
**What goes wrong:** Wizard sends 30s (existing default) instead of 60s for biblical reels.
**Why it happens:** Duration state is initialized to "30" before niche selection changes it.
**How to avoid:** When niche changes to bible-stories, set duration default to 60. Reset when niche changes away.
**Warning signs:** Biblical reels are consistently too short for narrative arc.

## Code Examples

### 1. Biblical System Prompt (Core Innovation)

```python
# src/reels_pipeline/script_gen.py — new dict parallel to _SYSTEM_PROMPTS

_BIBLE_SYSTEM_PROMPTS = {
    "pt-BR": """Voce e um narrador biblico especialista em contar historias das Escrituras de forma envolvente para Instagram Reels.

REGRAS INVIOLAVEIS:
- Siga FIELMENTE o texto biblico. Use texto real como base.
- SEMPRE cite capitulo e versiculo (ex: "1 Samuel 17:40").
- NAO invente fatos, personagens ou dialogos que nao existam na Biblia.
- NAO adicione personagens que nao estejam na historia original.
- NAO altere o desfecho ou a sequencia dos eventos.
- Parafraseie APENAS para fluir como narracao falada, nunca para alterar o sentido.
- Versao biblica de referencia: {bible_version}

TOM: Engajante e dramatico, como um contador de historias experiente.
- Variacao de ritmo: rapido nos momentos de acao, pausado nas reflexoes.
- Emocionalmente conectado mas reverente.

ESTRUTURA DO ROTEIRO:
1. GANCHO (0-3s): Conexao emocional com luta moderna que a historia biblica responde
2. CENARIO (3-8s): Situe o ouvinte na epoca e lugar com descricao vivida
3. NARRATIVA ({narrative_time}s): Conte a historia fielmente, cena por cena
4. LICAO ({lesson_time}s): O que essa historia ensina{reflection_instruction}
5. CTA (ultimos 3s): Convite ao compartilhamento

{image_instruction}

Historia biblica: {story_ref}
Idioma: pt-BR
Duracao alvo: {duracao}s
Numero de cenas: ~{n_cenas}

Crie um roteiro que:
1. {cena_instruction}
2. Distribua a narracao entre as cenas de forma natural e dramatica
3. Cada cena tenha em legenda_overlay uma descricao visual detalhada do cenario biblico
4. Inclua a referencia biblica em cada cena relevante
5. Gere hashtags relevantes e caption para Instagram""",

    "en-US": """You are an expert biblical narrator...""",  # Parallel template
    "es-ES": """Eres un narrador biblico experto...""",  # Parallel template
}
```

### 2. Pre-defined Biblical Stories List

```python
# src/reels_pipeline/bible_stories.py

BIBLE_STORIES = {
    # Old Testament
    "creation": {"ref": "Genesis 1-2", "title_pt": "A Criacao", "title_en": "The Creation", "title_es": "La Creacion", "testament": "OT"},
    "adam-eve": {"ref": "Genesis 3", "title_pt": "Adao e Eva", "title_en": "Adam and Eve", "title_es": "Adan y Eva", "testament": "OT"},
    "noah-ark": {"ref": "Genesis 6-9", "title_pt": "A Arca de Noe", "title_en": "Noah's Ark", "title_es": "El Arca de Noe", "testament": "OT"},
    "abraham-isaac": {"ref": "Genesis 22", "title_pt": "Abraao e Isaque", "title_en": "Abraham and Isaac", "title_es": "Abraham e Isaac", "testament": "OT"},
    "joseph-egypt": {"ref": "Genesis 37-50", "title_pt": "Jose do Egito", "title_en": "Joseph in Egypt", "title_es": "Jose en Egipto", "testament": "OT"},
    "moses-red-sea": {"ref": "Exodus 14", "title_pt": "Moises e o Mar Vermelho", "title_en": "Moses and the Red Sea", "title_es": "Moises y el Mar Rojo", "testament": "OT"},
    "moses-commandments": {"ref": "Exodus 20", "title_pt": "Os Dez Mandamentos", "title_en": "The Ten Commandments", "title_es": "Los Diez Mandamientos", "testament": "OT"},
    "david-goliath": {"ref": "1 Samuel 17", "title_pt": "Davi e Golias", "title_en": "David and Goliath", "title_es": "David y Goliat", "testament": "OT"},
    "daniel-lions": {"ref": "Daniel 6", "title_pt": "Daniel na Cova dos Leoes", "title_en": "Daniel in the Lions' Den", "title_es": "Daniel en el Foso de los Leones", "testament": "OT"},
    "jonah-whale": {"ref": "Jonas 1-4", "title_pt": "Jonas e a Baleia", "title_en": "Jonah and the Whale", "title_es": "Jonas y la Ballena", "testament": "OT"},
    "ruth-naomi": {"ref": "Ruth 1-4", "title_pt": "Rute e Noemi", "title_en": "Ruth and Naomi", "title_es": "Rut y Noemi", "testament": "OT"},
    "esther-queen": {"ref": "Esther 1-10", "title_pt": "Ester, a Rainha", "title_en": "Queen Esther", "title_es": "Ester, la Reina", "testament": "OT"},
    "elijah-prophets": {"ref": "1 Kings 18", "title_pt": "Elias e os Profetas de Baal", "title_en": "Elijah vs Prophets of Baal", "title_es": "Elias y los Profetas de Baal", "testament": "OT"},
    "samson-delilah": {"ref": "Judges 16", "title_pt": "Sansao e Dalila", "title_en": "Samson and Delilah", "title_es": "Sanson y Dalila", "testament": "OT"},
    # New Testament
    "birth-jesus": {"ref": "Luke 2", "title_pt": "O Nascimento de Jesus", "title_en": "The Birth of Jesus", "title_es": "El Nacimiento de Jesus", "testament": "NT"},
    "good-samaritan": {"ref": "Luke 10:25-37", "title_pt": "O Bom Samaritano", "title_en": "The Good Samaritan", "title_es": "El Buen Samaritano", "testament": "NT"},
    "prodigal-son": {"ref": "Luke 15:11-32", "title_pt": "O Filho Prodigo", "title_en": "The Prodigal Son", "title_es": "El Hijo Prodigo", "testament": "NT"},
    "sower-parable": {"ref": "Matthew 13:1-23", "title_pt": "Parabola do Semeador", "title_en": "Parable of the Sower", "title_es": "Parabola del Sembrador", "testament": "NT"},
    "sermon-mount": {"ref": "Matthew 5-7", "title_pt": "Sermao da Montanha", "title_en": "Sermon on the Mount", "title_es": "Sermon del Monte", "testament": "NT"},
    "water-wine": {"ref": "John 2:1-11", "title_pt": "Agua em Vinho", "title_en": "Water into Wine", "title_es": "Agua en Vino", "testament": "NT"},
    "feeding-5000": {"ref": "John 6:1-14", "title_pt": "Alimentacao dos 5000", "title_en": "Feeding of the 5000", "title_es": "Alimentacion de los 5000", "testament": "NT"},
    "walking-water": {"ref": "Matthew 14:22-33", "title_pt": "Jesus Anda sobre as Aguas", "title_en": "Walking on Water", "title_es": "Caminando sobre el Agua", "testament": "NT"},
    "lazarus": {"ref": "John 11:1-44", "title_pt": "Ressurreicao de Lazaro", "title_en": "Raising of Lazarus", "title_es": "Resurreccion de Lazaro", "testament": "NT"},
    "passion-resurrection": {"ref": "Matthew 26-28", "title_pt": "Paixao e Ressurreicao", "title_en": "Passion and Resurrection", "title_es": "Pasion y Resurreccion", "testament": "NT"},
    "mustard-seed": {"ref": "Matthew 13:31-32", "title_pt": "Parabola do Grao de Mostarda", "title_en": "Parable of the Mustard Seed", "title_es": "Parabola del Grano de Mostaza", "testament": "NT"},
}
# 25 stories: 14 OT + 11 NT — within ~20-30 target range
```

### 3. bible_config JSON Structure

```python
# Stored in ReelsJob.bible_config (JSON column)
{
    "script_mode": "ai",          # "ai" | "manual"
    "story_ref": "1 Samuel 17",   # Free text or pre-defined key
    "story_key": "david-goliath", # Pre-defined key (null for free text)
    "include_reflection": True,   # Reflection toggle
    "bible_version": "NVI",       # NVI (PT-BR), NIV (EN), NVI (ES)
    "language": "pt-BR",          # Script language
}
```

### 4. Verse Detection and Highlighting (Script Step)

```typescript
// In step-script.tsx — detect verse references for special rendering
const VERSE_PATTERN = /(\d?\s*[A-Z][a-z]+\s+\d+:\d+(?:-\d+)?)/g;

function highlightVerses(text: string) {
  return text.split(VERSE_PATTERN).map((part, i) =>
    VERSE_PATTERN.test(part)
      ? <span key={i} className="text-amber-400 font-semibold">{part}</span>
      : part
  );
}
```

### 5. DB Migration: bible_config + Series

```python
# Migration 029: Add bible_config to ReelsJob + Series model

def upgrade():
    # bible_config on ReelsJob
    op.add_column("reels_jobs", sa.Column("bible_config", sa.JSON, nullable=True))
    
    # Series table
    op.create_table(
        "reels_series",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Series FK on ReelsJob
    op.add_column("reels_jobs", sa.Column("series_id", sa.Integer, sa.ForeignKey("reels_series.id"), nullable=True))
    op.add_column("reels_jobs", sa.Column("part_number", sa.Integer, nullable=True))
```

### 6. Interactive Request Extension

```python
# Extend ReelCreateInteractiveRequest in models.py
class ReelCreateInteractiveRequest(BaseModel):
    # ... existing fields ...
    
    # Biblical config (optional, only when niche=bible-stories)
    bible_config: Optional[dict] = None  # {script_mode, story_ref, ...}
    
    # Series (optional)
    series_id: Optional[int] = None
    part_number: Optional[int] = None
```

## Backend Implementation Decision (Claude's Discretion)

**Recommendation: Reuse existing endpoints.** No new routes needed.

Rationale:
- `POST /reels/interactive` already accepts arbitrary config. Adding `bible_config` to the request body is trivial.
- `_execute_step_task` already reads from `step_state["config"]` and passes to pipeline. Bible config flows through the same channel.
- The only new endpoint needed is for Series CRUD (`GET/POST /reels/series`), which is a simple CRUD router.
- The `_init_step_state` function can check for `bible_config` to set up mode-specific initial state.

## Character as Narrator Decision (Claude's Discretion)

**Recommendation: Voice-only narrator.** Character does NOT appear visually in biblical scenes.

Rationale:
- Per locked decision, character DNA does not influence biblical scenes -- style is fixed illustration.
- Adding character as visual narrator (frame/intro) would require: new frame overlay system, intro clip generation, different aspect ratio handling. This complexity is not justified.
- The channel's character identity comes through the TTS voice (character's tone/style) and branding (hashtags, channel name in caption).
- This is simpler, cleaner, and keeps biblical scenes 100% focused on the story.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic system prompt for all niches | Per-niche system prompt with `_SYSTEM_PROMPTS` dict | Phase 999.4 | Bible mode follows this pattern with `_BIBLE_SYSTEM_PROMPTS` |
| Character DNA always applied to images | Conditional DNA based on mode | This phase | Biblical scenes skip character DNA |
| Single niche config per reel | Niche-specific config overrides | Phase quick-260330-tgu | Bible mode uses same override pattern |
| Fixed duration options (15/30/60s) | Slider 30-90s for biblical | This phase | New range input for biblical niche |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | pyproject.toml |
| Quick run command | `python -m pytest tests/ -x -q` |
| Full suite command | `python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIBLE-01 | Bible system prompt generates faithful script | unit | `python -m pytest tests/test_bible_script.py -x` | No -- Wave 0 |
| BIBLE-02 | Manual script parsing into RoteiroSchema | unit | `python -m pytest tests/test_bible_script.py::test_manual_parse -x` | No -- Wave 0 |
| BIBLE-03 | bible_config persists in ReelsJob | unit | `python -m pytest tests/test_bible_script.py::test_bible_config -x` | No -- Wave 0 |
| BIBLE-04 | Image gen skips character DNA in bible mode | unit | `python -m pytest tests/test_bible_script.py::test_bible_image_style -x` | No -- Wave 0 |
| BIBLE-05 | Verse reference detection regex | unit | `python -m pytest tests/test_bible_script.py::test_verse_detection -x` | No -- Wave 0 |
| BIBLE-06 | E2E biblical reel generation | e2e (real API) | CLI test script (uses real credits) | No -- final wave |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/ -x -q`
- **Per wave merge:** `python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_bible_script.py` -- covers BIBLE-01 through BIBLE-05
- [ ] Manual script parser unit tests
- [ ] Verse detection regex tests

## Open Questions

1. **Exact verse overlay rendering in video**
   - What we know: SRT subtitles are standard. Verse overlay needs larger font, different color, verse reference in corner.
   - What's unclear: Whether this requires changes to `video_builder.py` ASS subtitle formatting or a separate overlay pass.
   - Recommendation: Handle in the subtitle styling -- ASS format supports inline style overrides. Mark verse text with a special prefix in SRT that the builder detects and styles differently. Defer to implementation if complex.

2. **Background music sourcing**
   - What we know: Cinematic instrumental, no lyrics, low volume.
   - What's unclear: Where the music files come from. The pipeline has `bg_music_enabled` config but no music asset management.
   - Recommendation: Use a single royalty-free cinematic track bundled with the project for V1. Music selection per story is a future enhancement.

3. **Series continuation context**
   - What we know: series_id + part_number on ReelsJob. Need narrative continuity.
   - What's unclear: How much context from previous parts to include in the system prompt.
   - Recommendation: Load previous part's `titulo` and last scene's `narracao` (2-3 sentences). Include as "Previously:" section in the bible system prompt. Keep it lightweight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Backend | Yes | 3.12.8 | -- |
| Node.js | Frontend | Yes | v24.12.0 | -- |
| FFmpeg | Video assembly | Yes | 8.1 | -- |
| google-genai | Script/TTS/image gen | Yes | (installed) | -- |
| Gemini API key | All AI generation | Yes (env) | -- | -- |

No missing dependencies. All required tools are available.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/reels_pipeline/script_gen.py` -- existing system prompt architecture and config_override flow
- Codebase analysis: `src/reels_pipeline/image_gen.py` -- character DNA loading and image generation patterns
- Codebase analysis: `src/api/routes/reels.py` -- interactive endpoint, step execution, config_override building
- Codebase analysis: `memelab/src/components/reels/reel-niches.ts` -- existing bible-stories niche definition
- Codebase analysis: `src/database/models.py` -- ReelsJob schema, existing JSON columns pattern
- Codebase analysis: `src/reels_pipeline/models.py` -- Pydantic models, request/response schemas

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (21 areas documented from interactive discussion)
- Existing pipeline patterns from Phase 999.4/999.5/999.6 decisions in STATE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all extensions use existing patterns
- Architecture: HIGH -- clear extension points identified in existing codebase, all patterns verified
- Pitfalls: HIGH -- based on direct analysis of config_override flow and character DNA loading code

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no dependency changes expected)
