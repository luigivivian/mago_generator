"""Product Studio configuration constants with env var fallback."""

import os

# Feature flag
ADS_ENABLED = os.getenv("ADS_ENABLED", "false").lower() == "true"

# Output
ADS_OUTPUT_DIR = os.getenv("ADS_OUTPUT_DIR", "output/ads")

# Cost tracking (USD to BRL)
ADS_USD_TO_BRL = float(os.getenv("ADS_USD_TO_BRL", "5.75"))

# Background removal model
ADS_REMBG_MODEL = os.getenv("ADS_REMBG_MODEL", "u2net")

# Video defaults
ADS_DEFAULT_VIDEO_MODEL = os.getenv("ADS_DEFAULT_VIDEO_MODEL", "wan/2-6-flash-image-to-video")
ADS_DEFAULT_STYLE = os.getenv("ADS_DEFAULT_STYLE", "cinematic")

# Master format (per D-17)
ADS_MASTER_FORMAT = "9:16"

# Export formats (per D-18)
ADS_EXPORT_FORMATS = ["9:16", "16:9", "1:1"]

# Image dimensions
ADS_IMAGE_WIDTH = 1080
ADS_IMAGE_HEIGHT = 1920

# Step order for pipeline (per D-21)
ADS_STEP_ORDER = ["analysis", "scene", "prompt", "video", "copy", "audio", "assembly", "export"]

# Music genre mapping (per design doc MUSIC_MAP)
MUSIC_MAP = {
    "premium": "cinematic ambient piano, luxury, elegant",
    "energetico": "upbeat electronic, energetic, dynamic",
    "divertido": "happy pop, cheerful, playful",
    "minimalista": "minimal ambient, subtle, clean",
    "profissional": "corporate, modern, confident",
    "natural": "acoustic guitar, warm, organic",
}

# Negative prompts by style
NEGATIVE_PROMPTS = {
    "cinematic": "text, watermark, logo, blurry, low quality, distorted product, human hands, person",
    "narrated": "text, watermark, logo, blurry, low quality, distorted product, nudity",
    "lifestyle": "text, watermark, logo, blurry, low quality, distorted product, nudity, gore",
}

# Text overlay layout by style
TEXT_LAYOUTS = {
    "cinematic": {"headline_y": 0.12, "cta_y": 0.88, "fontsize_h": 52, "fontsize_cta": 36},
    "narrated": {"headline_y": None, "cta_y": 0.90, "fontsize_h": 0, "fontsize_cta": 32},
    "lifestyle": {"headline_y": 0.08, "cta_y": 0.92, "fontsize_h": 40, "fontsize_cta": 28},
}

# Style -> scene count mapping (per D-09)
STYLE_SCENE_COUNT = {"cinematic": 1, "narrated": 4, "lifestyle": 5}

# Style -> audio mode defaults (per D-14)
STYLE_AUDIO_DEFAULTS = {"cinematic": "music", "narrated": "narrated", "lifestyle": "ambient"}

# Style -> duration range (per design doc)
STYLE_DURATION = {"cinematic": (8, 15), "narrated": (15, 30), "lifestyle": (15, 30)}

# Style -> default video model (per D-08)
STYLE_VIDEO_MODEL = {"cinematic": "wan/2-6-image-to-video", "narrated": "wan/2-6-flash-image-to-video", "lifestyle": "kling/v2-1-standard"}


