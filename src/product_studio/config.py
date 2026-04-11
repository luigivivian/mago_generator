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
# and video prompts. Enriched with Skool-level prompt engineering:
# color_grade (D-27), elements (D-29/D-30), atmospheres (D-26), micro_details (D-02).
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
        "color_grade": "warm earth tones, slight desaturation, golden highlights",
        "elements": [
            "scattered chocolate chips catching light",
            "cinnamon sticks and vanilla pods",
            "fine sugar dust particles floating in backlight",
            "milk splash frozen mid-pour",
        ],
        "atmospheres": [
            "warm kitchen glow with floating flour particles",
            "cozy bakery atmosphere with steam wisps",
            "rustic farmhouse warmth with golden light rays",
        ],
        "micro_details": [
            "crumbs scattering in ultra slow-motion catching backlight",
            "chocolate chips with visible melting edge",
            "steam wisps curling through warm side light",
        ],
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
        "color_grade": "deep moody contrast, desaturated shadows, rich golden specular highlights",
        "elements": [
            "cocoa powder dusting in slow motion",
            "gold leaf fragments",
            "dark chocolate shavings",
            "glossy ganache drip",
        ],
        "atmospheres": [
            "dark moody chocolate atelier with single spotlight beam",
            "intimate candlelit dessert table atmosphere",
            "elegant patisserie counter with deep shadow pockets",
        ],
        "micro_details": [
            "glossy surface with micro-reflections shifting",
            "melted chocolate with viscous slow flow",
            "cocoa dust particles settling in beam of light",
        ],
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
        "color_grade": "bold saturated warm tones, high contrast, slight orange push",
        "elements": [
            "scattered sesame seeds",
            "fresh lettuce leaves with water droplets",
            "pickles and onion rings",
            "ketchup drizzle frozen mid-pour",
        ],
        "atmospheres": [
            "smoky grill house with haze drifting through hard light",
            "rustic burger bar with warm tungsten glow",
            "outdoor barbecue golden hour with charcoal smoke wisps",
        ],
        "micro_details": [
            "melted cheese gently jiggles and slightly stretches at edges",
            "small grease droplets forming on patty surface",
            "steam rising through side light beam",
        ],
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
        "color_grade": "clean muted warm tones, soft highlight bloom, subtle pink undertones",
        "elements": [
            "water droplets on marble",
            "flower petals scattered softly",
            "silk fabric draped in background",
            "light refracting through clear liquid",
        ],
        "atmospheres": [
            "spa-like serenity with soft diffused daylight",
            "minimalist bathroom vanity with morning light streaming in",
            "clean white studio with gentle warm fill and subtle mist",
        ],
        "micro_details": [
            "water droplets slowly forming on cool surface",
            "light caustics dancing through translucent liquid",
            "micro-bubbles rising in serum",
        ],
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
        "color_grade": "cool desaturated tones, deep blacks, faint teal undertones",
        "elements": [
            "fine dust particles floating in backlight",
            "scattered fabric threads",
            "concrete texture fragments",
            "rain droplets frozen mid-air",
        ],
        "atmospheres": [
            "dark void studio with atmospheric haze drifting through rim light",
            "urban concrete environment with moody overcast feel",
            "sleek industrial space with polished concrete and steel accents",
        ],
        "micro_details": [
            "dust particles floating through rim light beam",
            "subtle fabric fiber movement in air current",
            "micro-scratches on sole catching specular light",
        ],
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
        "color_grade": "cool neutral grade, slight blue-teal shift, clean whites",
        "elements": [
            "subtle light rays through smoke",
            "circuit board fragments as props",
            "fiber optic light strands",
            "reflective glass prisms",
        ],
        "atmospheres": [
            "dark tech showcase with faint blue ambient glow",
            "minimalist white studio with precise controlled lighting",
            "futuristic display environment with subtle neon accents",
        ],
        "micro_details": [
            "subtle screen glow pulsing with color shift",
            "micro-reflections on polished metal edges",
            "faint electromagnetic interference pattern in background",
        ],
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
        "color_grade": "vibrant saturated colors, teal-blue shadows, warm golden highlights",
        "elements": [
            "ice cubes with internal fractures catching light",
            "citrus slices with visible juice droplets",
            "condensation droplets forming",
            "fresh mint leaves with water beads",
        ],
        "atmospheres": [
            "golden hour rooftop bar with warm backlight through glassware",
            "tropical poolside setting with dappled sunlight",
            "moody cocktail lounge with dramatic single spotlight",
        ],
        "micro_details": [
            "condensation droplets slowly sliding down glass",
            "micro-bubbles rising in carbonated liquid",
            "ice cracking with internal fracture lines spreading",
        ],
    },
    "jewelry_watches": {
        "display_name": "Joias & Relogios",
        "surface": "black velvet | polished obsidian surface",
        "lighting": "single focused spotlight from above creating dramatic specular highlights on metal",
        "mood": "luxurious, precise, aspirational",
        "lens": "100mm macro, f/2.8, extreme shallow DOF",
        "hero_actions": [
            "watch crown rotating with visible mechanism",
            "gemstone catching light with prismatic refraction",
            "clasp opening in ultra slow-motion",
        ],
        "video_camera_moves": ["ultra slow orbit", "macro push-in to dial", "static with light sweep"],
        "negative": "cheap appearance, tarnished metal, flat lighting, text, watermark",
        "color_grade": "high contrast, deep blacks, warm golden specular highlights, desaturated midtones",
        "elements": [
            "crushed velvet folds catching light",
            "diamond dust particles floating",
            "reflective surface creating mirror image",
            "gold chain links as background texture",
        ],
        "atmospheres": [
            "dark jewelry vault with single dramatic spotlight beam",
            "luxury boutique display with deep velvet backdrop",
            "intimate close-up studio with pure black void surround",
        ],
        "micro_details": [
            "prismatic light refracting through gemstone facets",
            "micro-engravings on metal surface catching side light",
            "tiny mechanical movement visible through case back",
        ],
    },
    "candles_scented": {
        "display_name": "Velas & Aromas",
        "surface": "natural linen | aged wood | stone surface",
        "lighting": "warm candlelight glow as primary light source with gentle fill",
        "mood": "tranquil, aromatic, intimate",
        "lens": "85mm, f/2.8, soft dreamy bokeh",
        "hero_actions": [
            "flame flickering gently with wax pool ripple",
            "smoke wisps curling after extinguish",
            "wax melting and pooling in slow-motion",
        ],
        "video_camera_moves": ["static with gentle flame flicker", "slow push-in to flame", "dolly out revealing arrangement"],
        "negative": "harsh lighting, clinical feel, cold colors, text, watermark",
        "color_grade": "warm amber tones, soft shadows, gentle highlight bloom, slight desaturation",
        "elements": [
            "dried botanical sprigs beside candle",
            "linen fabric folds catching warm glow",
            "small ceramic dish with essential oil",
            "wooden wick ember glow",
        ],
        "atmospheres": [
            "intimate evening room with only candlelight illumination",
            "cozy reading nook with warm amber glow and soft shadows",
            "spa meditation space with multiple candle points of light",
        ],
        "micro_details": [
            "flame tip dancing with tiny wax pool ripple",
            "smoke wisps curling in slow spiral through warm air",
            "wax surface cooling with micro-texture forming",
        ],
    },
    "supplements_bottles": {
        "display_name": "Suplementos & Vitaminas",
        "surface": "clean white surface | marble counter | gym environment",
        "lighting": "bright clean key light with subtle rim separation, health-focused clean whites",
        "mood": "clean, energetic, trustworthy",
        "lens": "85mm, f/4, sharp product focus",
        "hero_actions": [
            "capsules pouring from bottle in slow-motion",
            "powder mixing into liquid with swirl patterns",
            "bottle rotating to reveal label details",
        ],
        "video_camera_moves": ["slow orbit", "push-in to label", "dolly out with lifestyle context"],
        "negative": "medical look, clinical feel, dark mood, untrustworthy feel, text, watermark",
        "color_grade": "bright clean whites, vibrant accent colors, high key, minimal shadows",
        "elements": [
            "fresh fruit slices suggesting natural ingredients",
            "scattered capsules catching rim light",
            "clear water splash suggesting purity",
            "green leaf accents for natural feel",
        ],
        "atmospheres": [
            "bright modern kitchen with morning sunlight streaming in",
            "clean gym environment with energetic natural daylight",
            "minimalist health studio with pure white backdrop and accent color",
        ],
        "micro_details": [
            "capsule surface catching micro-specular highlights",
            "powder particles dispersing in liquid with swirl patterns",
            "water droplets forming on cool bottle surface",
        ],
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
    "color_grade": "neutral balanced tones, clean whites, subtle contrast",
    "elements": [
        "subtle atmospheric haze in background",
        "clean geometric props",
        "soft fabric or paper texture",
        "gentle light rays through atmosphere",
    ],
    "atmospheres": [
        "clean studio environment with controlled lighting",
        "minimalist white space with soft shadows",
        "professional product showcase with neutral backdrop",
    ],
    "micro_details": [
        "subtle surface reflections shifting with light",
        "fine dust particles floating in rim light beam",
        "micro-texture details visible at close range",
    ],
}

