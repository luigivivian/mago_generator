# Requirements: Milestone v4.0 — Pipeline Fidelity Refactor

**Goal:** Alinhar a pipeline de reels com o princípio-âncora "áudio é a âncora, tudo se alinha a ele" (ref: `pipeline-historia-narracao-imagem.md`), eliminando aproximações char-offset e tornando o fluxo determinístico — mantendo Gemini TTS como único provedor.

**Reference doc:** `/Users/luigivivian/meme-lab/pipeline-historia-narracao-imagem.md`
**Baseline study:** Gap analysis executed via Explore agent on 2026-04-08 (see conversation history).

---

## v4.0 Requirements

### TTS Anchoring (per-cena audio generation)

- [ ] **TTS-01**: `run_step_tts` gera um arquivo de áudio Gemini TTS por cena do roteiro (em vez de um único arquivo para `narracao_completa`)
- [ ] **TTS-02**: Cada arquivo per-cena tem sua duração medida via `ffprobe` imediatamente após a geração
- [ ] **TTS-03**: Durações per-cena são persistidas em `step_state.tts.cenas[i].duration` (float segundos) junto com o path do arquivo
- [ ] **TTS-04**: `narracao_completa` continua gerada (para compat com editor que mostra waveform único), mas é concatenada das cenas per-cena via ffmpeg, não gerada isoladamente
- [x] **TTS-05**: Quando `tone == "biblical"`, `speaking_rate` é forçado a `1.0` (remove a contradição entre style prompt "fale devagar" e default `1.35x`)
- [x] **TTS-06**: Falha de geração de uma cena específica não derruba a pipeline inteira — cena falhada é retentada com backoff, e se persistir é reportada com `cena_failed` no step_state para regen seletiva

### Audio-Anchored Timing (clip trimming e SRT usando durações per-cena)

- [ ] **TIMING-01**: `concat_clips_with_audio` consome `tts.cenas[i].duration` diretamente como ground truth para trimming de clips Kie.ai (elimina char-offset fallback)
- [ ] **TIMING-02**: `scene_timings` (estrutura consumida pelo clip trimming e SRT) é construída somando durações per-cena: `start = sum(cenas[0..i-1].duration)`, `end = start + cenas[i].duration`
- [ ] **TIMING-03**: `align_srt_with_script` (método char-offset) é substituído por construção direta a partir de `tts.cenas[i].duration` — o SRT é gerado sobre o arquivo per-cena individualmente e depois deslocado pela soma das durações anteriores
- [ ] **TIMING-04**: Editor (`step_state.editor.audioItems`) continua recebendo `total_duration` correto (soma das per-cena durations), mantendo compatibilidade com Bug 7 fix em `ReelComposition.tsx`
- [ ] **TIMING-05**: `cursor` acumulado usa `round(cursor * 1000) / 1000` para evitar erro de float (ref doc seção 9 — "Cenas desalinhadas após a terceira")

### Script Schema v2 (roteiro canônico)

- [ ] **SCRIPT-01**: `ROTEIRO_SCHEMA` em `script_gen.py` adiciona campo top-level `character_card: {description: string, style_seed: string}` — anexado a todo `image_prompt` que envolva o personagem
- [ ] **SCRIPT-02**: Cada cena ganha campo `image_prompt: string` em inglês no formato 4-layer (`subject, environment, visual_style, camera, aspect ratio, no text, no watermark`) — separado de `legenda_overlay`
- [ ] **SCRIPT-03**: Cada cena ganha campo `mood: enum("mysterious", "dramatic", "hopeful", "tense", "calm", "sad", "epic")` — usado downstream para lighting guidance e Ken Burns preset
- [ ] **SCRIPT-04**: Cada cena ganha campos `transition_in: enum("fade", "cut", "dissolve", "slide")` e `transition_out` — substituindo o `transition_type` global em `video_builder`
- [ ] **SCRIPT-05**: System prompt do LLM de roteiro atualizado para gerar o novo schema; bible prompts atualizados para respeitar os mesmos campos
- [ ] **SCRIPT-06**: Migration de compatibilidade: roteiros legacy (sem os campos novos) continuam renderizando com defaults (`mood=calm`, `transition_in/out=fade`, `image_prompt` derivado de `legenda_overlay`)

### Image Generation (prompts estruturados)

- [ ] **IMAGE-01**: `generate_reel_images_per_cena` usa `cena.image_prompt` como prompt primário (não mais `narracao + legenda_overlay`)
- [ ] **IMAGE-02**: Quando `character_card` está presente no roteiro, seu `style_seed` é prepended a cada prompt per-cena automaticamente
- [ ] **IMAGE-03**: `BIBLE_STYLE_DNA` continua funcionando mas é combinado com o `image_prompt` per-cena (style DNA global + prompt específico), não sobrepõe
- [ ] **IMAGE-04**: Aspect ratio (`9:16`, `16:9`, etc.) é sempre explícito no prompt final enviado ao Gemini Image

