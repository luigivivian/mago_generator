"""Phase 25: Structured Image Generation -- validation suite.

Wave 0 (plan 25-01) creates all 4 tests as xfail stubs.
Wave 1 (plan 25-02) flips all 4 tests from xfail -> active.

DO NOT rename a test without updating 25-VALIDATION.md.
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# IMAGE-01 -- image_prompt used as primary prompt (not narracao/overlay)
# Bound to: 25-02 Plan (Wave 1), generate_reel_images_per_cena rewrite
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_01_image_prompt_primary(fake_gemini_image_client, tmp_path):
    """IMAGE-01: cena.image_prompt is the primary prompt, not narracao."""
    from src.reels_pipeline.image_gen import generate_reel_images_per_cena
    cenas = [{"narracao": "O mago caminha pela floresta", "legenda_overlay": "Floresta encantada", "image_prompt": "A wizard walking through enchanted forest, lush greenery, cartoon cel-shading, wide angle, 9:16, no text, no watermark", "imagem_index": 0, "duracao_segundos": 5.0}]
    await generate_reel_images_per_cena(cenas=cenas, character_id=None, output_dir=str(tmp_path))
    prompt = fake_gemini_image_client.calls[0]["contents"][-1]
    assert "wizard walking through enchanted forest" in prompt
    assert "O mago caminha pela floresta" not in prompt  # narracao NOT used as prompt


# ---------------------------------------------------------------------------
# IMAGE-02 -- style_seed prepended when character_card present
# Bound to: 25-02 Plan (Wave 1), character_card propagation + prompt layering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_02_style_seed_prepended(fake_gemini_image_client, tmp_path):
    """IMAGE-02: character_card.style_seed prepended before image_prompt."""
    from src.reels_pipeline.image_gen import generate_reel_images_per_cena
    cenas = [{"narracao": "test", "legenda_overlay": "test", "image_prompt": "A wizard casting spells in a dark cave, moody lighting, cartoon style, medium shot", "imagem_index": 0, "duracao_segundos": 5.0}]
    card = {"description": "Old wizard with blue robe", "style_seed": "Soft cel-shading cartoon, blue robe wizard with silver beard"}
    await generate_reel_images_per_cena(cenas=cenas, character_id=None, output_dir=str(tmp_path), character_card=card)
    prompt = fake_gemini_image_client.calls[0]["contents"][-1]
    assert "Soft cel-shading cartoon, blue robe wizard" in prompt
    # style_seed appears BEFORE image_prompt in the assembled string
    seed_pos = prompt.index("Soft cel-shading cartoon")
    prompt_pos = prompt.index("wizard casting spells")
    assert seed_pos < prompt_pos


# ---------------------------------------------------------------------------
# IMAGE-03 -- BIBLE_STYLE_DNA combined with image_prompt (not override)
# Bound to: 25-02 Plan (Wave 1), bible mode prompt composition
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_03_bible_style_combined(fake_gemini_image_client, tmp_path):
    """IMAGE-03: BIBLE_STYLE_DNA combined with cena.image_prompt in bible mode."""
    from src.reels_pipeline.image_gen import generate_reel_images_per_cena, BIBLE_STYLE_DNA
    cenas = [{"narracao": "test", "legenda_overlay": "test", "image_prompt": "Moses parting the Red Sea, dramatic waves, ancient Egyptian backdrop, wide cinematic shot", "imagem_index": 0, "duracao_segundos": 5.0}]
    await generate_reel_images_per_cena(cenas=cenas, character_id=None, output_dir=str(tmp_path), config_override={"bible_config": {"book": "Exodus"}})
    prompt = fake_gemini_image_client.calls[0]["contents"][-1]
    # Both BIBLE_STYLE_DNA and image_prompt must be present (combined, not override)
    assert "Bible Project" in prompt  # from BIBLE_STYLE_DNA
    assert "Moses parting the Red Sea" in prompt  # from image_prompt


# ---------------------------------------------------------------------------
# IMAGE-04 -- aspect ratio always explicit in final prompt
# Bound to: 25-02 Plan (Wave 1), aspect ratio enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_04_aspect_ratio_explicit(fake_gemini_image_client, tmp_path):
    """IMAGE-04: final prompt always contains explicit aspect ratio string."""
    from src.reels_pipeline.image_gen import generate_reel_images_per_cena
    # image_prompt intentionally does NOT contain "9:16"
    cenas = [{"narracao": "test", "legenda_overlay": "test", "image_prompt": "A sunset over mountains, warm colors, landscape photography, panoramic view", "imagem_index": 0, "duracao_segundos": 5.0}]
    await generate_reel_images_per_cena(cenas=cenas, character_id=None, output_dir=str(tmp_path))
    prompt = fake_gemini_image_client.calls[0]["contents"][-1]
    assert "9:16" in prompt  # aspect ratio enforced even when not in image_prompt
