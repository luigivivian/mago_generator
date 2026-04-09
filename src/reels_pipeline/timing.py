"""Phase 23: Audio-anchored scene_timings construction.

Single source of truth for per-cena scene_timings derived from
ffprobe-measured per-cena durations (landed in Phase 22 as
step_state.tts.cenas[i].duration). Replaces the char-offset
approximation in align_srt_with_script for Phase 22+ jobs.

References:
    .planning/phases/23-audio-anchored-timing-propagation/23-RESEARCH.md
        §2 Data Flow Design — Single Source of Truth
        §3 Float Drift Analysis — Where Cursor Accumulates Today
        §8 Code Examples — Pattern 3

The helper is PURE: no I/O, no ffmpeg, no Gemini, no filesystem,
no subprocess. Input is the Phase 22 cenas list, output is the
scene_timings shape consumed downstream by:
    - src/reels_pipeline/scene_splitter.py::split_long_scenes_in_script
    - src/reels_pipeline/video_builder.py::concat_clips_with_audio (trim loop)
    - src/api/routes/reels.py (step_data["scene_timings"] write site)

Output shape is byte-equal to align_srt_with_script's return value
so consumers see no drift when callers swap the construction site.

Float drift (TIMING-05): cursor rounding is applied at 4 points to
eliminate the bug described in
pipeline-historia-narracao-imagem.md §9
("Cenas desalinhadas após a terceira"):
    (A) start emission: round(cursor * 1000) / 1000
    (B) end   emission: round((cursor + dur) * 1000) / 1000
    (C) duration re-derived from rounded bounds (NOT raw dur)
    (D) cursor = end   (re-uses already-rounded end; no double rounding)
"""

from __future__ import annotations


def build_scene_timings_from_cenas(tts_cenas: list[dict]) -> list[dict]:
    """Build scene_timings from per-cena ffprobe durations.

    Phase 23 replacement for align_srt_with_script's char-offset
    approximation. The source of truth is tts.cenas[i].duration
    (measured by ffprobe in Phase 22, stored in
    step_state.tts.cenas[i]).

    Args:
        tts_cenas: Phase 22 cenas_meta list. Each entry has keys
            index, narracao, path, duration, status, and (optional)
            failed. Only index, narracao, duration, and failed are
            read here.

    Returns:
        scene_timings list with shape byte-equal to
        align_srt_with_script's output:
            [{"index": int, "start": float, "end": float,
              "duration": float, "narracao": str}, ...]

    Notes:
        - Failed cenas (cena.get("failed") is True) emit a zero-
          duration slot at the current cursor position and do NOT
          advance the cursor. This preserves index alignment with
          script.cenas[i] so downstream consumers (splitter,
          trimming) don't skew, while keeping the concat waveform
          math correct (Phase 22's _concat_cena_wavs already skips
          failed files).
        - Missing or None duration is treated as 0.0 (defensive
          against partially-populated cenas during mid-step retry).
        - TIMING-05: cursor is rounded to milliseconds at every
          accumulation AND every emission to eliminate IEEE 754
          float drift across long scripts (ref doc §9).
    """
    scene_timings: list[dict] = []
    cursor = 0.0
    for cena in tts_cenas:
        # Failed cenas contribute zero duration — they keep their
        # index slot but do not advance the cursor.
        if cena.get("failed"):
            dur = 0.0
        else:
            raw = cena.get("duration")
            dur = float(raw) if raw is not None else 0.0

        # (A) start emission — round(cursor * 1000) / 1000
        start = round(cursor * 1000) / 1000
        # (B) end   emission — round((cursor + dur) * 1000) / 1000
        end = round((cursor + dur) * 1000) / 1000

        scene_timings.append({
            "index": int(cena["index"]),
            "start": start,
            "end": end,
            # (C) duration re-derived from rounded bounds so
            # downstream consumers that use duration vs end-start
            # see strictly equal values.
            "duration": round(end - start, 3),
            "narracao": cena.get("narracao", ""),
        })

        # (D) cursor = end — re-use the already-rounded end value
        # so no double rounding and no drift between emission and
        # accumulation.
        cursor = end

    return scene_timings
