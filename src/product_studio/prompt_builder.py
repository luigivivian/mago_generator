"""Video prompt generation for product ads.

Generates prompts that describe:
1. What the product looks like (so the video model understands the image)
2. What motion/camera action to apply

Uses enriched CATEGORY_CONFIGS from config.py for deterministic quality floor,
template variable resolution, per-shot stability, and consolidated negatives.
"""

import asyncio
import logging
import random

from src.llm_client import _get_client, _extract_text
from src.product_studio.config import NEGATIVE_PROMPTS

logger = logging.getLogger("clip-flow.ads.prompt_builder")


def resolve_template_vars(
    prompt_template: str,
    category: str,
    product_ref: str,
    shot_index: int = 0,
) -> str:
    """Resolve {product}, {hero_action}, {atmosphere}, {micro_detail} in a prompt template.

    Uses category config for hero_actions, atmospheres, micro_details lists.
    Random selection provides variety across generations (per D-26).
    shot_index seeds hero_action selection so each act uses a DIFFERENT action (per D-07).
    """
    from src.product_studio.config import CATEGORY_CONFIGS, CATEGORY_DEFAULT
    cfg = CATEGORY_CONFIGS.get(category, CATEGORY_DEFAULT)

    hero_actions = cfg.get("hero_actions", ["product reveal"])
    atmospheres = cfg.get("atmospheres", ["clean professional atmosphere"])
    micro_details = cfg.get("micro_details", ["fine detail visible"])

    # Hero action: deterministic per shot_index so each act differs (per D-07)
    hero_action = hero_actions[shot_index % len(hero_actions)]
    # Atmosphere and micro_detail: random for variety across generations
    atmosphere = random.choice(atmospheres)
    micro_detail = random.choice(micro_details)

    result = prompt_template
    result = result.replace("{product}", product_ref)
    result = result.replace("{hero_action}", hero_action)
    result = result.replace("{atmosphere}", atmosphere)
    result = result.replace("{micro_detail}", micro_detail)
    # Also resolve {color_grade} if present
    color_grade = cfg.get("color_grade", "professional neutral tones")
    result = result.replace("{color_grade}", color_grade)
    return result


def build_product_prompt(
    category: str,
    camera_move: str,
    action_description: str,
    element_name: str = "prod",
    duration: int = 5,
) -> str:
    """Build a Kling-ready video prompt from category defaults + take config.

    Uses CATEGORY_CONFIGS for deterministic quality floor (per D-22).
    Resolves template variables if action_description contains them.
    Enforces 2000 char limit with smart truncation (per D-21/D-23).
    """
    from src.product_studio.config import CATEGORY_CONFIGS, CATEGORY_DEFAULT

    cfg = CATEGORY_CONFIGS.get(category, CATEGORY_DEFAULT)

    # Camera movement as full sentence (Skool pattern)
    camera_sentences = {
        "dolly": f"Camera performs a slow smooth dolly push-in toward @{element_name}, maintaining stable tracking throughout",
        "orbit": f"Camera performs a slow smooth 180-degree orbit around @{element_name}, creating parallax depth",
        "macro_zoom": f"Camera holds perfectly locked on @{element_name} in extreme macro, no movement",
        "static": f"Camera holds steady on @{element_name}, perfectly stable",
        "crane": f"Camera performs a smooth crane sweep from low to high around @{element_name}",
        "dolly_out": f"Camera performs a slow smooth dolly backward from @{element_name}, gradually revealing more environment",
        "dolly_in": f"Camera performs a slow smooth dolly push-in toward @{element_name}, stable tracking",
        "push_in": f"Camera performs a controlled dolly push-in toward @{element_name}, stable tracking",
        "tilt_up": f"Camera performs a slow controlled tilt upward revealing full @{element_name}",
        "pull_back": f"Camera performs a smooth pull-back from @{element_name}, revealing environment",
        "static_macro": f"Camera holds perfectly locked on @{element_name} in extreme macro, no movement",
        "product_rotate": f"@{element_name} rotates gently, camera holds steady",
    }
    camera_text = camera_sentences.get(camera_move, f"Camera moves smoothly around @{element_name}")

    # Build rich prompt
    parts = [
        f"Cinematic commercial shot of @{element_name} on {cfg['surface'].split('|')[0].strip()}.",
        action_description + ".",
        camera_text + ".",
        f"{cfg['lighting']}.",
        f"Shot on {cfg['lens']}, shallow depth of field with smooth bokeh.",
        f"Color grade: {cfg.get('color_grade', 'professional neutral tones')}.",
        f"{duration}s, premium commercial quality.",
    ]
    prompt = " ".join(parts)

    # Smart truncation at 2000 chars (per D-23)
    if len(prompt) > 2000:
        while len(prompt) > 2000 and len(parts) > 3:
            parts.pop(-2)  # Remove second-to-last (keep duration/quality closer)
            prompt = " ".join(parts)
        if len(prompt) > 2000:
            prompt = prompt[:1997] + "..."

    return prompt


def build_negative_prompt(category: str, shot_type: str = "") -> str:
    """Return concatenated negative prompt: shot-type -> category -> base -> PRODUCT_PRESERVE.

    Concatenation order: most specific first (per D-13).
    """
    from src.product_studio.config import (
        CATEGORY_CONFIGS, CATEGORY_DEFAULT, PRODUCT_PRESERVE_NEGATIVE,
        NEGATIVE_PROMPTS_BASE, NEGATIVE_PROMPTS_SHOT_TYPE,
    )
    parts = []
    # 1. Shot-type negatives (most specific)
    if shot_type and shot_type in NEGATIVE_PROMPTS_SHOT_TYPE:
        parts.append(NEGATIVE_PROMPTS_SHOT_TYPE[shot_type])
    # 2. Category negatives
    cfg = CATEGORY_CONFIGS.get(category, CATEGORY_DEFAULT)
    parts.append(cfg.get("negative", "blurry, low quality, text, watermark"))
    # 3. Global base
    parts.append(NEGATIVE_PROMPTS_BASE)
    # 4. Product preservation (always last)
    parts.append(PRODUCT_PRESERVE_NEGATIVE)
    return ", ".join(parts)


