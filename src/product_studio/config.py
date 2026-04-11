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
        "color_grade": "Warm earth tones, slight desaturation, golden highlights",
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
        "color_grade": "Deep moody contrast, desaturated shadows, rich golden specular highlights",
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
        "color_grade": "Bold saturated warm tones, high contrast, slight orange push",
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
        "color_grade": "Clean muted warm tones, soft highlight bloom, subtle pink undertones",
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
        "color_grade": "Cool desaturated tones, deep blacks, faint teal undertones",
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
        "color_grade": "Cool neutral grade, slight blue-teal shift, clean whites",
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
        "color_grade": "Vibrant saturated colors, teal-blue shadows, warm golden highlights",
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
        "color_grade": "High contrast, deep blacks, warm golden specular highlights, desaturated midtones",
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
        "color_grade": "Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation",
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
        "color_grade": "Bright clean whites, vibrant accent colors, high key, minimal shadows",
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
    "color_grade": "Neutral balanced tones, clean whites, subtle contrast",
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


# 3-Act shot plan structure per category — Skool-level professional prompts.
# Each prompt is 400-500 chars with: scene setup, camera-as-sentence, lighting action,
# physics micro-detail via {micro_detail}, atmosphere via {atmosphere}, lens+DOF,
# and literal color grade identity string for cross-shot coherence (D-27).
# Template variables: {product}, {hero_action}, {atmosphere}, {micro_detail}
# Stability suffixes are NOT in prompts — appended at runtime from STABILITY_SUFFIXES.
SHOT_PLANS: dict[str, list[dict]] = {
    "food_cookies": [
        {"name": "Macro texture reveal", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on dark weathered slate surface, {micro_detail}. Camera holds perfectly locked on subject, capturing every crumb and texture ridge in sharp detail. Warm side light rakes across at low angle, {atmosphere}. {hero_action}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field with smooth circular bokeh. Warm earth tones, slight desaturation, golden highlights."},
        {"name": "Hero action moment", "duration": 5, "camera": "static_macro",
         "prompt": "Close-up of {product} on rustic wood surface, {hero_action}. Camera holds steady locked on the action, warm dramatic backlight rim creates golden halo around subject. {micro_detail}. Side light catches scattered chocolate chips and cinnamon sticks. Shot on 100mm macro lens, f/2.8, ultra shallow depth of field. Warm earth tones, slight desaturation, golden highlights. {atmosphere}."},
        {"name": "Pull back context reveal", "duration": 5, "camera": "dolly_out",
         "prompt": "Camera performs a slow smooth dolly backward from {product}, gradually revealing full arrangement on dark slate surface with scattered props catching warm light. {atmosphere}. Fine sugar dust particles float through backlight beam, {micro_detail}. Warm side light rakes across textures. Shot on 85mm lens, f/2.8, shallow depth of field with creamy bokeh. Warm earth tones, slight desaturation, golden highlights."},
        {"name": "Hero shot with text space", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on dark surface, generous negative space in upper third for text overlay. {hero_action}. Three-point lighting with dramatic warm key from left side, {atmosphere}. {micro_detail}. Shot on 85mm lens, f/4, medium depth of field keeping product sharp against soft background. Warm earth tones, slight desaturation, golden highlights."},
        {"name": "Overhead detail B-roll", "duration": 5, "camera": "crane",
         "prompt": "Overhead bird's eye view looking down at {product} arrangement on dark slate, camera performs gentle crane descent toward the surface. {micro_detail}. Scattered vanilla pods and chocolate chips as environmental props, {atmosphere}. Warm backlight creates long shadows across the flat lay composition. Shot on 50mm lens, f/4, moderate depth of field. Warm earth tones, slight desaturation, golden highlights."},
    ],
    "food_chocolate": [
        {"name": "Glossy macro reveal", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on polished dark marble slab, {micro_detail}. Camera holds perfectly locked capturing glossy chocolate surface with micro-reflections shifting. Single dramatic spotlight from above-left creates deep shadows and specular highlights. {atmosphere}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Deep moody contrast, desaturated shadows, rich golden specular highlights."},
        {"name": "Melt action moment", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} on dark elegant surface, {hero_action}. Dramatic single spotlight creates pools of light and deep shadow. Cocoa powder dusting and gold leaf fragments catch the light beam. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, shallow depth of field with smooth bokeh. Deep moody contrast, desaturated shadows, rich golden specular highlights."},
        {"name": "Pull back luxe reveal", "duration": 5, "camera": "dolly_out",
         "prompt": "Camera performs slow smooth dolly backward from {product}, gradually revealing elegant arrangement on marble slab. {atmosphere}. Dark chocolate shavings and glossy ganache drip as environmental props catching spotlight. {micro_detail}. Single dramatic key light from above-left with deep surrounding shadows. Shot on 85mm lens, f/2.8, depth of field widens through movement. Deep moody contrast, desaturated shadows, rich golden specular highlights."},
        {"name": "Hero shot with text space", "duration": 5, "camera": "static_macro",
         "prompt": "Close-up of {product} centered on dark surface with generous negative space above for text overlay. Camera holds locked on subject. {hero_action}. Single dramatic spotlight isolates product in pool of warm light surrounded by deep shadow. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/4, product sharp against dark void background. Deep moody contrast, desaturated shadows, rich golden specular highlights."},
    ],
    "food_burger": [
        {"name": "Juice macro reveal", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme close-up of {product} on rustic wooden board, {micro_detail}. Camera holds perfectly locked on subject. Dramatic hard side light catches juices and melting cheese with bright specular highlights, {atmosphere}. Ketchup drizzle and scattered sesame seeds as foreground props. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Bold saturated warm tones, high contrast, slight orange push."},
        {"name": "Cheese action moment", "duration": 5, "camera": "static_macro",
         "prompt": "Close-up of {product} on dark surface, {hero_action}. Camera holds steady locked on the action moment. Dramatic warm side light rakes across creating bold highlights on melting cheese. {micro_detail}. Fresh lettuce leaves with water droplets and pickles as environmental elements. {atmosphere}. Shot on 85mm lens, f/2.8, ultra shallow depth of field. Bold saturated warm tones, high contrast, slight orange push."},
        {"name": "Pull back reveal", "duration": 5, "camera": "dolly_out",
         "prompt": "Camera performs slow smooth dolly backward from {product}, gradually revealing full scene on rustic wood surface. {atmosphere}. Scattered sesame seeds and fresh lettuce leaves catch warm side light. {micro_detail}. Dramatic side lighting creates bold shadows and warm highlights across the scene. Shot on 85mm lens, f/2.8, depth of field opening through movement with creamy bokeh. Bold saturated warm tones, high contrast, slight orange push."},
        {"name": "Hero shot with text space", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on dark surface, generous negative space in upper third for text overlay. {hero_action}. All layers visible with bold dramatic side lighting from left. {micro_detail}. {atmosphere}. Shot on 50mm lens, f/4, medium depth of field keeping entire burger sharp. Bold saturated warm tones, high contrast, slight orange push."},
        {"name": "Overhead hero B-roll", "duration": 5, "camera": "crane",
         "prompt": "Overhead bird's eye view looking down at {product} on rustic board, camera performs gentle crane descent. {micro_detail}. Scattered sesame seeds, fresh lettuce, pickles and onion rings arranged around the subject. {atmosphere}. Dramatic warm top light creates bold defined shadows on the flat lay. Shot on 35mm lens, f/5.6, deep focus. Bold saturated warm tones, high contrast, slight orange push."},
    ],
    "beauty_skincare": [
        {"name": "Detail texture reveal", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on wet polished marble surface, {micro_detail}. Camera holds perfectly locked capturing glass texture and label detail. Soft natural window light from left creates gentle highlights on glass surface. Water droplets on marble and flower petals as environmental props, {atmosphere}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Clean muted warm tones, soft highlight bloom, subtle pink undertones."},
        {"name": "Context orbit reveal", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs slow smooth 180-degree orbit around {product} on wet marble surface, gradually revealing full arrangement with silk fabric draped in background. {hero_action}. Soft diffused daylight creates gentle wraparound illumination with subtle rim separation. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, shallow depth of field with creamy smooth bokeh. Clean muted warm tones, soft highlight bloom, subtle pink undertones."},
        {"name": "Hero shot push-in", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on clean marble surface, generous negative space above for text overlay. {hero_action}. Soft natural light from upper left with gentle fill creating luminous glow on glass surfaces. {micro_detail}. Light refracting through clear liquid creates soft caustic patterns. {atmosphere}. Shot on 85mm lens, f/4, product sharp. Clean muted warm tones, soft highlight bloom, subtle pink undertones."},
    ],
    "fashion_shoes": [
        {"name": "Detail texture reveal", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} material texture and sole detail, {micro_detail}. Camera holds perfectly locked on subject. Three-point lighting with bright rim light highlighting material edges and texture weave. Fine dust particles floating in backlight against dark gradient background charcoal to black. {atmosphere}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Cool desaturated tones, deep blacks, faint teal undertones."},
        {"name": "Dynamic dolly reveal", "duration": 5, "camera": "dolly_out",
         "prompt": "Camera performs slow smooth dolly backward from {product} floating mid-air, gradually revealing full silhouette against dark gradient background. {hero_action}. Bright rim light from behind highlights sole and edges separating from black void. Scattered fabric threads and concrete texture fragments as props. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/5.6, moderate depth of field. Cool desaturated tones, deep blacks, faint teal undertones."},
        {"name": "Hero shot orbital", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs slow smooth orbit around {product}, three-point lighting with key from upper-left and rim from behind highlighting material finish. {hero_action}. Fine dust particles floating through backlight beam, {atmosphere}. Camera settles on three-quarter profile against dark void. {micro_detail}. Shot on 85mm lens, f/5.6, full product in focus with dark bokeh. Cool desaturated tones, deep blacks, faint teal undertones."},
    ],
    "tech_electronics": [
        {"name": "Screen glow detail", "duration": 5, "camera": "static_macro",
         "prompt": "Close-up of {product} at three-quarter angle on reflective dark surface, {micro_detail}. Camera holds perfectly locked on subject. Soft diffused key light from above with subtle rim light tracing metal edges. Screen glow casts colored light on reflective surface below, subtle light rays through faint atmosphere. {atmosphere}. Shot on 85mm lens, f/4, shallow depth of field. Cool neutral grade, slight blue-teal shift, clean whites."},
        {"name": "Profile orbit reveal", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs slow smooth orbit revealing thin profile of {product} on reflective dark polished surface. {hero_action}. Subtle rim light traces every metal edge and chamfer as camera moves. Reflective glass prisms and fiber optic light strands as environmental elements, {micro_detail}. {atmosphere}. Shot on 100mm telephoto lens, f/4, compressed background to pure black. Cool neutral grade, slight blue-teal shift, clean whites."},
        {"name": "Hero shot push-in", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on reflective dark surface, generous negative space above for text overlay. Soft overhead diffused lighting with subtle rim light on edges creating clean separation. {hero_action}. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/4, sharp across entire device with clean minimalist composition. Cool neutral grade, slight blue-teal shift, clean whites."},
    ],
    "beverage": [
        {"name": "Condensation macro", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on bar counter surface, {micro_detail}. Camera holds perfectly locked on subject capturing condensation detail. Golden hour backlight creates warm glow through liquid with bright specular highlights on droplets. Ice cubes with internal fractures and citrus slices as props, {atmosphere}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Vibrant saturated colors, teal-blue shadows, warm golden highlights."},
        {"name": "Splash context reveal", "duration": 6, "camera": "dolly_out",
         "prompt": "Camera performs slow smooth dolly backward from {product}, gradually revealing full bar counter scene. {hero_action}. Golden hour backlight streams through liquid creating warm caustics on surface. Fresh mint leaves with water beads and citrus slices as environmental elements, {micro_detail}. {atmosphere}. Shot on 50mm lens, f/2.8, creamy bokeh in widening background. Vibrant saturated colors, teal-blue shadows, warm golden highlights."},
        {"name": "Hero shot orbital", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs slow smooth orbit around {product} on reflective wet bar surface, settling on front label. {hero_action}. Cool blue-white backlight with warm golden rim creates refreshing atmosphere. Condensation droplets catch specular highlights as camera moves. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, shallow depth of field with smooth bokeh. Vibrant saturated colors, teal-blue shadows, warm golden highlights."},
    ],
    "jewelry_watches": [
        {"name": "Gemstone macro detail", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on black velvet surface, {micro_detail}. Camera holds perfectly locked capturing metalwork and gemstone facets. Single focused spotlight from above creates dramatic specular highlights on polished metal. Crushed velvet folds and diamond dust particles floating in light beam, {atmosphere}. Shot on 100mm macro lens, f/2.8, extreme shallow depth of field. High contrast, deep blacks, warm golden specular highlights, desaturated midtones."},
        {"name": "Orbit luxury reveal", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs ultra slow smooth orbit around {product} on polished obsidian surface, gradually revealing every angle and facet. {hero_action}. Single dramatic spotlight sweeps across creating moving specular highlights on metal. Reflective surface creates mirror image below, {micro_detail}. {atmosphere}. Shot on 100mm macro lens, f/2.8, shallow depth of field. High contrast, deep blacks, warm golden specular highlights, desaturated midtones."},
        {"name": "Hero shot push-in", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on black velvet, generous negative space above for text overlay. {hero_action}. Single focused spotlight creates dramatic pool of warm light surrounded by pure black void. Gold chain links as background texture, {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, shallow depth of field. High contrast, deep blacks, warm golden specular highlights, desaturated midtones."},
    ],
    "candles_scented": [
        {"name": "Flame macro detail", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on natural linen surface, {micro_detail}. Camera holds perfectly locked capturing flame and wax pool detail. Warm candlelight glow serves as primary light source with gentle ambient fill. Dried botanical sprigs and ceramic dish as environmental props, {atmosphere}. Shot on 100mm macro lens, f/2.8, paper-thin depth of field with warm circular bokeh. Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation."},
        {"name": "Push-in to flame", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} on aged wood surface, focusing on flickering flame. {hero_action}. Warm candlelight creates intimate pools of amber light with soft deep shadows. Linen fabric folds catching warm glow and wooden wick ember as props, {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, shallow depth of field with dreamy warm bokeh. Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation."},
        {"name": "Dolly out arrangement reveal", "duration": 5, "camera": "dolly_out",
         "prompt": "Camera performs slow smooth dolly backward from {product}, gradually revealing full candle arrangement on stone surface. {hero_action}. Multiple candlelight points create warm layered illumination with deep shadow pockets. Dried botanicals and linen texture as environmental dressing, {micro_detail}. {atmosphere}. Shot on 85mm lens, f/2.8, depth of field widens through movement. Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation."},
    ],
    "supplements_bottles": [
        {"name": "Label detail macro", "duration": 5, "camera": "static_macro",
         "prompt": "Extreme macro of {product} on clean white marble surface, {micro_detail}. Camera holds perfectly locked capturing label detail and bottle surface. Bright clean key light from above with subtle rim separation creating health-focused clean aesthetic. Fresh fruit slices and scattered capsules as environmental props, {atmosphere}. Shot on 100mm macro lens, f/4, sharp product focus. Bright clean whites, vibrant accent colors, high key, minimal shadows."},
        {"name": "Orbit lifestyle reveal", "duration": 5, "camera": "orbit",
         "prompt": "Camera performs slow smooth orbit around {product} on marble counter, gradually revealing lifestyle context. {hero_action}. Bright natural daylight creates clean energetic atmosphere with minimal shadows. Green leaf accents and clear water elements for natural wellness feel, {micro_detail}. {atmosphere}. Shot on 85mm lens, f/4, moderate depth of field with clean background separation. Bright clean whites, vibrant accent colors, high key, minimal shadows."},
        {"name": "Hero shot push-in", "duration": 5, "camera": "push_in",
         "prompt": "Camera performs slow controlled push-in toward {product} centered on clean surface, generous negative space above for text overlay. {hero_action}. Bright overhead key light with subtle warm rim creates trustworthy clean presentation. Scattered capsules catching rim light, {micro_detail}. {atmosphere}. Shot on 85mm lens, f/4, sharp product focus with clean minimalist composition. Bright clean whites, vibrant accent colors, high key, minimal shadows."},
    ],
}

# Generic fallback shot plan — used when category not in SHOT_PLANS
SHOT_PLAN_DEFAULT = [
    {"name": "Detail reveal", "duration": 5, "camera": "static_macro",
     "prompt": "Extreme macro of {product} on clean neutral surface, {micro_detail}. Camera holds perfectly locked on subject capturing texture and label detail. Soft key light from upper-left with subtle rim from behind creating clean separation. Subtle atmospheric haze in background. {atmosphere}. Shot on 100mm macro lens, f/2.8, shallow depth of field with smooth circular bokeh. Neutral balanced tones, clean whites, subtle contrast."},
    {"name": "Context dolly reveal", "duration": 5, "camera": "dolly_out",
     "prompt": "Camera performs slow smooth dolly backward from {product}, gradually revealing full studio environment with clean geometric props. {hero_action}. Consistent three-point lighting with soft key, gentle fill, and subtle rim separation. {micro_detail}. {atmosphere}. Shot on 85mm lens, f/4, medium depth of field widening through movement with smooth bokeh. Neutral balanced tones, clean whites, subtle contrast."},
    {"name": "Hero shot push-in", "duration": 5, "camera": "push_in",
     "prompt": "Camera performs slow controlled push-in toward {product} centered on clean surface, generous negative space above for text overlay. {hero_action}. Perfect three-point studio lighting creates professional commercial presentation. {micro_detail}. Soft fabric or paper texture as environmental dressing. {atmosphere}. Shot on 85mm lens, f/4, sharp across subject with clean minimalist composition. Neutral balanced tones, clean whites, subtle contrast."},
]


# Few-shot examples per category archetype (D-15) — used for Gemini fallback
# when generating prompts for unknown/custom categories. Each example demonstrates
# the Skool-level prompt pattern for its archetype.
FEW_SHOT_EXAMPLES: dict[str, list[str]] = {
    "food": [
        "Extreme macro of artisan sourdough bread on dark weathered slate surface, crumbs scattering in ultra slow-motion catching warm backlight. Camera holds perfectly locked on subject, capturing every crust ridge and flour dusting in sharp detail. Warm side light rakes across at low angle creating long textured shadows. Steam wisps curl through the warm golden light beam. Shot on 100mm macro lens, f/2.8, paper-thin depth of field with smooth circular bokeh. Warm earth tones, slight desaturation, golden highlights.",
        "Camera performs slow smooth dolly backward from golden croissant on marble surface, gradually revealing full patisserie arrangement with scattered almond flakes and powdered sugar. Cozy bakery atmosphere with morning light streaming through window. Butter pooling at base with glossy specular highlights catching backlight. Shot on 85mm lens, f/2.8, shallow depth of field with creamy bokeh widening through movement. Warm earth tones, slight desaturation, golden highlights.",
        "Overhead bird's eye view looking down at gourmet pizza on rustic wooden board, camera performs gentle crane descent toward the surface. Melted mozzarella stretches with visible cheese strands between slices. Fresh basil leaves and cherry tomatoes scattered as props. Warm top light creates defined shadows on the flat lay composition. Shot on 35mm lens, f/5.6, deep focus across entire arrangement. Bold saturated warm tones, high contrast, slight orange push.",
    ],
    "beauty": [
        "Extreme macro of luxury serum bottle on wet polished marble surface, water droplets slowly forming on cool glass with micro-specular reflections. Camera holds perfectly locked capturing glass texture and gold cap detail. Soft natural window light from left creates gentle luminous highlights on glass surface. Flower petals and silk fabric draped elegantly in soft background. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Clean muted warm tones, soft highlight bloom, subtle pink undertones.",
        "Camera performs slow smooth 180-degree orbit around moisturizer jar on marble pedestal, light caustics dancing through translucent product as angle shifts. Soft diffused daylight creates gentle wraparound illumination with subtle rim separation. Water droplets on marble surface catch light at each angle. Minimalist spa atmosphere with morning sunlight filtering through sheer curtain. Shot on 85mm lens, f/2.8, shallow depth of field with creamy bokeh. Clean muted warm tones, soft highlight bloom, subtle pink undertones.",
        "Camera performs slow controlled push-in toward perfume bottle centered on wet stone surface, generous negative space above for text overlay. Light refracting through glass creates prismatic color splashes on surface below. Soft overhead key with gentle warm fill creating luminous glow. Micro-bubbles visible in the liquid through glass wall. Shot on 85mm lens, f/4, product sharp with dreamy background blur. Clean muted warm tones, soft highlight bloom, subtle pink undertones.",
    ],
    "tech": [
        "Extreme close-up of premium wireless headphones on reflective dark surface, subtle screen glow pulsing with color shift from nearby device. Camera holds perfectly locked capturing brushed aluminum texture and mesh ear cushion weave. Soft diffused key light from above with rim light tracing every metal edge. Faint atmospheric haze drifts through the dark void background. Shot on 85mm lens, f/4, shallow depth of field isolating the subject. Cool neutral grade, slight blue-teal shift, clean whites.",
        "Camera performs slow smooth orbit revealing laptop ultra-thin profile on reflective black glass surface, micro-reflections on polished metal edges shifting with camera movement. Subtle rim light traces the aluminum unibody as camera moves around. Fiber optic light strands and glass prisms as environmental elements. Dark tech showcase with faint blue ambient glow. Shot on 100mm telephoto lens, f/4, compressed pure black background. Cool neutral grade, slight blue-teal shift, clean whites.",
        "Camera performs slow controlled push-in toward smartwatch on dark surface, screen glow illuminating immediate surroundings with subtle color wash. Soft overhead diffused lighting with precise rim light on metal case edges. Faint electromagnetic interference pattern drifts through dark void background. Shot on 85mm lens, f/4, sharp across entire device with generous negative space for text. Cool neutral grade, slight blue-teal shift, clean whites.",
    ],
    "lifestyle": [
        "Extreme macro of artisan candle on natural linen surface, flame tip dancing with tiny wax pool ripple in warm amber light. Camera holds perfectly locked capturing wick detail and wax texture. Warm candlelight serves as primary illumination with gentle ambient fill. Dried botanical sprigs and aged wood texture as environmental props. Shot on 100mm macro lens, f/2.8, paper-thin depth of field. Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation.",
        "Camera performs slow smooth dolly backward from essential oil bottle on stone surface, gradually revealing spa arrangement with candles and dried flowers. Warm layered illumination from multiple candle points creates intimate atmosphere with deep shadow pockets. Smoke wisps curling in slow spiral through warm air. Linen fabric folds catch amber glow. Shot on 85mm lens, f/2.8, depth of field widening through movement. Warm amber tones, soft shadows, gentle highlight bloom, slight desaturation.",
        "Camera holds steady on supplement bottle centered on clean white marble counter, capsule surface catching micro-specular highlights under bright clean key light. Generous negative space above for text overlay. Fresh fruit slices and green leaf accents suggest natural ingredients. Bright modern kitchen with morning sunlight streaming through window. Shot on 85mm lens, f/4, sharp product focus with clean minimalist composition. Bright clean whites, vibrant accent colors, high key, minimal shadows.",
    ],
}
