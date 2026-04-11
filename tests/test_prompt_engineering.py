"""Pytest prompt linting suite for Phase 1003 — Pro Video Prompt Engineering.

Validates all SHOT_PLAN prompts, CATEGORY_CONFIGS, negative prompts,
template variable resolution, and prompt builder outputs against
Skool-level professional standards.

Requirements covered:
- REQ-PPE-01: Skool-level prompts (400-500 chars, camera-as-sentence, lens, physics)
- REQ-PPE-02: Per-category physics micro-details
- REQ-PPE-03: Per-shot-type stability suffixes
- REQ-PPE-05: 10 categories (7 original + 3 new)
- REQ-PPE-06: Variable shot depth (food 4-5, non-food 3)
- REQ-PPE-07/08: Negative prompt system
- REQ-PPE-11: Template variable resolution
- REQ-PPE-12: Color grade identity per category
- REQ-PPE-13: Element/prop library per category
- REQ-PPE-14: Free prompt mode
- REQ-PPE-16: This test suite itself
"""

import re
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.product_studio.config import (
    CATEGORY_CONFIGS,
    CATEGORY_DEFAULT,
    SHOT_PLANS,
    SHOT_PLAN_DEFAULT,
    STABILITY_SUFFIXES,
    STABILITY_SUFFIX_DEFAULT,
    NEGATIVE_PROMPTS_BASE,
    NEGATIVE_PROMPTS_SHOT_TYPE,
    PRODUCT_PRESERVE_NEGATIVE,
    FEW_SHOT_EXAMPLES,
)
from src.product_studio.prompt_builder import (
    build_product_prompt,
    build_negative_prompt,
    build_free_prompt,
    resolve_template_vars,
)


# -- Constants ---------------------------------------------------------------

ALL_CATEGORIES = [
    "food_cookies", "food_chocolate", "food_burger",
    "beauty_skincare", "fashion_shoes", "tech_electronics", "beverage",
    "jewelry_watches", "candles_scented", "supplements_bottles",
]
FOOD_CATEGORIES = ["food_cookies", "food_chocolate", "food_burger"]
NON_FOOD_CATEGORIES = [c for c in ALL_CATEGORIES if c not in FOOD_CATEGORIES]

LENS_PATTERN = re.compile(r"\d{2,3}mm")  # e.g. 85mm, 100mm, 50mm, 35mm
CAMERA_PATTERN = re.compile(r"\bcamera\b", re.IGNORECASE)


# -- SHOT_PLANS lint ---------------------------------------------------------

class TestShotPlanLint:
    """Lint every SHOT_PLAN prompt for Skool-level quality markers."""

    def test_all_10_categories_have_shot_plans(self):
        for cat in ALL_CATEGORIES:
            assert cat in SHOT_PLANS, f"Missing SHOT_PLANS for {cat}"

    def test_food_categories_have_4_to_5_shots(self):
        for cat in FOOD_CATEGORIES:
            n = len(SHOT_PLANS[cat])
            assert 4 <= n <= 5, f"{cat} has {n} shots (expected 4-5)"

    def test_non_food_categories_have_3_shots(self):
        for cat in NON_FOOD_CATEGORIES:
            n = len(SHOT_PLANS[cat])
            assert n == 3, f"{cat} has {n} shots (expected 3)"

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_shot_plan_lens_specification(self, cat):
        for i, shot in enumerate(SHOT_PLANS[cat]):
            assert LENS_PATTERN.search(shot["prompt"]), (
                f"{cat}[{i}] '{shot['name']}' missing lens spec (e.g. 85mm)"
            )

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_shot_plan_camera_movement_sentence(self, cat):
        for i, shot in enumerate(SHOT_PLANS[cat]):
            p = shot["prompt"].lower()
            has_camera = "camera" in p or "locked" in p or "holds" in p or "orbit" in p
            assert has_camera, (
                f"{cat}[{i}] '{shot['name']}' missing camera movement sentence"
            )

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_shot_plan_prompt_length(self, cat):
        for i, shot in enumerate(SHOT_PLANS[cat]):
            plen = len(shot["prompt"])
            assert 350 <= plen <= 550, (
                f"{cat}[{i}] '{shot['name']}' is {plen} chars (expected 350-550)"
            )

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_shot_plan_has_product_placeholder(self, cat):
        for i, shot in enumerate(SHOT_PLANS[cat]):
            assert "{product}" in shot["prompt"], (
                f"{cat}[{i}] '{shot['name']}' missing {{product}} placeholder"
            )

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_shot_plan_has_micro_detail_or_atmosphere(self, cat):
        for i, shot in enumerate(SHOT_PLANS[cat]):
            p = shot["prompt"]
            has_var = "{micro_detail}" in p or "{atmosphere}" in p
            has_inline = any(word in p.lower() for word in [
                "steam", "glow", "shimmer", "particles", "droplets",
                "condensation", "dust", "haze", "wisps", "ripple",
                "refraction", "caustics", "flicker", "pulsing",
            ])
            assert has_var or has_inline, (
                f"{cat}[{i}] '{shot['name']}' missing micro-detail or atmosphere"
            )


