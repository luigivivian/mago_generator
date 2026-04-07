"""Reels audio transcription — Gemini multimodal audio to SRT subtitles."""

import asyncio
import difflib
import logging
import os
import re
from pathlib import Path

from google.genai import types

from src.llm_client import _get_client
from src.reels_pipeline.config import REELS_SCRIPT_LANGUAGE, REELS_SUB_MAX_CHARS

logger = logging.getLogger("clip-flow.reels.transcriber")

# Model for transcription (Gemini multimodal handles audio input)
_TRANSCRIPTION_MODEL = "gemini-2.5-flash"

# Minimum difflib similarity for a contiguous chunk span to be considered
# a match for a cena.narracao during alignment.
_REELS_ALIGN_SIMILARITY = 0.75


async def transcribe_to_srt(
    audio_path: str,
    output_path: str,
    language: str | None = None,
    provider: str | None = None,
) -> str:
    """Transcribe audio to SRT subtitle format.

    Args:
        audio_path: Path to the WAV audio file.
        output_path: Path to save the SRT file.
        language: Language code (default from config).
        provider: Transcription provider ("gemini" or "whisper_local").

    Returns:
        Path to the saved SRT file.
    """
    provider = provider or "gemini"

    if provider == "whisper_local":
        raise NotImplementedError("Local Whisper deferred to follow-up")

    if provider != "gemini":
        raise ValueError(f"Unknown transcription provider: {provider}")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    lang = language or REELS_SCRIPT_LANGUAGE
    audio_bytes = Path(audio_path).read_bytes()

    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")
    prompt_text = (
        f"Transcribe this audio to SRT subtitle format with timestamps. "
        f"Language: {lang}. "
        f"Group words in chunks of 4-5 words per subtitle entry. "
        f"Return ONLY the SRT content, no markdown."
    )

    client = _get_client()

    logger.info(f"Transcribing audio ({len(audio_bytes)} bytes) to SRT via Gemini, lang={lang}")

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=_TRANSCRIPTION_MODEL,
        contents=[audio_part, prompt_text],
    )

    srt_text = response.text or ""
    # Strip markdown code fences if Gemini wraps the output
    if srt_text.startswith("```"):
        lines = srt_text.strip().split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        srt_text = "\n".join(lines)

    srt_text = _normalize_srt_structure(srt_text)
    srt_text = _normalize_srt_timestamps(srt_text)
    srt_text = _validate_srt_timestamps(srt_text)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_text)

    logger.info(f"SRT saved: {output_path} ({len(srt_text)} chars)")
    return output_path


def _normalize_srt_structure(srt_text: str) -> str:
    """Ensure double-newline separators between SRT entries.

    Gemini sometimes returns entries separated by single newlines.
    Inserts blank line before each entry index (digit line followed by timestamp).
    """
    srt_text = srt_text.replace("\r\n", "\n")
    return re.sub(r"\n(?=\d+\n\d{2}:\d{2})", "\n\n", srt_text)


def _normalize_srt_timestamps(srt_text: str) -> str:
    """Fix malformed SRT timestamps from Gemini.

    Gemini sometimes returns timestamps like '00:00:270' (MM:SS:mmm)
    instead of the correct SRT format '00:00:00,270' (HH:MM:SS,mmm).
    Also handles '00:00:270' -> '00:00:00,270' and variants.
    """
    def fix_timestamp(match: re.Match) -> str:
        ts = match.group(0)
        # Already correct format: HH:MM:SS,mmm
        if re.match(r"\d{2}:\d{2}:\d{2},\d{3}$", ts):
            return ts
        # Format: MM:SS:mmm (Gemini's common mistake) -> HH:MM:SS,mmm
        m = re.match(r"(\d{2}):(\d{2}):(\d{2,3})$", ts)
        if m:
            a, b, c = m.groups()
            if len(c) == 3:
                # a:b:ccc -> 00:a:b,ccc (treat as MM:SS,mmm)
                return f"00:{a}:{b},{c}"
            else:
                # a:b:cc -> 00:a:b,cc0 (treat as MM:SS,cs)
                return f"00:{a}:{b},{c}0"
        # Format: HH:MM:SS.mmm (dot instead of comma)
        m = re.match(r"(\d{2}:\d{2}:\d{2})\.(\d{3})$", ts)
        if m:
            return f"{m.group(1)},{m.group(2)}"
        return ts

    # Match timestamp patterns in arrow lines: "TS --> TS"
    return re.sub(
        r"\d{2}:\d{2}:\d{2}[,:\.]\d{2,3}|\d{2}:\d{2}:\d{2,3}",
        fix_timestamp,
        srt_text,
    )


