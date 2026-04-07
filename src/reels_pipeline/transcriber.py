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
    text-matching each cena.narracao against contiguous SRT chunks via
    difflib similarity. The chunks themselves remain the authoritative
    subtitles (real word-level timestamps), so the returned SRT is byte-for-byte
    equal to the input. Each scene_timings entry has shape:
        {index: int, start: float, end: float, duration: float, narracao: str}
    Spans are monotonic and the last cena claims any leftover trailing chunks.
    """
    cenas = script.get("cenas", [])
    if not cenas:
        return (srt_text, [])

    narracoes = [c.get("narracao", "") for c in cenas if c.get("narracao", "").strip()]
    if not narracoes:
        return (srt_text, [])

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

    def _normalize(s: str) -> str:
        s = s.lower()
        s = re.sub(r"[^\w\s]", " ", s)
        return " ".join(s.split())

    scene_timings: list[dict] = []
    entry_idx = 0
    n_narracoes = len(narracoes)

    for i, cena_narracao in enumerate(narracoes):
        if entry_idx >= len(entries):
            # No chunks left to claim — skip silently; downstream consumers
            # see len(scene_timings) < n_narracoes and can warn.
            continue

        span_start_idx = entry_idx
        is_last = (i == n_narracoes - 1)
        claimed_text = ""
        ratio = 0.0
        target = _normalize(cena_narracao)

        while entry_idx < len(entries):
            claimed_text = (claimed_text + " " + entries[entry_idx]["text"]).strip()
            entry_idx += 1
            ratio = difflib.SequenceMatcher(None, _normalize(claimed_text), target).ratio()
            if is_last:
                # Last cena claims all remaining entries.
                continue
            if ratio >= _REELS_ALIGN_SIMILARITY and entry_idx > span_start_idx:
                break

        # Sentence snap (only if not last and there are more entries to peek):
        # if the claimed span doesn't end on .!? and extending one more chunk
        # doesn't drop similarity below threshold - 0.05, take the next chunk.
        if not is_last and entry_idx < len(entries):
            last_claimed_text = entries[entry_idx - 1]["text"].rstrip()
            if last_claimed_text and last_claimed_text[-1] not in ".!?":
                trial_text = (claimed_text + " " + entries[entry_idx]["text"]).strip()
                trial_ratio = difflib.SequenceMatcher(
                    None, _normalize(trial_text), target
                ).ratio()
                if trial_ratio >= _REELS_ALIGN_SIMILARITY - 0.05:
                    claimed_text = trial_text
                    entry_idx += 1
                    ratio = trial_ratio

        if not is_last and ratio < _REELS_ALIGN_SIMILARITY:
            logger.warning(
                f"Cena {i} similarity {ratio:.2f} below threshold "
                f"{_REELS_ALIGN_SIMILARITY}, alignment may be loose"
            )

        # Always claim at least one chunk (entry_idx > span_start_idx is guaranteed
        # by the while loop body unless entries was already exhausted on entry —
        # handled by the early continue above).
        if entry_idx == span_start_idx:
            continue

        last_claimed = entry_idx - 1
        scene_timings.append({
            "index": i,
            "start": round(entries[span_start_idx]["start"], 3),
            "end": round(entries[last_claimed]["end"], 3),
            "duration": round(
                entries[last_claimed]["end"] - entries[span_start_idx]["start"], 3
            ),
            "narracao": cena_narracao,
        })

    logger.info(
        f"SRT aligned with script: {len(scene_timings)} cenas mapped, "
        f"raw SRT preserved ({len(entries)} chunks)"
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
