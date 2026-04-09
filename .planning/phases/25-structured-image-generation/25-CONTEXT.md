# Phase 25: Structured Image Generation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Per-cena image generation consumes `cena.image_prompt` as the primary prompt, prepends `character_card.style_seed` when present, keeps `BIBLE_STYLE_DNA` as a combinable layer (not an override), and always specifies aspect ratio explicitly.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from success criteria:
- `cena.image_prompt` (not `narracao + legenda_overlay`) must be the primary prompt to Gemini Image
- When roteiro has `character_card`, `style_seed` prepended to every per-cena prompt
- Biblical jobs ship both `BIBLE_STYLE_DNA` AND per-cena `image_prompt` (combined, not override)
- Final prompt always contains explicit aspect ratio string (`9:16`, `16:9`, etc.) from job config
- No new UI surfaces — generated images render in existing components

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Image generation
- `src/reels_pipeline/image_gen.py` — Image generation pipeline (Gemini Image API calls)
- `src/reels_pipeline/script_gen.py` — Script generation with v2 schema (Phase 24 output)
- `src/reels_pipeline/config.py` — Pipeline configuration constants

### Phase 24 output (consumed by this phase)
- `src/reels_pipeline/script_migration.py` — Legacy roteiro migration (ensures v2 fields present)
- `src/reels_pipeline/models.py` — Pydantic models including CenaSchema, CharacterCardSchema

### Bible integration
- `src/reels_pipeline/bible_stories.py` — Bible-specific prompts and BIBLE_STYLE_DNA

</canonical_refs>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>

---

*Phase: 25-structured-image-generation*
*Context gathered: 2026-04-09 via autonomous smart discuss (infrastructure skip)*
