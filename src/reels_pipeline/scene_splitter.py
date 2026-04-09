"""Scene splitter — break long cenas into sub-cenas with distinct visuals.

When `align_srt_with_script` produces a scene_timings entry whose duration
exceeds the visual rhythm cap (default 6s), this module splits that cena
into N sub-cenas, each one ~3s long, and generates distinct visual
variations of the parent's legenda_overlay via the LLM.

This handles two cases:
1. Existing reels where the original LLM produced too-long scenes (legacy
   reels generated before the prompt rewrite)
2. New reels where one cena ends up dominating because the LLM didn't
   distribute narration evenly

The output script has more cenas (and more imagem_index slots), so the
downstream pipeline (images → clips → assembly) automatically generates
more images and clips.
"""

import asyncio
import json
import logging
import math
import re
from copy import deepcopy

from google.genai import types

from src.llm_client import _get_client
from src.reels_pipeline.config import REELS_SCRIPT_MODEL

logger = logging.getLogger("clip-flow.reels.scene_splitter")

# Visual rhythm config (matches script_gen prompt language)
SCENE_TARGET_DURATION = 3.0  # seconds — sweet spot per short-form research
SCENE_MAX_DURATION = 6.0  # seconds — hard cap; anything longer gets split
SCENE_MIN_DURATION = 1.0  # seconds — never produce a sub-cena shorter than this
SCENE_MIN_WORDS_PER_SUB = 3  # each sub-cena needs >= 3 words of narration
# Speech rate below this threshold means the cena is "word-starved" — its
# long duration comes from align_srt absorbing preamble/suffix text, not from
# slow speech. Normal PT-BR speech is ~2.5 words/sec; short-form narration
# can dip to 1.5. Below 0.5 w/s means ~1/5 normal rate → the time is NOT
# the speaker, it's absorbed hook/CTA. Don't split these cenas.
# reel 034 reproductions: cena 0 (7w / 19s = 0.37) and cena 11 (7w / 22s =
# 0.32) both fall well below this and correctly skip split.
SCENE_MIN_WORDS_PER_SECOND = 0.5


