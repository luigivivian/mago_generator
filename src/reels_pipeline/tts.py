"""Reels TTS narration — Gemini Flash TTS gemini-2.5-flash-preview-tts (same GOOGLE_API_KEY, zero extra dependency)."""

import logging
import os
import wave

from google.genai import types

from src.llm_client import _get_client
from src.reels_pipeline.config import (
    REELS_TTS_MODEL,
    REELS_TTS_VOICE,
)

logger = logging.getLogger("clip-flow.reels.tts")


# Phase 22: Gemini TTS error classification (D-02)
# Verified against google-genai 1.68.0:
#   ClientError (4xx) has .code (int), .status (str), .message (str)
#   ServerError (5xx) same shape
# Retry: 429 RESOURCE_EXHAUSTED + all 5xx + unknown exceptions
# Fail (do not retry): 400 INVALID_ARGUMENT (incl. content-safety blocks),
#                      403 PERMISSION_DENIED (bad API key)
def classify_tts_error(exc: BaseException) -> str:
    """Classify a Gemini TTS exception as 'retry' or 'fail'.

    See .planning/phases/22-per-cena-tts-anchoring/22-RESEARCH.md
    Common Pitfalls #4 for the rationale on 400/403 non-retry.

    Args:
        exc: any exception raised from `client.models.generate_content`

    Returns:
        "retry" -- caller should backoff and try again
        "fail"  -- caller should mark cena failed immediately, no retry
    """
    try:
        from google.genai import errors as genai_errors
    except ImportError:
        return "retry"

    if isinstance(exc, genai_errors.ClientError):
        code = getattr(exc, "code", None)
        if code in (400, 403):
            return "fail"
        return "retry"
    if isinstance(exc, genai_errors.ServerError):
        return "retry"
    return "retry"


# Gemini Flash TTS audio output: raw PCM 24kHz mono 16-bit
_SAMPLE_RATE = 24000
_SAMPLE_WIDTH = 2  # 16-bit
_CHANNELS = 1

# Available Gemini TTS voices (subset, all support PT-BR)
AVAILABLE_VOICES = [
    "Puck",    # upbeat, energetic
    "Aoede",   # bright, warm
    "Kore",    # firm, clear
    "Charon",  # serious, deep
    "Leda",    # calm, gentle
    "Zephyr",  # neutral, balanced
]


def _wrap_pcm_as_wav(pcm_data: bytes, output_path: str) -> str:
    """Wrap raw PCM 24kHz mono 16-bit data in a WAV container."""
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(_CHANNELS)
        wf.setsampwidth(_SAMPLE_WIDTH)
        wf.setframerate(_SAMPLE_RATE)
        wf.writeframes(pcm_data)
    return output_path


_TONE_STYLE_PROMPTS = {
    "biblical": (
        "Narrate with reverence, emotion, and dramatic pacing. "
        "Speak slowly at key moments, pause between sentences, "
        "convey the grandeur and solemnity of the scene. "
        "Use a warm, deep tone as if telling an ancient sacred story."
    ),
    "inspirational": (
        "Narrate with warmth, conviction, and emotional depth. "
        "Build energy gradually, emphasize key phrases with passion, "
        "and deliver the message as if speaking to someone's heart."
    ),
    "storytelling": (
        "Narrate like a captivating storyteller. Vary your pace — "
        "slow down for dramatic moments, speed up for action. "
        "Use vocal dynamics to keep the listener hooked."
    ),
    "educational": (
        "Narrate clearly and engagingly, like a great teacher. "
        "Emphasize key concepts, use natural pauses for comprehension, "
        "and maintain an approachable, confident delivery."
    ),
    "motivational": (
        "Narrate with energy and conviction. Build momentum through the text, "
        "emphasize action words, and deliver with the passion of a coach "
        "inspiring their team."
    ),
}


async def generate_narration(
    text: str,
    output_path: str,
    voice: str | None = None,
    provider: str | None = None,
    speed: float | None = None,
    tone: str | None = None,
) -> str:
    """Generate narration audio from text via TTS.

    Args:
        text: Narration text to synthesize.
        output_path: Path to save the WAV file.
        voice: Voice name (default from config).
        provider: TTS provider ("gemini" or "elevenlabs").
        speed: Speaking rate multiplier (e.g. 1.0 = normal, 1.2 = 20% faster).
        tone: Narration style/tone hint (biblical, inspirational, etc).

    Returns:
        Path to the saved WAV file.
    """
    import asyncio

    provider = provider or "gemini"

    if provider == "elevenlabs":
        raise NotImplementedError("ElevenLabs TTS deferred to follow-up")

    if provider != "gemini":
        raise ValueError(f"Unknown TTS provider: {provider}")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Phase 22 D-11/D-12: Biblical tone forces speaking_rate = 1.0 at the
    # lowest layer so EVERY caller (run_step_tts, batch mode, future
    # selective-retry path) inherits the clamp. The existing
    # _TONE_STYLE_PROMPTS["biblical"] explicitly says "Speak slowly...
    # pause between sentences" — running that at 1.35x is the contradiction
    # this clamp eliminates. Override is logged at INFO so production
    # traces can verify it.
    if tone == "biblical" and (speed is None or speed != 1.0):
        logger.info(
            "Biblical tone: forcing speaking_rate=1.0 (was %s)",
            speed if speed is not None else "default",
        )
        speed = 1.0

    voice_name = voice or REELS_TTS_VOICE
    client = _get_client()

    # Default speaking rate: 1.35 — short-form content (Reels/TikTok) needs
    # urgency. 1.2 was still too slow per user feedback on reel 034. Callers
    # can still override explicitly (bible/meditation may want ~1.1).
    speaking_rate = speed or 1.35

    # Build TTS prompt with emotional style direction
    style_prompt = _TONE_STYLE_PROMPTS.get(
        tone or "",
        "Narrate with natural emotion and engaging delivery. "
        "Vary your pace and emphasis to keep the listener engaged.",
    )
    speed_hint = f" Speak at {int(speaking_rate * 100)}% of normal speed." if speaking_rate != 1.0 else ""
    # Short-form flow hint: minimize pauses between sentences. Gemini TTS
    # naturally inserts dramatic pauses that kill the energy of Reels/TikTok
    # narration, which needs continuous urgency.
    flow_hint = (
        " Deliver with short-form content energy: minimize pauses between "
        "sentences, maintain continuous flow and urgency. No dramatic "
        "dead-air pauses."
    )
    tts_prompt = (
        f"{style_prompt}{speed_hint}{flow_hint} "
        f"Read the following narration in Brazilian Portuguese.\n\n"
        f"{text}"
    )

    logger.info(f"Generating TTS via {REELS_TTS_MODEL}, voice={voice_name}, speed={speaking_rate}, tone={tone}, text_len={len(text)}")

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=REELS_TTS_MODEL,
        contents=tts_prompt,
        config=types.GenerateContentConfig(
            temperature=1.5,
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name,
                    ),
                ),
            ),
        ),
    )

    pcm_data = response.candidates[0].content.parts[0].inline_data.data
    _wrap_pcm_as_wav(pcm_data, output_path)
    logger.info(f"TTS saved: {output_path} ({len(pcm_data)} bytes PCM)")
    return output_path


def estimate_tts_cost(text: str) -> float:
    """Estimate TTS cost in USD for Gemini Flash TTS.

    Gemini Flash TTS: ~$0.019/min, estimate ~150 chars/min for PT-BR narration.
    """
    chars = len(text)
    minutes = chars / 150
    return minutes * 0.019 / 60
