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
@pytest.mark.xfail(strict=True, reason="Wave 0 stub -- Plan 25-02 implements")
async def test_01_image_prompt_primary(fake_gemini_image_client, tmp_path):
    """IMAGE-01: cena.image_prompt is the primary prompt, not narracao."""
    pytest.fail("Not implemented -- Plan 25-02")


# ---------------------------------------------------------------------------
# IMAGE-02 -- style_seed prepended when character_card present
# Bound to: 25-02 Plan (Wave 1), character_card propagation + prompt layering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.xfail(strict=True, reason="Wave 0 stub -- Plan 25-02 implements")
async def test_02_style_seed_prepended(fake_gemini_image_client, tmp_path):
    """IMAGE-02: character_card.style_seed prepended before image_prompt."""
    pytest.fail("Not implemented -- Plan 25-02")


# ---------------------------------------------------------------------------
# IMAGE-03 -- BIBLE_STYLE_DNA combined with image_prompt (not override)
# Bound to: 25-02 Plan (Wave 1), bible mode prompt composition
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.xfail(strict=True, reason="Wave 0 stub -- Plan 25-02 implements")
async def test_03_bible_style_combined(fake_gemini_image_client, tmp_path):
    """IMAGE-03: BIBLE_STYLE_DNA combined with cena.image_prompt in bible mode."""
    pytest.fail("Not implemented -- Plan 25-02")


# ---------------------------------------------------------------------------
# IMAGE-04 -- aspect ratio always explicit in final prompt
# Bound to: 25-02 Plan (Wave 1), aspect ratio enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.xfail(strict=True, reason="Wave 0 stub -- Plan 25-02 implements")
async def test_04_aspect_ratio_explicit(fake_gemini_image_client, tmp_path):
    """IMAGE-04: final prompt always contains explicit aspect ratio string."""
    pytest.fail("Not implemented -- Plan 25-02")
