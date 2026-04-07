---
created: 2026-04-07T14:12:01.716Z
title: Fix align_srt_with_script greedy-match preamble bug
area: api
files:
  - src/reels_pipeline/transcriber.py:232-346
  - src/reels_pipeline/test_transcriber_align.py
---

## Problem

The new `align_srt_with_script` (introduced in commit 45d04d5, quick task 260407-2cj) has a greedy-match bug that breaks alignment whenever the audio narration includes hook/cenário/lição/CTA text that is NOT inside any individual `cena.narracao`.

**Symptom (reproducible on job 8303e35e26e9411b):**
- Script has 12 cenas, each with short `narracao` like "Sobre o abismo, trevas. Espírito de Deus pairava."
- The audio's `narracao_completa` includes ~350 chars of preamble (gancho + cenário) BEFORE the first cena.narracao text appears
- Result: `scene_timings` contains only ONE entry — cena 0 with `start: 0.308, end: 81.98, duration: 81.672` (the entire 60s reel)
- Cenas 1-11 have no scene_timings entry at all
- Editor at http://localhost:3000/reels/8303e35e26e9411b/edit shows scene 0 as 81 seconds long, the rest fall back to default duration

**Root cause:** The current algorithm walks SRT chunks sequentially trying to accumulate enough text to satisfy `difflib.SequenceMatcher.ratio() >= 0.75` against `cena.narracao`. When the first 5+ chunks are preamble that doesn't appear in cena 0's text, the accumulated `claimed_text` grows much longer than the short `target` (cena 0 narracao). Long-vs-short comparison kills the difflib ratio, so the threshold never fires. The loop just keeps consuming. When `is_last == False` for cena 0 it would normally break on threshold, but the threshold never hits, so it consumes everything. Then because cena 0 is greedy, by the time it returns, `entry_idx` is at the end and cenas 1-11 hit the `if entry_idx >= len(entries): continue` early-skip.

The reel's roteiro.json structure:
- `narracao_completa` = 840 chars (full audio script: hook + cenário + 12 cenas + lição + CTA)
- `sum(c.narracao for c in cenas)` = 490 chars (only 58% of the audio)
- The other 42% is preamble + lesson + CTA — text that exists in the audio but not in any cena.narracao

## Solution

Replace difflib walking with **character-offset proportional mapping**:

1. Use `script.narracao_completa` as source of truth (the full text that was sent to TTS)
2. For each `cena.narracao`, find its char_start in `narracao_completa` via `str.find` with a fallback for paraphrased text
3. Compute `char_end` = next cena's char_start (or len(narracao_completa) for the last one)
4. Get total audio duration from the last SRT entry's end timestamp
5. Map: `time_start = (char_start / total_chars) * audio_duration`, same for end
6. Snap each computed time to the nearest SRT chunk boundary (so spans align to real word timings, not interpolated time)

**Edge cases:**
- Paraphrased cena text (LLM may rewrite slightly): fall back to fuzzy match via difflib `get_close_matches` against sentence-split narracao_completa to find the best anchor sentence
- Missing `narracao_completa`: fallback to current difflib behavior (the bug is only when narracao_completa has preamble)
- First cena starts mid-audio: that's OK — preamble chunks just don't belong to any cena, they show up in the SRT but not in scene_timings

**Test updates required:**
- `test_full_audio_coverage` and `test_sentence_snap` in `src/reels_pipeline/test_transcriber_align.py` will need rewriting since the new algorithm intentionally leaves hook/cenario/lesson/cta chunks outside cena spans
- Add new test: fixture with narracao_completa containing preamble, verify scene_timings has N entries (one per cena), verify cena 0 doesn't claim preamble chunks
- Add new test: paraphrased cena text falls back to fuzzy anchor

**Manual workaround until fixed:** Sync the editor's scene durations manually in the UI, or run a SQL UPDATE on `step_state.srt.scene_timings` setting per-cena durations to `audio_duration / n_cenas` (uniform fallback).

This bug also touches phase 999.13 (Editor temporal anchors) — when that phase is properly planned, this fix should be folded in.
