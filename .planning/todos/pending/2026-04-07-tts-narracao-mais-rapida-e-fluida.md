---
created: 2026-04-07T14:50:00.000Z
title: TTS narracao mais rapida e fluida, menos espacos entre frases
area: api
files:
  - src/reels_pipeline/tts.py
  - src/reels_pipeline/models.py:132
---

## Problem

A narração gerada pelo TTS ainda está lenta e entediante para shorts/reels, mesmo após o hotfix que subiu o default de speed de 1.0 → 1.2 (commit 28d331a). Especificamente:

1. **Velocidade geral ainda devagar** — 1.2x não é suficiente para o ritmo de TikTok/Reels, que tipicamente roda em 1.3-1.5x
2. **Espaços entre frases longos demais** — Gemini TTS insere pausas naturais entre sentenças que ficam perceptíveis no áudio final. Reels virais têm narração "corrida", quase sem respirar
3. **Ritmo não é compatível com short-form** — narração de podcast/documentário ≠ narração de reel. Reels precisam de urgência, energia, "não pode parar"

Reproduction: reel 034 áudio gerado com speed=1.2, ainda soa lento comparado a reels virais de referência.

## Solution

Abordagem multi-ângulo (fazer todas ou escolher):

### 1. Subir default de speed para 1.35-1.4
Em `src/reels_pipeline/tts.py` linha 109 (`speaking_rate = speed or 1.2`), mudar fallback para **1.35**. Em `src/reels_pipeline/models.py` linhas 132 e 163 (`tts_speed: Optional[float] = 1.2`), mudar para **1.35**. Isso afeta só defaults — quem quiser narração lenta (ex: conteúdo devocional, meditação) ainda pode passar speed explicitamente.

### 2. Ajustar o prompt TTS para reduzir pausas
Em `src/reels_pipeline/tts.py` no `tts_prompt`, adicionar instrução explícita: "Minimize pauses between sentences. Deliver with short-form content energy — urgency and continuous flow. No dramatic dead-air pauses." Isso é prompt engineering, Gemini TTS responde bem a direções explícitas.

### 3. Pós-processar o áudio com ffmpeg para comprimir silêncios
Depois que o áudio é gerado, aplicar ffmpeg `silenceremove` ou `atempo` filter para:
- Detectar silêncios > 300ms e comprimi-los para 150-200ms
- OU aplicar atempo=1.05 globalmente (acelera 5% sem mudar pitch)

Exemplo ffmpeg:
```
ffmpeg -i audio.wav -af "silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-30dB" audio_tight.wav
```

### 4. Por-tipo-de-conteúdo: tom "energetic" vs "devotional"
Em `_TONE_STYLE_PROMPTS` (tts.py), adicionar/reforçar tones:
- `energetic` / `viral`: "Speak FAST with energy, urgency. Minimize pauses. TikTok/Reels style."
- `devotional` / `biblical`: mantém o atual (pausas reverentes são desejáveis)

O config do job já tem `tone` — só passar pelo prompt builder corretamente.

### Prioridade de implementação
1. Primeiro: opção 1 (trivial, 3 linhas) + opção 2 (prompt edit)
2. Testar em reel 034 (regenerar apenas o step TTS, sem novos clips)
3. Se ainda não satisfizer, adicionar opção 3 (ffmpeg silenceremove)

### Verification
- Regenerar step TTS de um reel existente com novos defaults
- Comparar áudio antigo vs novo por duração (espera: ~15-20% mais curto)
- Áudio final do reel deve ter < 55s de duração para um script que tinha 60s de target (porque acelerou)
- Subjetivo: escutar e comparar com reels virais de referência