# V2 cinematic multi-scene ads pipeline — category-aware prompt templates.
# Each entry provides a deterministic quality floor for AI-generated scenes
# and video prompts (see guia-producao-visual-ai-produtos.md sections 3.1-3.7).
CATEGORY_CONFIGS: dict[str, dict] = {
    "food_cookies": {
        "display_name": "Cookies & Biscoitos",
        "surface": "dark slate | marble | rustic wood",
        "lighting": "dramatic side lighting with warm backlight rim",
        "mood": "warm, indulgent, appetizing",
        "lens": "100mm macro, f/2.8",
        "hero_actions": [
            "cookie breaking in half revealing gooey center",
            "chocolate chips melting in slow motion",
            "crumbs scattering in ultra slow-motion catching warm backlight",
        ],
        "video_camera_moves": ["slow dolly push-in", "static with slow zoom", "macro tracking"],
        "negative": "plastic look, flat lighting, cluttered, text, watermark",
    },
    "food_chocolate": {
        "display_name": "Chocolates & Confeitaria",
        "surface": "marble slab | white ceramic plate | dark elegant surface",
        "lighting": "single dramatic spotlight from above-left creating deep shadows",
        "mood": "luxurious, elegant, indulgent",
        "lens": "85mm, f/2.8, shallow depth of field",
        "hero_actions": [
            "melted chocolate pouring in slow-motion over truffles",
            "chocolate lava center flowing out",
            "glossy chocolate drip patterns forming",
        ],
        "video_camera_moves": ["static with very slow zoom-in", "slow dolly push-in", "overhead crane down"],
        "negative": "cheap appearance, flat lighting, blurry, text, watermark",
    },
    "food_burger": {
        "display_name": "Hamburgueres & Fast Food",
        "surface": "rustic wooden board | dark moody background",
        "lighting": "dramatic side lighting, steam rising from patty",
        "mood": "bold, appetizing, juicy",
        "lens": "85mm, f/2.8, sharp focus on cheese drip",
        "hero_actions": [
            "hands pressing down on bun with juices flowing",
            "cheese melting and dripping in slow-motion",
            "burger cut in half revealing all layers",
        ],
        "video_camera_moves": ["slow dolly push-in", "low angle slight tilt up", "static with slow zoom"],
        "negative": "flat lighting, cluttered, unappetizing, text, watermark",
    },
    "beauty_skincare": {
        "display_name": "Cosmeticos & Skincare",
        "surface": "wet marble surface with water droplets | clean minimalist",
        "lighting": "soft natural window light from left, gentle highlights on glass",
        "mood": "clean, aspirational, elegant",
        "lens": "85mm, f/4, sharp product focus with soft background blur",
        "hero_actions": [
            "serum drop falling in ultra slow-motion creating concentric ripples",
            "cream texture spreading smoothly on surface",
            "light refracting through liquid creating golden caustics",
        ],
        "video_camera_moves": ["static eye-level macro", "slow orbit around product", "gentle crane up"],
        "negative": "harsh lighting, cluttered background, cheap appearance, text, watermark",
    },
    "fashion_shoes": {
        "display_name": "Tenis & Calcados",
        "surface": "dark gradient background charcoal to black | floating mid-air",
        "lighting": "three-point: key upper-left, rim highlighting sole, fill from right",
        "mood": "dynamic, premium, athletic",
        "lens": "85mm, f/5.6, full product in focus",
        "hero_actions": [
            "sneaker rotating mid-air with dust particles floating",
            "dynamic impact landing with particles scattering",
            "lace detail macro with texture reveal",
        ],
        "video_camera_moves": ["slow orbit", "dolly push-in to sole detail", "crane sweep low to high"],
        "negative": "flat lighting, static pose, blurry, text, watermark",
    },
    "tech_electronics": {
        "display_name": "Eletronicos & Tech",
        "surface": "reflective dark surface | clean studio environment",
        "lighting": "soft diffused key light, subtle rim light on edges highlighting metal frame",
        "mood": "premium, sleek, innovative",
        "lens": "85mm, f/4, sharp across entire device",
        "hero_actions": [
            "device floating at 30-degree angle with screen glow",
            "finger touching screen with responsive UI animation",
            "device rotating to reveal thin profile and material finish",
        ],
        "video_camera_moves": ["slow orbit", "dolly push-in", "static with gentle float animation"],
        "negative": "fingerprints, dust, uncontrolled reflections, text, watermark",
    },
    "beverage": {
        "display_name": "Bebidas & Drinks",
        "surface": "bar counter | outdoor terrace in golden hour bokeh",
        "lighting": "golden hour backlight creating warm glow through liquid",
        "mood": "refreshing, vibrant, lifestyle",
        "lens": "50mm, f/2.8, focus on glass with creamy bokeh",
        "hero_actions": [
            "liquid pouring into glass with ice cubes splashing",
            "condensation droplets forming on glass surface",
            "garnish dropping into drink creating ripples",
        ],
        "video_camera_moves": ["static with slow zoom", "dolly push-in", "low angle tilt up through glass"],
        "negative": "flat lighting, dirty glass, unappealing color, text, watermark",
    },
}

# Fallback for unknown categories
CATEGORY_DEFAULT = {
    "display_name": "Generic Product",
    "surface": "clean surface | studio backdrop",
    "lighting": "soft studio lighting, three-point setup",
    "mood": "professional, clean, commercial",
    "lens": "85mm, f/4",
    "hero_actions": ["product reveal", "detail showcase", "lifestyle context"],
    "video_camera_moves": ["slow dolly push-in", "static with slow zoom", "gentle orbit"],
    "negative": "blurry, low quality, text, watermark",
}