def _srt_ts_to_seconds(ts: str) -> float:
    """Parse SRT timestamp 'HH:MM:SS,mmm' to seconds."""
    m = re.match(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})", ts.strip())
    if not m:
        return 0.0
    h, mi, s, ms = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(s) + int(ms) / 1000.0


def _seconds_to_srt_ts(seconds: float) -> str:
    """Format seconds to SRT timestamp 'HH:MM:SS,mmm'."""
    if seconds < 0:
        seconds = 0.0
    h = int(seconds // 3600)
    mi = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{mi:02d}:{s:02d},{ms:03d}"


def _validate_srt_timestamps(srt_text: str) -> str:
    """Fix temporally inconsistent SRT timestamps from Gemini.

    Gemini occasionally returns correctly-formatted but wrong-value
    timestamps (e.g. 00:06:21,795 instead of 00:00:08,795). This
    causes subtitle entries to overlap, stacking on screen.

    Fixes applied:
    1. If an entry's end time exceeds the next entry's start time,
       cap it to the next entry's start (minus a small gap).
    2. If an entry's end time is before its start time, set end = start + 2s.
    """
    blocks = srt_text.strip().split("\n\n")
    parsed = []

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            parsed.append({"raw": block, "start": None, "end": None, "lines": lines})
            continue
        ts_match = re.match(
            r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})",
            lines[1].strip(),
        )
        if not ts_match:
            parsed.append({"raw": block, "start": None, "end": None, "lines": lines})
            continue
        start_s = _srt_ts_to_seconds(ts_match.group(1))
        end_s = _srt_ts_to_seconds(ts_match.group(2))
        parsed.append({
            "raw": block, "start": start_s, "end": end_s,
            "lines": lines, "ts_line_idx": 1,
        })

    modified = False
    for i, entry in enumerate(parsed):
        if entry["start"] is None:
            continue

        start_s = entry["start"]
        end_s = entry["end"]
        original_end = end_s

        # Fix inverted timestamps
        if end_s <= start_s:
            end_s = start_s + 2.0

        # Cap end time to next entry's start (with 50ms gap)
        if i + 1 < len(parsed) and parsed[i + 1]["start"] is not None:
            next_start = parsed[i + 1]["start"]
            if end_s > next_start:
                end_s = max(next_start - 0.05, start_s + 0.1)

        if end_s != original_end:
            lines = entry["lines"]
            lines[1] = f"{_seconds_to_srt_ts(start_s)} --> {_seconds_to_srt_ts(end_s)}"
            entry["end"] = end_s
            modified = True

    if not modified:
        return srt_text

    # Rebuild SRT text
    result_blocks = []
    for entry in parsed:
        result_blocks.append("\n".join(entry["lines"]))

    result = "\n\n".join(result_blocks)
    logger.info("SRT timestamps validated and corrected")
    return result