# -- CATEGORY_CONFIGS validation ---------------------------------------------

class TestCategoryConfigs:

    def test_all_10_categories_present(self):
        for cat in ALL_CATEGORIES:
            assert cat in CATEGORY_CONFIGS, f"Missing CATEGORY_CONFIGS for {cat}"

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_required_keys(self, cat):
        cfg = CATEGORY_CONFIGS[cat]
        for key in ["display_name", "surface", "lighting", "mood", "lens",
                     "hero_actions", "video_camera_moves", "negative",
                     "color_grade", "elements", "atmospheres", "micro_details"]:
            assert key in cfg, f"{cat} missing key: {key}"

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_elements_count(self, cat):
        elements = CATEGORY_CONFIGS[cat]["elements"]
        assert len(elements) >= 4, f"{cat} has only {len(elements)} elements (need 4+)"

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_atmospheres_count(self, cat):
        atm = CATEGORY_CONFIGS[cat]["atmospheres"]
        assert len(atm) >= 3, f"{cat} has only {len(atm)} atmospheres (need 3+)"

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_micro_details_count(self, cat):
        md = CATEGORY_CONFIGS[cat]["micro_details"]
        assert len(md) >= 3, f"{cat} has only {len(md)} micro_details (need 3+)"

    def test_default_has_new_keys(self):
        for key in ["color_grade", "elements", "atmospheres", "micro_details"]:
            assert key in CATEGORY_DEFAULT, f"CATEGORY_DEFAULT missing {key}"


# -- Stability suffixes ------------------------------------------------------

class TestStabilitySuffixes:

    def test_all_entries_have_stability_keywords(self):
        for shot_type, suffix in STABILITY_SUFFIXES.items():
            lower = suffix.lower()
            has_stability = "jitter" in lower or "drift" in lower or "deformation" in lower
            assert has_stability, (
                f"STABILITY_SUFFIXES['{shot_type}'] missing stability keywords"
            )

    def test_at_least_8_shot_types(self):
        assert len(STABILITY_SUFFIXES) >= 8


# -- Negative prompt system --------------------------------------------------

class TestNegativePrompts:

    def test_build_negative_with_shot_type(self):
        neg = build_negative_prompt("food_cookies", "static_macro")
        assert "out of focus" in neg.lower(), "Missing shot-type negative for static_macro"
        assert "morphing" in neg.lower(), "Missing PRODUCT_PRESERVE"

    def test_build_negative_without_shot_type(self):
        neg = build_negative_prompt("food_cookies")
        assert "morphing" in neg.lower(), "Missing PRODUCT_PRESERVE in compat mode"

    def test_concatenation_order_shot_type_before_category(self):
        neg = build_negative_prompt("food_cookies", "static_macro")
        shot_pos = neg.lower().find("out of focus")
        cat_text = CATEGORY_CONFIGS["food_cookies"]["negative"].split(",")[0].strip().lower()
        cat_pos = neg.lower().find(cat_text)
        assert shot_pos < cat_pos, (
            f"Shot-type negative ({shot_pos}) should come before category ({cat_pos})"
        )

    def test_negative_prompts_shot_type_count(self):
        assert len(NEGATIVE_PROMPTS_SHOT_TYPE) >= 8