### Mood-Driven Ken Burns

- [ ] **MOTION-01**: Pattern fixo even/odd em `video_builder.py:218-228` é substituído por mapa `mood → kenBurnsPreset` (ex: `mysterious → slow_zoom_in`, `dramatic → diagonal`, `hopeful → slow_zoom_out`, `tense → pan_left`, `calm → slow_zoom_in`, `sad → slow_zoom_out`, `epic → diagonal`)
- [ ] **MOTION-02**: Presets definidos com `{startScale, endScale, panX, panY}` conforme referência do doc seção 6.3
- [ ] **MOTION-03**: Ken Burns é aplicado também no path `concat_clips_with_audio` (economic mode / Kie.ai clips), não só em `build_reel_video` (static slideshow) — hoje só rola no segundo
- [ ] **MOTION-04**: Easing configurável entre `linear` e `ease-in-out` via `REELS_KENBURNS_EASING` (default `ease-in-out` conforme recomendação do doc para movimento natural)
- [ ] **MOTION-05**: Ken Burns só é aplicado quando a duração da cena (derivada de `tts.cenas[i].duration`) é `> 6s` — mantém regra do doc

---

## Future Requirements (deferred)

- **TTS-F1**: ElevenLabs integration — word-level timestamps nativos, melhor qualidade de TTS. Explicitamente fora de escopo do v4.0 por decisão do usuário (manter Gemini TTS como único provedor).
- **SCRIPT-F1**: SRT export separado do vídeo final como deliverable — hoje só é burned-in.
- **SCRIPT-F2**: WebVTT export (conversão trivial do SRT, ponto no lugar da vírgula).
- **MOTION-F1**: Transições `slide` com direção configurável (left/right/up/down).
- **SUB-F1**: Enforcement de limites de legibilidade no SRT (min 1.0s, max 7.0s, 42 chars/linha, 2 linhas máx) — hoje só há validação de timestamps inválidos.

---

## Out of Scope (v4.0)

- **ElevenLabs / multi-provider TTS** — decisão explícita do usuário de manter só Gemini TTS
- **Ads pipeline (`src/ads_pipeline/`)** — v4.0 é exclusivamente reels; ads tem seu próprio fluxo e não sofre com os mesmos gaps
- **Meme manual pipeline (`src/pipeline_cli.py`)** — v4.0 não toca nela
- **Features do editor (frontend `memelab/src/`)** — separado, coberto por Phase 999.15 (backlog) e debug sessions
- **Mudança de modelo Kie.ai / Hailuo** — v4.0 assume os modelos atuais
- **Subtitle style refactor** (CSS, fontes, posicionamento) — fora de escopo, é visual
- **Character consistency via Leonardo AI / SD ControlNet** — doc menciona mas v4.0 mantém o passing de refs multimodais atual do Gemini

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TTS-01 | Phase 22 | Pending |
| TTS-02 | Phase 22 | Pending |
| TTS-03 | Phase 22 | Pending |
| TTS-04 | Phase 22 | Pending |
| TTS-05 | Phase 22 | Complete |
| TTS-06 | Phase 22 | Complete |
| TIMING-01 | Phase 23 | Pending |
| TIMING-02 | Phase 23 | Pending |
| TIMING-03 | Phase 23 | Pending |
| TIMING-04 | Phase 23 | Pending |
| TIMING-05 | Phase 23 | Pending |
| SCRIPT-01 | Phase 24 | Pending |
| SCRIPT-02 | Phase 24 | Pending |
| SCRIPT-03 | Phase 24 | Pending |
| SCRIPT-04 | Phase 24 | Pending |
| SCRIPT-05 | Phase 24 | Pending |
| SCRIPT-06 | Phase 24 | Pending |
| IMAGE-01 | Phase 25 | Pending |
| IMAGE-02 | Phase 25 | Pending |
| IMAGE-03 | Phase 25 | Pending |
| IMAGE-04 | Phase 25 | Pending |
| MOTION-01 | Phase 26 | Pending |
| MOTION-02 | Phase 26 | Pending |
| MOTION-03 | Phase 26 | Pending |
| MOTION-04 | Phase 26 | Pending |
| MOTION-05 | Phase 26 | Pending |

**Coverage:** 26/26 v4.0 requirements mapped (100%). No orphans.

---

*Last updated: 2026-04-08 — Roadmap v4.0 defined (5 phases, 22-26)*