def split_long_scenes_in_script(
    script: dict,
    scene_timings: list[dict],
    max_duration: float = SCENE_MAX_DURATION,
    target_duration: float = SCENE_TARGET_DURATION,
) -> tuple[dict, list[dict]]:
    """Split any cena longer than max_duration into N sub-cenas.

    Args:
        script: The script dict with `cenas` list.
        scene_timings: Per-cena timing list from align_srt_with_script.
            Each entry: {index, start, end, duration, narracao}.
        max_duration: Cenas longer than this get split (default 6.0s).
        target_duration: Each sub-cena targets this duration (default 3.0s).

    Returns:
        Tuple of (new_script, new_scene_timings) where:
        - new_script.cenas has additional sub-cenas inserted
        - new_scene_timings has matching entries with monotonic time spans
        - All imagem_index values are reindexed sequentially from 0
        - Sub-cenas inherit legenda_overlay from parent (caller can replace
          with distinct visuals via regenerate_split_legenda_overlays)
    """
    if not script.get("cenas") or not scene_timings:
        return script, scene_timings

    new_script = deepcopy(script)
    original_cenas = new_script.get("cenas", [])
    new_cenas: list[dict] = []
    new_timings: list[dict] = []
    new_idx = 0  # Running counter for reindexed cenas

    for orig_idx, orig_cena in enumerate(original_cenas):
        # Find matching timing entry by original index
        timing = next(
            (t for t in scene_timings if t.get("index") == orig_idx),
            None,
        )
        if timing is None:
            # No timing for this cena (rare edge case) — pass through
            cena_copy = dict(orig_cena)  # Copies all fields including v2 (image_prompt, mood, transitions)
            cena_copy["imagem_index"] = new_idx
            new_cenas.append(cena_copy)
            new_idx += 1
            continue

        duration = timing["duration"]
        narracao_text = (timing.get("narracao") or orig_cena.get("narracao", "")).strip()
        word_count = len(narracao_text.split()) if narracao_text else 0
        words_per_second = word_count / duration if duration > 0 else 0

        # Word-starved gate: a cena with very few words spanning a long time
        # is the hook/CTA case where align_srt absorbed the preamble or suffix
        # chunks that don't belong to any cena. Splitting by time alone would
        # produce 1-word sub-cenas like "Sobre", "o", "abismo", which is
        # semantically broken. Detect by speech rate: normal short-form speech
        # is >=1.5 w/s; below SCENE_MIN_WORDS_PER_SECOND it's word-starved.
        word_starved = (
            duration > max_duration
            and words_per_second < SCENE_MIN_WORDS_PER_SECOND
        )

        if duration <= max_duration or word_starved:
            # Short enough OR word-starved — pass through
            cena_copy = dict(orig_cena)
            cena_copy["imagem_index"] = new_idx
            cena_copy["duracao_segundos"] = round(duration, 2)
            new_cenas.append(cena_copy)
            new_timings.append({
                "index": new_idx,
                "start": timing["start"],
                "end": timing["end"],
                "duration": round(duration, 3),
                "narracao": narracao_text or orig_cena.get("narracao", ""),
            })
            new_idx += 1
            if word_starved:
                logger.info(
                    f"Cena {orig_idx} is long ({duration:.1f}s) but word-starved "
                    f"({word_count} words, {words_per_second:.2f} w/s) — skipping "
                    f"split (likely hook/CTA with absorbed preamble/suffix)"
                )
            continue

        # Cena is too long AND has enough words — split into N sub-cenas.
        # Additional safety: n_splits can't exceed word_count / MIN_WORDS_PER_SUB.
        ideal_splits = max(2, math.ceil(duration / target_duration))
        max_splits_by_words = max(1, word_count // SCENE_MIN_WORDS_PER_SUB)
        n_splits = min(ideal_splits, max_splits_by_words)
        if n_splits < 2:
            # Word budget too tight even though we passed the rate gate —
            # pass through.
            cena_copy = dict(orig_cena)
            cena_copy["imagem_index"] = new_idx
            cena_copy["duracao_segundos"] = round(duration, 2)
            new_cenas.append(cena_copy)
            new_timings.append({
                "index": new_idx,
                "start": timing["start"],
                "end": timing["end"],
                "duration": round(duration, 3),
                "narracao": narracao_text or orig_cena.get("narracao", ""),
            })
            new_idx += 1
            continue

        sub_dur = duration / n_splits
        # Don't create sub-cenas shorter than min — clamp
        if sub_dur < SCENE_MIN_DURATION:
            n_splits = max(1, int(duration / SCENE_MIN_DURATION))
            sub_dur = duration / n_splits

        # Re-apply the word-budget cap AFTER SCENE_MIN_DURATION clamp —
        # the clamp can push n_splits above the word budget, which would
        # pathologically shatter the narration into 1-word sub-cenas.
        n_splits = min(n_splits, max(1, word_count // SCENE_MIN_WORDS_PER_SUB))
        if n_splits < 2:
            # Word budget pushed us below 2 — pass through.
            cena_copy = dict(orig_cena)
            cena_copy["imagem_index"] = new_idx
            cena_copy["duracao_segundos"] = round(duration, 2)
            new_cenas.append(cena_copy)
            new_timings.append({
                "index": new_idx,
                "start": timing["start"],
                "end": timing["end"],
                "duration": round(duration, 3),
                "narracao": narracao_text or orig_cena.get("narracao", ""),
            })
            new_idx += 1
            continue
        sub_dur = duration / n_splits

        # Split the narration text proportionally by sentence/word boundaries.
        # _split_narration may cap n_splits further if the word budget is
        # tight — respect whatever it returns.
        narration_chunks = _split_narration(narracao_text, n_splits)
        if len(narration_chunks) != n_splits:
            n_splits = len(narration_chunks)
            sub_dur = duration / max(1, n_splits)
        if n_splits < 2:
            cena_copy = dict(orig_cena)
            cena_copy["imagem_index"] = new_idx
            cena_copy["duracao_segundos"] = round(duration, 2)
            new_cenas.append(cena_copy)
            new_timings.append({
                "index": new_idx,
                "start": timing["start"],
                "end": timing["end"],
                "duration": round(duration, 3),
                "narracao": narracao_text or orig_cena.get("narracao", ""),
            })
            new_idx += 1
            continue

        logger.info(
            f"Splitting cena {orig_idx} ({duration:.1f}s) into {n_splits} "
            f"sub-cenas of ~{sub_dur:.1f}s each"
        )

        for sub_i in range(n_splits):
            sub_start = timing["start"] + sub_i * sub_dur
            sub_end = timing["start"] + (sub_i + 1) * sub_dur
            # Last sub-cena claims any rounding remainder
            if sub_i == n_splits - 1:
                sub_end = timing["end"]

            sub_narracao = narration_chunks[sub_i] if sub_i < len(narration_chunks) else ""

            sub_cena = dict(orig_cena)  # Copies all fields including v2 (image_prompt, mood, transitions)
            sub_cena["imagem_index"] = new_idx
            sub_cena["duracao_segundos"] = round(sub_end - sub_start, 2)
            sub_cena["narracao"] = sub_narracao
            # Mark the sub-cena lineage for LLM context when generating variations
            sub_cena["_split_parent_idx"] = orig_idx
            sub_cena["_split_sub_idx"] = sub_i
            sub_cena["_split_total"] = n_splits
            sub_cena["_parent_legenda_overlay"] = orig_cena.get("legenda_overlay", "")
            new_cenas.append(sub_cena)

            new_timings.append({
                "index": new_idx,
                "start": round(sub_start, 3),
                "end": round(sub_end, 3),
                "duration": round(sub_end - sub_start, 3),
                "narracao": sub_narracao,
            })
            new_idx += 1

    new_script["cenas"] = new_cenas
    logger.info(
        f"Scene splitter: {len(original_cenas)} cenas → {len(new_cenas)} cenas "
        f"({len(new_cenas) - len(original_cenas)} sub-cenas added)"
    )
    return new_script, new_timings


def repair_shattered_script(script: dict) -> dict:
    """Detect and repair legacy "shattered" scripts where consecutive cenas
    hold a single word each ("Sobre", "o", "abismo,"...).

    This is the fingerprint of an older _split_narration bug that pathologically
    split N-word sentences into N single-word sub-cenas. The current splitter
    can't produce this shape anymore, but step_state JSON from legacy runs
    still holds it — and every downstream align/split/image-gen step trips on
    those one-word cenas.

    Algorithm:
    1. Scan for runs of ≥3 consecutive cenas where each has ≤1 word.
    2. Merge each run into a single cena with the joined narration and the
       summed duration, inheriting the first cena's imagem_index/legenda_overlay.
    3. If no shattered runs are found, return the input script unchanged
       (identity preserved, so callers can detect "no repair needed" via `is`).

    Returns the repaired script dict (new object) or the original script (same
    object) if no repair was needed.
    """
    cenas = script.get("cenas", [])
    if not cenas:
        return script

    # First pass: locate runs of 1-word cenas
    def wc(c: dict) -> int:
        return len((c.get("narracao") or "").strip().split())

    runs: list[tuple[int, int]] = []  # (start, end_exclusive)
    i = 0
    while i < len(cenas):
        if wc(cenas[i]) <= 1:
            j = i
            while j < len(cenas) and wc(cenas[j]) <= 1:
                j += 1
            if j - i >= 3:
                runs.append((i, j))
            i = j
        else:
            i += 1

    if not runs:
        return script

    new_script = deepcopy(script)
    new_cenas: list[dict] = []
    original = new_script["cenas"]
    cursor = 0
    for run_start, run_end in runs:
        # Keep cenas before the run as-is
        new_cenas.extend(original[cursor:run_start])
        # Merge the shattered run into a single cena
        merged_text = " ".join(
            (c.get("narracao") or "").strip() for c in original[run_start:run_end]
        ).strip()
        merged_dur = sum(
            float(c.get("duracao_segundos") or 0) for c in original[run_start:run_end]
        )
        template = dict(original[run_start])
        template["narracao"] = merged_text
        template["duracao_segundos"] = round(merged_dur, 2)
        # Clean split lineage markers if present
        for k in ("_split_parent_idx", "_split_sub_idx", "_split_total", "_parent_legenda_overlay"):
            template.pop(k, None)
        new_cenas.append(template)
        cursor = run_end
    # Tail after last run
    new_cenas.extend(original[cursor:])

    # Drop any completely empty cenas (0 words) as a belt-and-suspenders
    new_cenas = [c for c in new_cenas if (c.get("narracao") or "").strip()]

    # Reindex imagem_index sequentially
    for k, c in enumerate(new_cenas):
        c["imagem_index"] = k

    new_script["cenas"] = new_cenas
    logger.warning(
        f"repair_shattered_script: {len(runs)} shattered run(s) merged — "
        f"{len(cenas)} → {len(new_cenas)} cenas"
    )
    return new_script


def _split_narration(text: str, n_parts: int) -> list[str]:
    """Split a narration string into N roughly-equal parts.

    Splits on sentence boundaries first, then word boundaries if a sentence
    needs to span multiple parts. Each part gets approximately the same
    word count.

    Hard floor: each part must have at least SCENE_MIN_WORDS_PER_SUB words.
    If `n_parts` is larger than `word_count // SCENE_MIN_WORDS_PER_SUB`, it
    is capped so no sub-cena ends up with fewer than that many words.
    This prevents the "one word per sub-cena" bug where asking for 7 sub-
    cenas on a 7-word sentence used to return 7 single-word strings.
    """
    text = text.strip()
    if not text:
        return [text]
    if n_parts <= 1:
        return [text]

    word_count = len(text.split())
    # Hard cap: never produce sub-cenas with < SCENE_MIN_WORDS_PER_SUB words.
    # If the caller asked for more parts than the word budget allows, we
    # return FEWER parts. The caller must handle len(result) < n_parts.
    capped = max(1, word_count // SCENE_MIN_WORDS_PER_SUB)
    n_parts = min(n_parts, capped)
    if n_parts <= 1:
        return [text]

    # Try sentence-based split first
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) >= n_parts:
        # Distribute sentences across parts as evenly as possible
        parts: list[list[str]] = [[] for _ in range(n_parts)]
        per_part = len(sentences) / n_parts
        for i, sent in enumerate(sentences):
            slot = min(int(i / per_part), n_parts - 1)
            parts[slot].append(sent)
        return [" ".join(p) for p in parts]

    # Fewer sentences than parts — fall back to word-based split.
    # word_count >= n_parts * SCENE_MIN_WORDS_PER_SUB is guaranteed by the
    # cap above, so the pathological "pad with empty strings" case can't
    # happen anymore.
    words = text.split()
    per_part_words = len(words) / n_parts
    parts_text: list[str] = []
    for i in range(n_parts):
        start = int(i * per_part_words)
        end = int((i + 1) * per_part_words) if i < n_parts - 1 else len(words)
        parts_text.append(" ".join(words[start:end]))
    return parts_text


async def regenerate_split_legenda_overlays(script: dict, language: str = "pt-BR") -> dict:
    """Replace _parent_legenda_overlay markers with distinct LLM-generated variations.

    For each group of sub-cenas sharing the same _split_parent_idx, calls
    the LLM once to generate N distinct visual variations of the parent's
    legenda_overlay (different angles, zooms, focal points). Updates each
    sub-cena's `legenda_overlay` in place.

    No-op if the script has no split sub-cenas (all _split_parent_idx absent).
    """
    cenas = script.get("cenas", [])
    if not cenas:
        return script

    # Group sub-cenas by parent index
    groups: dict[int, list[dict]] = {}
    for cena in cenas:
        parent = cena.get("_split_parent_idx")
        if parent is None:
            continue
        groups.setdefault(parent, []).append(cena)

    if not groups:
        return script  # Nothing to do

    client = _get_client()
    new_script = deepcopy(script)
    cena_lookup = {id(c): nc for c, nc in zip(cenas, new_script["cenas"])}

    for parent_idx, sub_cenas in groups.items():
        n_subs = len(sub_cenas)
        parent_overlay = sub_cenas[0].get("_parent_legenda_overlay", "")
        narracoes = [c.get("narracao", "") for c in sub_cenas]

        if not parent_overlay:
            continue

        prompt = _build_variation_prompt(parent_overlay, narracoes, language)

        logger.info(
            f"Generating {n_subs} visual variations for split cena (parent={parent_idx})"
        )

        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=REELS_SCRIPT_MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "variations": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                            },
                        },
                        "required": ["variations"],
                    },
                ),
            )
            data = json.loads(response.text or "{}")
            variations = data.get("variations", [])
        except Exception as e:
            logger.warning(
                f"LLM variation generation failed for parent {parent_idx}: {e}"
            )
            variations = []

        # Apply variations (or fall back to parent overlay)
        for i, sub_cena in enumerate(sub_cenas):
            variation = variations[i] if i < len(variations) else parent_overlay
            new_cena = cena_lookup.get(id(sub_cena))
            if new_cena is not None:
                new_cena["legenda_overlay"] = variation

    # Strip the internal markers — pipeline downstream doesn't need them
    for c in new_script["cenas"]:
        c.pop("_split_parent_idx", None)
        c.pop("_split_sub_idx", None)
        c.pop("_split_total", None)
        c.pop("_parent_legenda_overlay", None)

    return new_script