# -- Template variable resolution --------------------------------------------

class TestTemplateResolution:

    def test_resolves_all_placeholders(self):
        template = "Shot of {product}, {hero_action}, {micro_detail}, {atmosphere}"
        result = resolve_template_vars(template, "food_cookies", "@prod (Cookie)", 0)
        for var in ["{product}", "{hero_action}", "{micro_detail}", "{atmosphere}"]:
            assert var not in result, f"Unresolved: {var}"

    def test_product_ref_injected(self):
        result = resolve_template_vars("{product} close-up", "food_cookies", "@prod (Cookie)", 0)
        assert "@prod (Cookie)" in result

    def test_different_shot_index_gives_different_hero_action(self):
        r0 = resolve_template_vars("{hero_action}", "food_cookies", "x", 0)
        r1 = resolve_template_vars("{hero_action}", "food_cookies", "x", 1)
        r2 = resolve_template_vars("{hero_action}", "food_cookies", "x", 2)
        # At least 2 of 3 should differ (hero_actions has 3 entries)
        unique = len({r0, r1, r2})
        assert unique >= 2, "hero_action should vary by shot_index"


# -- build_product_prompt ----------------------------------------------------

class TestBuildProductPrompt:

    @pytest.mark.parametrize("cat", ALL_CATEGORIES)
    def test_prompt_under_2000_chars(self, cat):
        prompt = build_product_prompt(cat, "dolly", "Product action description here")
        assert len(prompt) <= 2000, f"{cat} prompt is {len(prompt)} chars"

    def test_prompt_contains_element_ref(self):
        prompt = build_product_prompt("food_cookies", "dolly", "Breaking cookie")
        assert "@prod" in prompt

    def test_prompt_contains_lens(self):
        prompt = build_product_prompt("food_cookies", "dolly", "Breaking cookie")
        assert LENS_PATTERN.search(prompt), "Missing lens spec in build_product_prompt output"


# -- build_free_prompt -------------------------------------------------------

class TestBuildFreePrompt:

    def test_enforces_2000_char_limit(self):
        long_text = "A" * 2500
        pos, neg = build_free_prompt(long_text)
        assert len(pos) <= 2000, f"Free prompt positive is {len(pos)} chars"

    def test_stability_in_positive(self):
        pos, neg = build_free_prompt("My custom product video")
        lower = pos.lower()
        has_stability = "jitter" in lower or "drift" in lower or "stable" in lower
        assert has_stability, "Free prompt missing stability keywords"

    def test_preserve_in_negative(self):
        pos, neg = build_free_prompt("My custom product video")
        assert "morphing" in neg.lower(), "Free prompt negative missing PRODUCT_PRESERVE"


# -- FEW_SHOT_EXAMPLES -------------------------------------------------------

class TestFewShotExamples:

    def test_at_least_3_archetypes(self):
        assert len(FEW_SHOT_EXAMPLES) >= 3

    def test_each_archetype_has_3_plus_examples(self):
        for archetype, examples in FEW_SHOT_EXAMPLES.items():
            assert len(examples) >= 3, f"{archetype} has only {len(examples)} examples"

    def test_examples_are_substantial(self):
        for archetype, examples in FEW_SHOT_EXAMPLES.items():
            for j, ex in enumerate(examples):
                assert len(ex) >= 200, (
                    f"{archetype}[{j}] example is only {len(ex)} chars (need 200+)"
                )
