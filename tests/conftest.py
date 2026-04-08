"""Shared pytest fixtures for the meme-lab test suite.

Phase 22 Wave 0: TTS test infrastructure. Adds fake-Gemini monkeypatch
and a real-PCM-WAV factory used by tests/test_reels_tts.py to validate
the per-cena TTS refactor without hitting the real Gemini API.
"""

from __future__ import annotations

import os
import wave
from pathlib import Path
from typing import Callable

import pytest


# Phase 22: Gemini Flash TTS PCM format (must match src/reels_pipeline/tts.py
# constants _SAMPLE_RATE / _SAMPLE_WIDTH / _CHANNELS).
_TTS_SAMPLE_RATE = 24000
_TTS_SAMPLE_WIDTH = 2  # 16-bit
_TTS_CHANNELS = 1


class FakeGeminiResponse:
    """Mimics google.genai response shape used by generate_narration().

    Real shape: response.candidates[0].content.parts[0].inline_data.data -> bytes (PCM)
    """

    def __init__(self, pcm_bytes: bytes):
        part = type("Part", (), {"inline_data": type("Inline", (), {"data": pcm_bytes})()})
        content = type("Content", (), {"parts": [part]})
        candidate = type("Candidate", (), {"content": content})
        self.candidates = [candidate]


class FakeGeminiClient:
    """Drop-in for src.llm_client._get_client() return value.

    Records every generate_content call args in `.calls` so tests can
    assert `speed`/`tone`/contents arguments without hitting the network.
    """

    def __init__(self, pcm_factory: Callable[[int], bytes] | None = None):
        self.calls: list[dict] = []
        # Default: generate 0.5s of silence (24000 samples/s * 0.5s * 2 bytes = 24000 bytes)
        self._pcm_factory = pcm_factory or (lambda call_idx: b"\x00\x00" * 12000)
        self.models = self  # so client.models.generate_content() resolves
        self._raises: list[BaseException | None] = []

    def queue_error(self, exc: BaseException) -> None:
        """Next call will raise this exception instead of returning audio."""
        self._raises.append(exc)

    def queue_success(self) -> None:
        """Next call returns successfully (default behavior; explicit alias)."""
        self._raises.append(None)

    def generate_content(self, *, model: str, contents, config):
        call_idx = len(self.calls)
        self.calls.append({
            "model": model,
            "contents": contents,
            "config": config,
        })
        if self._raises:
            exc = self._raises.pop(0)
            if exc is not None:
                raise exc
        return FakeGeminiResponse(self._pcm_factory(call_idx))


@pytest.fixture
def fake_gemini_tts_client(monkeypatch):
    """Replaces src.llm_client._get_client with a FakeGeminiClient.

    Usage:
        def test_x(fake_gemini_tts_client):
            # call generate_narration; fake_gemini_tts_client.calls captures args
            assert fake_gemini_tts_client.calls[0]["config"].speech_config is not None
    """
    fake = FakeGeminiClient()
    monkeypatch.setattr("src.llm_client._get_client", lambda: fake)
    return fake


@pytest.fixture
def make_fake_tts_wavs(tmp_path) -> Callable[[list[int]], list[str]]:
    """Factory: writes real PCM 24kHz mono 16-bit WAV files for ffprobe tests.

    The ffmpeg `-f concat -c copy` path is bit-exact ONLY when all inputs
    have identical format. This fixture mirrors `_wrap_pcm_as_wav` exactly
    so the resulting files are byte-compatible with what generate_narration
    actually writes.

    Args:
        n_frames_list: e.g. [73_123, 89_451, 105_903] -> 3 files of those frame counts

    Returns:
        list of absolute paths to the written WAV files
    """

    def _factory(n_frames_list: list[int]) -> list[str]:
        out_dir = tmp_path / "fake_tts_wavs"
        out_dir.mkdir(exist_ok=True)
        paths: list[str] = []
        for i, n_frames in enumerate(n_frames_list):
            path = out_dir / f"cena_{i:03d}.wav"
            payload = b"\x00\x00" * n_frames  # silent 16-bit mono
            with wave.open(str(path), "wb") as wf:
                wf.setnchannels(_TTS_CHANNELS)
                wf.setsampwidth(_TTS_SAMPLE_WIDTH)
                wf.setframerate(_TTS_SAMPLE_RATE)
                wf.writeframes(payload)
            paths.append(str(path))
        return paths

    return _factory
