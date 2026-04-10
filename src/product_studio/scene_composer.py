"""Scene composition — places product cutout onto clean background.

Per D-06: Gemini Image for scene generation.
Per D-07: product cutout + scene prompt -> composed image.

RULE: The product is SACRED. Never modify it. Only change the background.
"""

import asyncio
import json
import logging
import os
from io import BytesIO
from pathlib import Path

from PIL import Image
from google.genai import types

from src.llm_client import _get_client

logger = logging.getLogger("clip-flow.ads.scene_composer")


async def compose_scene(product_cutout_path: str, scene_prompt: str, output_path: str) -> str:
    """Compose product cutout onto AI-generated background via Gemini Image.

    The product must remain EXACTLY as-is. Only the background changes.
    Returns path to composed image (1080x1920 9:16).
    """
    client = _get_client()
    cutout = Image.open(product_cutout_path)
    buf = BytesIO()
    cutout.save(buf, format="PNG")

    contents = [
        types.Part.from_bytes(data=buf.getvalue(), mime_type="image/png"),
        (
            f"Create a product advertisement photo. Background scene: {scene_prompt}. "
            "\n\n"
            "ABSOLUTE RULES — violating ANY of these makes the output unusable:\n"
            "1. The product in the image must be PIXEL-PERFECT identical to the input photo. "
            "Same shape, same color, same texture, same labels, same branding, same proportions. "
            "Do NOT redesign, recolor, reshape, add to, or remove from the product.\n"
            "2. Do NOT add any humans, hands, fingers, arms, or body parts.\n"
            "3. Do NOT add any text, watermarks, logos, or overlays.\n"
            "4. The product is the ONLY subject. No other objects compete for attention.\n"
            "5. Background must be clean, professional, and subtle — it supports the product, "
            "not distracts from it.\n"
            "\n"
            "COMPOSITION:\n"
            "- Vertical 9:16 aspect ratio (1080x1920)\n"
            "- Product centered in the lower 2/3 of the frame\n"
            "- Top 1/3 is clean background (space for text overlay later)\n"
            "- Professional product photography lighting\n"
            "- Shallow depth of field on background, product in sharp focus\n"
        ),
    ]

    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash-image",
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            composed = Image.open(BytesIO(part.inline_data.data))
            composed = composed.resize((1080, 1920), Image.LANCZOS)
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            composed.save(output_path, "JPEG", quality=95)
            logger.info("Scene composed: %s", output_path)
            return output_path

    raise RuntimeError("Gemini returned no image for scene composition")


async def analyze_product(image_path: str) -> dict:
    """Per D-02: Gemini Vision analyzes product photo and suggests defaults.

    Returns dict with: niche, tone, audience, scene_suggestions, product_description.
    """
    client = _get_client()
    img = Image.open(image_path)
    buf = BytesIO()
    img.save(buf, format="JPEG")

    contents = [
        types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"),
        (
            "Analyze this product photo for a commercial video ad. "
            "Return a JSON object with exactly these fields:\n"
            '- "niche": product category (e.g., "moda", "tech", "food", "beauty", "fitness")\n'
            '- "tone": recommended advertising tone (one of: "premium", "energetico", "divertido", "minimalista", "profissional", "natural")\n'
            '- "audience": target audience description in Portuguese\n'
            '- "scene_suggestions": array of 3 BACKGROUND descriptions in English '
            "(describe ONLY the background/surface/environment — NOT the product itself, "
            "NOT hands, NOT people. Examples: 'white marble surface with soft shadows', "
            "'dark gradient backdrop with rim lighting', 'wooden table with natural sunlight')\n"
            '- "product_description": brief product description in Portuguese\n'
            "Return ONLY valid JSON, no markdown."
        ),
    ]

    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=contents,
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


# Kling element requirements (REQ-PS2-02)
KLING_MIN_PX = 300
KLING_MAX_BYTES = 10 * 1024 * 1024  # 10MB


def normalize_for_kling(input_path: str, output_path: str) -> str:
    """Resize and compress image to meet Kling element requirements.

    Requirements: min 300x300, max 10MB, JPEG format.
    Uses Pillow LANCZOS resampling (same as existing scene_composer pattern).

    Returns output_path on success.
    """
    img = Image.open(input_path).convert("RGB")
    w, h = img.size

    # Enforce minimum dimension
    if w < KLING_MIN_PX or h < KLING_MIN_PX:
        scale = max(KLING_MIN_PX / w, KLING_MIN_PX / h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Save as JPEG, reduce quality until under 10MB
    quality = 95
    while quality >= 50:
        img.save(output_path, "JPEG", quality=quality)
        if os.path.getsize(output_path) <= KLING_MAX_BYTES:
            return output_path
        quality -= 10

    # Last resort: resize to 50% and save at q=85
    w2, h2 = img.size
    img = img.resize((w2 // 2, h2 // 2), Image.LANCZOS)
    img.save(output_path, "JPEG", quality=85)
    return output_path
