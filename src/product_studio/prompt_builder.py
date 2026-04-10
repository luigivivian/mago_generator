"""Video prompt generation for product ads.

Generates prompts that describe:
1. What the product looks like (so the video model understands the image)
2. What motion/camera action to apply
"""

import asyncio
import logging

from src.llm_client import _get_client, _extract_text
from src.product_studio.config import NEGATIVE_PROMPTS

logger = logging.getLogger("clip-flow.ads.prompt_builder")


async def build_video_prompt(
    product_description: str,
    scene_description: str,
    style: str,
    video_model: str,
    tone: str,
) -> str:
    """Generate a video motion prompt via Gemini.

    Returns a clean prompt (2-4 sentences) describing product + motion.
    """
    client = _get_client()
    from google.genai import types

    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=(
            f"Product: {product_description}\n"
            f"Background: {scene_description}\n"
            f"Style: {style}, Tone: {tone}\n\n"
            "Write a VIDEO MOTION prompt in 2-3 sentences.\n"
            "Sentence 1: Describe the product appearance in detail (colors, shape, material, texture).\n"
            "Sentence 2: Describe camera movement (orbital, dolly, tracking, etc).\n"
            "Sentence 3 (optional): Describe lighting and atmosphere.\n"
            "NO humans, hands, or body parts. Product is the only subject."
        ),
        config=types.GenerateContentConfig(
            system_instruction=(
                "You write video motion prompts for AI image-to-video models. "
                "Be specific about the product appearance so the model understands what's in the image. "
                "Output ONLY the prompt text. No quotes, no labels, no formatting."
            ),
            max_output_tokens=1500,
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

    # Safety cap at 2200 chars (below Kling 3.0's 2500 limit, the strictest model)
    if len(prompt) > 2200:
        cut = prompt[:2200].rfind(".")
        prompt = prompt[:cut + 1] if cut > 200 else prompt[:2200]

    logger.info("Video prompt (%d chars): %s", len(prompt), prompt[:150])
    return prompt


def get_negative_prompt(style: str) -> str:
    """Get the negative prompt for a given style."""
    return NEGATIVE_PROMPTS.get(style, NEGATIVE_PROMPTS["cinematic"])


def build_product_prompt(
    category: str,
    camera_move: str,
    action_description: str,
    element_name: str = "prod",
    duration: int = 5,
) -> str:
    """Build a Kling-ready video prompt from category defaults + take config.

    Uses CATEGORY_CONFIGS for deterministic quality floor, then layers
    the user's action description and camera move on top.

    Args:
        category: Key from CATEGORY_CONFIGS (e.g., "food_cookies").
        camera_move: Camera move name (dolly, orbit, macro_zoom, static, crane).
        action_description: User-editable action text for this take.
        element_name: Kling element reference name (short, budgets 37 chars).
        duration: Take duration in seconds.

    Returns:
        Prompt string under 463 chars (500 Kling limit - 37 for @element).
    """
    from src.product_studio.config import CATEGORY_CONFIGS, CATEGORY_DEFAULT

    cfg = CATEGORY_CONFIGS.get(category, CATEGORY_DEFAULT)

    # Map camera_move names to natural language
    camera_map = {
        "dolly": "slow dolly push-in",
        "orbit": "slow orbit around subject",
        "macro_zoom": "extreme macro with slow zoom",
        "static": "static shot",
        "crane": "crane sweep",
    }
    camera_text = camera_map.get(camera_move, camera_move)

    parts = [
        f"Cinematic commercial shot of @{element_name}",
        f"on {cfg['surface'].split('|')[0].strip()}.",
        action_description + ".",
        f"Camera: {camera_text}.",
        f"{cfg['lighting']}.",
        f"Mood: {cfg['mood']}.",
        f"Shot with {cfg['lens']}.",
        f"{duration}s.",
        "4K, commercial quality.",
    ]
    prompt = " ".join(parts)

    # Enforce 463 char limit (500 - 37 for @element overhead)
    if len(prompt) > 463:
        prompt = prompt[:460] + "..."

    return prompt


def build_negative_prompt(category: str) -> str:
    """Return negative prompt for the given category."""
    from src.product_studio.config import CATEGORY_CONFIGS, CATEGORY_DEFAULT
    cfg = CATEGORY_CONFIGS.get(category, CATEGORY_DEFAULT)
    return cfg.get("negative", "blurry, low quality, text, watermark")