# Per-shot-type stability suffixes (D-03) — appended at runtime to positive prompts.
# Replaces global VIDEO_QUALITY_SUFFIX pattern with shot-type-aware instructions.
STABILITY_SUFFIXES: dict[str, str] = {
    "static_macro": "Locked camera, no movement, no jitter, no drift, no deformation. Ultra slow motion, stable picture.",
    "dolly_out": "Smooth controlled dolly movement, no jitter, no drift, no deformation. Stable tracking, smooth motion.",
    "dolly_in": "Smooth controlled dolly push-in, no jitter, no drift, no deformation. Stable tracking, smooth motion.",
    "push_in": "Controlled dolly push-in, steady tracking, no jitter, no drift, no deformation. Stable picture.",
    "orbit": "Smooth orbital movement, no jitter, no wobble, no drift, no deformation. Controlled rotation, stable tracking.",
    "tilt_up": "Smooth controlled tilt, no jitter, no drift, no deformation. Stable vertical movement.",
    "pull_back": "Smooth controlled pull-back, no jitter, no drift, no deformation. Stable tracking.",
    "product_rotate": "Smooth product rotation, no jitter, no wobble, no deformation. Stable picture, controlled spin.",
    "crane": "Smooth crane sweep, no jitter, no drift, no deformation. Controlled vertical movement, stable picture.",
}
STABILITY_SUFFIX_DEFAULT = "Smooth motion, no jitter, no drift, no deformation. Stable picture, ultra slow motion."