def build_free_prompt(
    user_prompt: str,
    shot_type: str = "",
    element_name: str = "prod",
) -> tuple[str, str]:
    """Wrap a user-written free prompt with stability suffix and negative prompt.

    Returns (positive_prompt, negative_prompt) tuple.
    Enforces 2000 char limit on positive prompt (per D-31).
    """
    from src.product_studio.config import (
        STABILITY_SUFFIXES, STABILITY_SUFFIX_DEFAULT, PRODUCT_PRESERVE_NEGATIVE,
        NEGATIVE_PROMPTS_BASE,
    )
    stability = STABILITY_SUFFIXES.get(shot_type, STABILITY_SUFFIX_DEFAULT)
    negative = f"{NEGATIVE_PROMPTS_BASE}, {PRODUCT_PRESERVE_NEGATIVE}"
    # Reserve space for " Negative: {negative}" when callers embed it into prompt
    max_positive = 2000 - len(f" Negative: {negative}") - 1
    positive = f"{user_prompt.strip()}. {stability}"
    if len(positive) > max_positive:
        positive = positive[:max_positive - 3] + "..."
    return positive, negative


async def build_video_prompt(
    product_description: str,
    scene_description: str,
    style: str,
    video_model: str,
    tone: str,
    category_hint: str = "",
) -> str:
    """Generate a video motion prompt via Gemini.

    Returns a clean prompt (400-500 chars) describing product + motion.
    Uses pro-level system instruction with Skool patterns (per D-14/D-17).
    Injects FEW_SHOT_EXAMPLES when category maps to a known archetype.
    """
    from src.product_studio.config import FEW_SHOT_EXAMPLES

    client = _get_client()
    from google.genai import types

    # Map category to archetype for few-shot selection
    archetype_map = {
        "food_cookies": "food", "food_chocolate": "food", "food_burger": "food",
        "beauty_skincare": "beauty", "fashion_shoes": "lifestyle", "tech_electronics": "tech",
        "beverage": "lifestyle", "jewelry_watches": "beauty", "candles_scented": "lifestyle",
        "supplements_bottles": "lifestyle",
    }

    contents = (
        f"Product: {product_description}\n"
        f"Background: {scene_description}\n"
        f"Style: {style}, Tone: {tone}\n\n"
        "Write a VIDEO MOTION prompt in 400-500 characters.\n"
        "Sentence 1: Describe the product appearance in detail (colors, shape, material, texture).\n"
        "Sentence 2: Camera movement as FULL SENTENCE ('Camera performs a slow smooth dolly backward...').\n"
        "Sentence 3: Physics micro-details ('condensation droplets forming', 'oil shimmers with heat').\n"
        "Sentence 4: Lens spec + atmosphere ('Shot on 85mm f/2.8, faint atmospheric haze').\n"
        "NO humans, hands, or body parts. Product is the only subject."
    )

    # Inject few-shot examples when archetype available
    archetype = archetype_map.get(category_hint, "lifestyle") if category_hint else None
    if archetype and archetype in FEW_SHOT_EXAMPLES:
        examples = FEW_SHOT_EXAMPLES[archetype][:3]
        examples_text = "\n\nExample prompts for this category:\n" + "\n---\n".join(examples)
        contents += examples_text

    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are an expert video prompt engineer for AI image-to-video models (Kling, Runway). "
                "Write prompts using these professional patterns:\n"
                "1. CAMERA as full sentence: 'Camera performs a slow smooth dolly backward, gradually revealing...'\n"
                "2. PHYSICS micro-details: 'melted cheese gently jiggles', 'condensation droplets forming', 'oil shimmers with heat'\n"
                "3. LENS + DOF: Always end with specific lens (85mm, 100mm macro) and aperture (f/2.8)\n"
                "4. STABILITY: Include 'no jitter, no drift, no deformation, stable picture'\n"
                "5. COLOR GRADE: Describe the color grading ('warm earth tones, slight desaturation')\n"
                "6. ATMOSPHERE: 'faint atmospheric haze', 'wisps of steam through backlight'\n\n"
                "Output ONLY the prompt text. No quotes, no labels. 400-500 characters. "
                "Product referenced ONLY via @prod element — describe the SCENE, not the product."
            ),
            max_output_tokens=800,
            temperature=0.5,
        ),
    )

    prompt = _extract_text(response).strip()
    # Clean up formatting
    prompt = prompt.replace("\n\n", " ").replace("\n", " ").strip()
    if prompt.startswith('"') and prompt.endswith('"'):
        prompt = prompt[1:-1]

    # Ensure ends with period
    if not prompt.endswith("."):
        last_period = prompt.rfind(".")
        if last_period > 50:
            prompt = prompt[:last_period + 1]
        else:
            prompt += "."

    # Safety cap at 2000 chars
    if len(prompt) > 2000:
        cut = prompt[:2000].rfind(".")
        prompt = prompt[:cut + 1] if cut > 200 else prompt[:2000]

    logger.info("Video prompt (%d chars): %s", len(prompt), prompt[:150])
    return prompt


def get_negative_prompt(style: str) -> str:
    """Get the negative prompt for a given style."""
    return NEGATIVE_PROMPTS.get(style, NEGATIVE_PROMPTS["cinematic"])
