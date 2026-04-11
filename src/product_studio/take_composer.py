"""Take composition layer for v2 cinematic pipeline.

Handles video stitching (per-transition xfade via iterative pair composition)
and audio assembly (ambient base + SFX hits at xfade-aware offsets).

Reuses the proven concat_segments function from the reels pipeline
(src/reels_pipeline/video_builder.py:726).
"""

import logging
import os
import subprocess
from typing import Optional

logger = logging.getLogger("clip-flow.product_studio.take_composer")


def compose_takes(
    video_paths: list[str],
    transition_types: list[str],
    output_path: str,
    transition_duration: float = 0.5,
) -> str:
    """Stitch multiple take videos with per-transition xfade.

    concat_segments supports a single transition_type for all transitions.
    To support per-take transitions, we concatenate pairs iteratively.

    Args:
        video_paths: List of take video paths in order.
        transition_types: List of transition names, one per INTERNAL transition
            (so len(transition_types) == len(video_paths) - 1). Each one of:
            "dissolve", "fade", "fadeblack", "wipeleft", "cut".
        output_path: Final composed video path.
        transition_duration: Seconds of xfade overlap (0.5 default; 0 for "cut").

    Returns:
        output_path on success.
    """
    from src.reels_pipeline.video_builder import concat_segments

    if len(video_paths) == 0:
        raise ValueError("compose_takes: empty video_paths")
    if len(video_paths) == 1:
        import shutil
        shutil.copy(video_paths[0], output_path)
        return output_path

    if len(transition_types) != len(video_paths) - 1:
        raise ValueError(
            f"transition_types length ({len(transition_types)}) must equal "
            f"video_paths length - 1 ({len(video_paths) - 1})"
        )

    import tempfile
    work_dir = tempfile.mkdtemp(prefix="take_compose_")
    try:
        accumulator = video_paths[0]
        for i, next_path in enumerate(video_paths[1:], start=1):
            t_type = transition_types[i - 1]
            # "cut" = zero-duration transition (hard cut)
            t_dur = 0.0 if t_type == "cut" else transition_duration
            ff_type = "fade" if t_type == "cut" else t_type

            pair_out = os.path.join(work_dir, f"pair_{i}.mp4")
            concat_segments(
                segment_paths=[accumulator, next_path],
                output_path=pair_out,
                transition_duration=t_dur,
                transition_type=ff_type,
            )
            accumulator = pair_out

        import shutil
        shutil.copy(accumulator, output_path)
        return output_path
    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


def compose_take_audio(
    ambient_path: Optional[str],
    sfx_entries: list[dict],
    output_path: str,
    total_duration: float,
) -> str:
    """Layer SFX hits over an ambient base via FFmpeg amix with delay offsets.

    Args:
        ambient_path: Path to ambient base audio file (or None to skip base).
        sfx_entries: List of dicts: {"path": str, "offset_sec": float, "volume": float}.
            offset_sec MUST already account for cumulative xfade overlap
            (calculated by caller via calculate_sfx_offsets).
        output_path: Output audio file path.
        total_duration: Total duration for atrim on base.

    Returns:
        output_path on success.
    """
    if not ambient_path and not sfx_entries:
        raise ValueError("compose_take_audio: must provide ambient or sfx")

    cmd = ["ffmpeg", "-y"]
    inputs = []
    n_inputs = 0

    if ambient_path and os.path.exists(ambient_path):
        cmd += ["-i", ambient_path]
        inputs.append(
            f"[{n_inputs}:a]atrim=0:{total_duration},aloop=loop=-1:size=2e9,"
            f"atrim=0:{total_duration}[base]"
        )
        n_inputs += 1
        base_label = "[base]"
    else:
        # Generate silent base
        cmd += ["-f", "lavfi", "-t", str(total_duration), "-i", "anullsrc=r=44100:cl=stereo"]
        inputs.append(f"[{n_inputs}:a]atrim=0:{total_duration}[base]")
        n_inputs += 1
        base_label = "[base]"

    sfx_labels = []
    for i, sfx in enumerate(sfx_entries):
        if not sfx.get("path") or not os.path.exists(sfx["path"]):
            continue
        cmd += ["-i", sfx["path"]]
        delay_ms = int(float(sfx["offset_sec"]) * 1000)
        vol = float(sfx.get("volume", 0.8))
        lbl = f"[sfx{i}]"
        inputs.append(f"[{n_inputs}:a]adelay={delay_ms}|{delay_ms},volume={vol}{lbl}")
        sfx_labels.append(lbl)
        n_inputs += 1

    mix_inputs = base_label + "".join(sfx_labels)
    n_mix = 1 + len(sfx_labels)

    if n_mix == 1:
        filters = ";".join(inputs) + ";[base]anull[out]"
    else:
        filters = (
            ";".join(inputs)
            + f";{mix_inputs}amix=inputs={n_mix}:duration=first:dropout_transition=0[out]"
        )

    cmd += [
        "-filter_complex", filters,
        "-map", "[out]",
        "-c:a", "aac",
        "-b:a", "192k",
        output_path,
    ]

    logger.info("compose_take_audio: %d inputs, %d sfx", n_inputs, len(sfx_labels))
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    return output_path


def calculate_sfx_offsets(
    take_durations: list[float],
    transition_duration: float,
) -> list[float]:
    """Calculate audio cue offsets that account for cumulative xfade overlap.

    Formula: offset[i] = sum(durations[:i]) - i * transition_duration

    Same formula concat_segments uses internally to shift audio.
    """
    offsets = []
    for i in range(len(take_durations)):
        offset = sum(take_durations[:i]) - i * transition_duration
        offsets.append(max(0.0, offset))
    return offsets