# Global base negative prompt (D-08/D-12)
NEGATIVE_PROMPTS_BASE = "blurry, low quality, distorted, overexposed, underexposed, noise, grain, artifacts"

# Per-shot-type negative prompts (D-09/D-12)
NEGATIVE_PROMPTS_SHOT_TYPE: dict[str, str] = {
    "static_macro": "out of focus subject, camera shake, movement blur",
    "dolly_out": "jerky movement, speed changes, unstable tracking",
    "dolly_in": "jerky movement, speed changes, unstable tracking",
    "push_in": "jerky movement, speed changes, unstable tracking, overshoot",
    "orbit": "wobbly rotation, uneven speed, axis drift, stuttering",
    "tilt_up": "jerky vertical movement, speed changes, horizon drift",
    "pull_back": "jerky movement, speed changes, unstable pull",
    "product_rotate": "wobbly rotation, uneven spin, axis wobble",
    "crane": "jerky vertical sweep, unstable arc, speed changes",
}

# Appended to all negative prompts to prevent product alteration + ensure video stability
PRODUCT_PRESERVE_NEGATIVE = (
    "morphing product, altered label, distorted product shape, changed product color, "
    "modified packaging, different product, wrong product, deformed product, "
    "text on product changing, label text morphing, "
    "jitter, drift, deformation, flickering, unstable camera, cuts, jumps"
)

# DEPRECATED: Use STABILITY_SUFFIXES[shot_type] instead for per-shot-type stability.
# Kept for backward compatibility — Plans 02/03 migrate consumers to STABILITY_SUFFIXES.
VIDEO_QUALITY_SUFFIX = (
    "Ultra slow motion, smooth motion, no jitter, no drift, no deformation, "
    "photorealistic, premium commercial quality, stable picture"
)