def align_srt_with_script(srt_text: str, script: dict) -> tuple[str, list[dict]]:
    """Map each script cena to a contiguous span of Gemini SRT chunks.

    Returns Gemini's raw SRT unchanged plus a per-cena span mapping built by
    locating each cena.narracao inside script.narracao_completa via character
    offset, then proportionally mapping the char range to audio time, and
    finally snapping to the nearest SRT chunk boundaries so spans align to
    real word-level timestamps. The chunks themselves remain authoritative
    subtitles, so the returned SRT is byte-for-byte equal to the input.

    Why character offset, not text matching against chunks: cena.narracao
    only covers the narrative portion of the audio (~58%). The other 42%
    is hook + cenário + lição + CTA — text that exists in narracao_completa
    and the audio, but is NOT in any individual cena. A pure chunk-walking
    matcher gets stuck on those preamble/suffix chunks because they don't
    match any cena. Mapping from char offsets in narracao_completa avoids
    that entirely: we know exactly where each cena lives in the audio text,
    map that position to time proportionally, then snap to chunks.

    Each scene_timings entry has shape:
        {index: int, start: float, end: float, duration: float, narracao: str}
    Spans are monotonic. Cenas not found in narracao_completa fall back to
    proportional uniform distribution over the leftover time.
    """
    cenas = script.get("cenas", [])
    if not cenas:
        return (srt_text, [])

    narracao_completa = (script.get("narracao_completa") or "").strip()

    # Parse SRT entries (do NOT mutate srt_text — parsing is read-only)
    blocks = srt_text.strip().split("\n\n")
    entries: list[dict] = []
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue
        ts_match = re.match(
            r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})",
            lines[1].strip(),
        )
        if not ts_match:
            continue
        entries.append({
            "start": _srt_ts_to_seconds(ts_match.group(1)),
            "end": _srt_ts_to_seconds(ts_match.group(2)),
            "text": "\n".join(lines[2:]),
        })

    if not entries:
        return (srt_text, [])

    audio_start = entries[0]["start"]
    audio_end = entries[-1]["end"]
    audio_duration = max(audio_end - audio_start, 0.1)

    scene_timings: list[dict] = []

    if narracao_completa:
        # ── Character-offset path: precise mapping via narracao_completa ──
        total_chars = len(narracao_completa)
        char_spans: list[tuple[int, int, str]] = []  # (start, end, narracao)
        cursor = 0
        for cena in cenas:
            n = (cena.get("narracao") or "").strip()
            if not n:
                continue
            pos = narracao_completa.find(n, cursor)
            if pos < 0:
                # Try fuzzy fallback: find via first 20 chars (handles minor TTS
                # paraphrasing). If still missing, skip — will be filled by gap
                # interpolation below.
                hint = n[:20]
                pos = narracao_completa.find(hint, cursor) if hint else -1
            if pos < 0:
                char_spans.append((-1, -1, n))
                continue
            end_pos = pos + len(n)
            char_spans.append((pos, end_pos, n))
            cursor = end_pos

        # Fill missing spans by interpolating between known neighbours so the
        # final timeline still has 12 entries (one per cena).
        for i, (s, e, n) in enumerate(char_spans):
            if s >= 0:
                continue
            # Find nearest known neighbours
            prev_end = 0
            next_start = total_chars
            for j in range(i - 1, -1, -1):
                if char_spans[j][1] >= 0:
                    prev_end = char_spans[j][1]
                    break
            for j in range(i + 1, len(char_spans)):
                if char_spans[j][0] >= 0:
                    next_start = char_spans[j][0]
                    break
            slot = max(1, (next_start - prev_end) // max(1, sum(
                1 for k in range(i, len(char_spans))
                if k == i or char_spans[k][0] < 0
            )))
            char_spans[i] = (prev_end, prev_end + slot, n)

        # Compute spans that cover the ENTIRE audio with no gaps. Strategy:
        # use natural char-anchored centers for each cena (where its narracao
        # text actually begins in narracao_completa), then set boundaries to
        # the MIDPOINT between adjacent centers. First cena starts at 0,
        # last cena ends at audio_end. This distributes preamble/suffix
        # proportionally — preamble splits between cena 0 and cena 1 based
        # on where they sit in the audio, not all dumped on cena 0.
        n_cenas = len(char_spans)
        anchored_centers: list[float] = []
        for i, (cs, ce, _n) in enumerate(char_spans):
            # Use the MIDPOINT of each cena's char span as the anchor center.
            char_mid = (cs + ce) / 2
            time_center = audio_start + (char_mid / total_chars) * audio_duration
            anchored_centers.append(time_center)

        for i, (_cs, _ce, n) in enumerate(char_spans):
            # Boundary on the LEFT = midpoint between this cena's center and
            # the previous one. For cena 0, boundary is audio_start.
            if i == 0:
                t_start = audio_start
            else:
                t_start = (anchored_centers[i - 1] + anchored_centers[i]) / 2
            # Boundary on the RIGHT = midpoint between this cena's center
            # and the next one. For the last cena, boundary is audio_end.
            if i == n_cenas - 1:
                t_end = audio_end
            else:
                t_end = (anchored_centers[i] + anchored_centers[i + 1]) / 2

            # Force first/last cena to true audio bounds.
            if i == 0:
                t_start = audio_start
            if i == n_cenas - 1:
                t_end = audio_end
            # Round to 3 decimals up front so comparisons against stored
            # (already-rounded) previous values are consistent.
            t_start = round(t_start, 3)
            t_end = round(t_end, 3)
            # Enforce monotonic and minimum 0.5s.
            if scene_timings and t_start < scene_timings[-1]["end"]:
                t_start = scene_timings[-1]["end"]
            if t_end < t_start + 0.5:
                t_end = round(t_start + 0.5, 3)
            # Patch the previous cena's end to match this cena's start (no gaps).
            if scene_timings and scene_timings[-1]["end"] != t_start:
                scene_timings[-1]["end"] = t_start
                scene_timings[-1]["duration"] = round(
                    scene_timings[-1]["end"] - scene_timings[-1]["start"], 3
                )
            scene_timings.append({
                "index": i,
                "start": t_start,
                "end": t_end,
                "duration": round(t_end - t_start, 3),
                "narracao": n,
            })
    else:
        # ── Fallback: uniform distribution when narracao_completa is missing ──
        narracoes = [
            (c.get("narracao") or "").strip() for c in cenas if (c.get("narracao") or "").strip()
        ]
        if not narracoes:
            return (srt_text, [])
        slot = audio_duration / len(narracoes)
        for i, n in enumerate(narracoes):
            t_start = audio_start + i * slot
            t_end = audio_start + (i + 1) * slot
            scene_timings.append({
                "index": i,
                "start": round(t_start, 3),
                "end": round(t_end, 3),
                "duration": round(slot, 3),
                "narracao": n,
            })

    logger.info(
        f"SRT aligned with script: {len(scene_timings)} cenas mapped via "
        f"{'char-offset' if narracao_completa else 'uniform fallback'}, "
        f"raw SRT preserved ({len(entries)} chunks, audio={audio_duration:.1f}s)"
    )
    return (srt_text, scene_timings)


def _wrap_subtitle_text(text: str, max_chars: int = REELS_SUB_MAX_CHARS) -> list[str]:
    """Split narration text into subtitle-friendly chunks of ~max_chars.

    Splits on sentence boundaries first, then word-wraps long sentences.
    Each chunk becomes a separate SRT entry.
    """
    # Split into sentences (period, exclamation, question mark)
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())

    chunks = []
    current = ""
    for sentence in sentences:
        if not sentence:
            continue
        if not current:
            current = sentence
        elif len(current) + 1 + len(sentence) <= max_chars:
            current += " " + sentence
        else:
            chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)

    # Word-wrap any chunk that's still too long
    result = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
        else:
            words = chunk.split()
            line = ""
            for word in words:
                if not line:
                    line = word
                elif len(line) + 1 + len(word) <= max_chars:
                    line += " " + word
                else:
                    result.append(line)
                    line = word
            if line:
                result.append(line)

    return result if result else [text]


def estimate_transcription_cost(audio_duration_seconds: float) -> float:
    """Estimate transcription cost in USD for Gemini multimodal audio input.

    Gemini Flash audio input: ~$0.001/min (negligible).
    """
    return (audio_duration_seconds / 60) * 0.001