def _build_variation_prompt(parent_overlay: str, narracoes: list[str], language: str) -> str:
    """Build the LLM prompt that requests N distinct visual variations."""
    n = len(narracoes)
    narracao_block = "\n".join(f"  {i+1}. {n}" for i, n in enumerate(narracoes))

    if language.startswith("pt"):
        return (
            f"Voce e um diretor de fotografia gerando descricoes visuais para "
            f"um Reel do Instagram.\n\n"
            f"Cenario base (cena original):\n{parent_overlay}\n\n"
            f"Esta cena foi DIVIDIDA em {n} sub-cenas para manter o ritmo visual "
            f"(2-4s por cena). Cada sub-cena tem sua propria narracao:\n{narracao_block}\n\n"
            f"GERE {n} variacoes visuais DISTINTAS do cenario base, uma para cada sub-cena. "
            f"Cada variacao deve:\n"
            f"- Manter coerencia visual com o cenario base (mesmo lugar, atmosfera, paleta)\n"
            f"- Variar angulo, enquadramento, foco ou detalhe (close-up, panorama, zoom em "
            f"elemento especifico, profile, perspective)\n"
            f"- Conectar com o conteudo da narracao da sub-cena correspondente\n"
            f"- Ter 15-30 palavras\n"
            f"- Ser auto-suficiente (descreve a cena visual completa)\n\n"
            f"Retorne JSON com array \"variations\" de {n} strings, na mesma ordem das "
            f"sub-cenas listadas acima."
        )
    elif language.startswith("es"):
        return (
            f"Eres un director de fotografia generando descripciones visuales para "
            f"un Reel de Instagram.\n\n"
            f"Escenario base (escena original):\n{parent_overlay}\n\n"
            f"Esta escena fue DIVIDIDA en {n} sub-escenas para mantener el ritmo visual "
            f"(2-4s por escena). Cada sub-escena tiene su propia narracion:\n{narracao_block}\n\n"
            f"GENERA {n} variaciones visuales DISTINTAS del escenario base, una para cada "
            f"sub-escena. Cada variacion debe:\n"
            f"- Mantener coherencia visual con el escenario base\n"
            f"- Variar angulo, encuadre, enfoque o detalle\n"
            f"- Conectar con el contenido de la narracion de la sub-escena correspondiente\n"
            f"- Tener 15-30 palabras\n\n"
            f"Devuelve JSON con array \"variations\" de {n} strings."
        )
    else:
        return (
            f"You are a cinematographer generating visual descriptions for an "
            f"Instagram Reel.\n\n"
            f"Base scene:\n{parent_overlay}\n\n"
            f"This scene was SPLIT into {n} sub-scenes to maintain visual rhythm "
            f"(2-4s per scene). Each sub-scene has its own narration:\n{narracao_block}\n\n"
            f"GENERATE {n} DISTINCT visual variations of the base scene, one per "
            f"sub-scene. Each variation must:\n"
            f"- Maintain visual coherence with the base scene (same location, atmosphere, palette)\n"
            f"- Vary the angle, framing, focus or detail (close-up, panorama, zoom on "
            f"specific element, profile, perspective)\n"
            f"- Connect to the content of the corresponding sub-scene narration\n"
            f"- Be 15-30 words\n"
            f"- Be self-contained\n\n"
            f"Return JSON with \"variations\" array of {n} strings, in the same order "
            f"as sub-scenes listed above."
        )
