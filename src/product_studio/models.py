"""Pydantic models for Product Studio: wizard request, job response, analysis, copy, cost."""

from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from src.product_studio.config import ADS_DEFAULT_VIDEO_MODEL


class AdCreateRequest(BaseModel):
    """Wizard request to create a new product ad."""
    product_name: str = Field(..., description="Product name")
    product_image_url: Optional[str] = Field(default=None, description="URL of product image (optional if uploading)")
    style: Literal["cinematic", "narrated", "lifestyle"] = Field(default="cinematic", description="Ad style")
    video_model: str = Field(default=ADS_DEFAULT_VIDEO_MODEL, description="Video generation model")
    audio_mode: Literal["mute", "music", "narrated", "ambient"] = Field(default="music", description="Audio mode")
    output_formats: list[str] = Field(default=["9:16"], description="Export formats")
    target_duration: int = Field(default=15, description="Target duration in seconds")
    tone: str = Field(default="premium", description="Tone/mood")
    niche: str = Field(default="", description="Product niche")
    audience: str = Field(default="", description="Target audience description")
    scene_description: str = Field(default="", description="Optional scene description override")
    with_human: bool = Field(default=False, description="Include human in scene")


class AdJobResponse(BaseModel):
    """Full job response with results."""
    job_id: str
    status: str
    style: str
    product_name: str
    step_state: Optional[dict] = None
    cost_brl: Optional[float] = None
    outputs: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class AdStepStateResponse(BaseModel):
    """Current step state for polling."""
    step_state: dict
    current_step: str
    progress_pct: int


class AdAnalysisResult(BaseModel):
    """AI analysis of the product image/description."""
    niche: str
    tone: str
    audience: str
    scene_suggestions: list[str]
    product_description: str


class AdCopyResult(BaseModel):
    """Generated ad copy."""
    headline: str
    cta: str
    hashtags: list[str]


class AdCostEstimate(BaseModel):
    """Cost breakdown for an ad job."""
    video_cost_brl: float
    audio_cost_brl: float
    image_cost_brl: float
    total_brl: float


# ============================================================
# V2 cinematic multi-scene ads pipeline (Phase 1002)
# ============================================================


class TakeConfig(BaseModel):
    """Single take/shot configuration for v2 cinematic pipeline."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    order: int = Field(..., ge=0, description="Take order in storyboard")
    prompt: str = Field(..., max_length=463, description="Action description for Kling (463 char limit after @element)")
    camera_move: Literal["dolly", "orbit", "macro_zoom", "static", "crane"] = Field(default="static")
    duration: int = Field(default=5, ge=3, le=10, description="Take duration 3-10s")
    transition_type: Literal["dissolve", "cut", "wipeleft", "fade", "fadeblack"] = Field(default="dissolve")
    sfx_id: Optional[str] = Field(default=None, description="SFX library entry ID")
    thumbnail_url: Optional[str] = Field(default=None)


class StoryboardScene(BaseModel):
    """AI-generated scene suggestion."""
    take_config: TakeConfig
    rationale: str = Field(..., description="Why this scene works for the product")
    category_defaults_applied: str = Field(default="", description="Which category config was used")


class AdCreateRequestV2(BaseModel):
    """V2 wizard request for multi-scene cinematic ad."""
    product_name: str = Field(..., description="Product name")
    category: str = Field(default="generic", description="Product category key (food_cookies, beauty_skincare, etc.)")
    image_urls: list[str] = Field(..., min_length=1, max_length=4, description="1-4 product image URLs")
    takes: list[TakeConfig] = Field(default_factory=list, description="Take configs (empty = auto-generate)")
    output_formats: list[str] = Field(default=["9:16"], description="Export formats")
    audio_mode: Literal["sfx", "music", "mute"] = Field(default="sfx")


class AdJobResponseV2(AdJobResponse):
    """Extended response for v2 jobs."""
    pipeline_version: int = Field(default=2)
    takes: list[TakeConfig] = Field(default_factory=list)
    storyboard: list[StoryboardScene] = Field(default_factory=list)
