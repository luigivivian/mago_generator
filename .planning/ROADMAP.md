# Roadmap: Clip-Flow

## Completed Milestones

- [x] **v1.0**: Auth, Rate Limiting & Gemini Image Fix — 11 phases, 25/25 requirements, completed 2026-03-24 — [details](milestones/v1.0-ROADMAP.md)
- [x] **v2.0**: Pipeline Simplification, Auto-Publicacao & Multi-Tenant — 17 phases, 72/77 requirements, completed 2026-04-01 — [details](milestones/v2.0-ROADMAP.md)

## Backlog

### Phase 999.9: Kie API credit system with per-model pricing, logs, and balance management (BACKLOG)

**Goal:** Sistema de creditos para chamadas Kie API espelhando precos reais por modelo. Controle de saldo, bloqueio de chamadas sem credito, tela de logs com custo por chamada, e tela para adicionar creditos ao usuario.

**Requirements:**
- Pesquisar precos atualizados de todos modelos Kie AI (https://kie.ai/pt/pricing)
- Parametrizar custo por modelo (ex: Hailuo 2.3 Standard, Sora 2, etc.)
- Tabela de creditos por usuario com saldo atual
- Decrementar creditos automaticamente a cada chamada Kie API conforme modelo usado
- Bloquear chamadas quando saldo insuficiente (pre-check antes de enviar)
- Tela de logs: historico completo de chamadas com modelo, duracao, custo, timestamp
- Tela simples para adicionar creditos ao usuario (admin)
- Salvar todas chamadas no banco (sucesso e falha)

**Plans:** 4/4 plans complete

Plans:
- [x] 999.9-01-PLAN.md — Schema, migration, CREDIT_COSTS config, CreditService with tests
- [x] 999.9-02-PLAN.md — Gate all Kie API call paths (video, reels, ads) with credit pre-check
- [x] 999.9-03-PLAN.md — Credits API routes (balance, logs, admin top-up)
- [x] 999.9-04-PLAN.md — Frontend /credits page with balance card, logs table, admin top-up

### Phase 1000: Character-scoped navigation

**Goal:** Adicionar seletor de personagem na sidebar que filtra todo conteudo do app. Cada personagem tem sua propria galeria, videos, reels, ads, temas e publicacoes. Ao mudar de personagem, todas as paginas mostram apenas conteudo daquele personagem.

**Requirements:**
- Seletor de personagem na sidebar (dropdown ou lista) persistente entre paginas
- Context global (React Context) com personagem selecionado acessivel em todas as paginas
- Gallery filtrada por character_slug selecionado
- Videos filtrados por character_slug selecionado
- Reels filtrados por character_slug selecionado
- Ads filtrados por character_slug selecionado
- Themes filtrados por character_slug selecionado
- Publishing filtrado por character_slug selecionado
- Backend: todos endpoints de listagem aceitam ?character_slug= como filtro
- Persistir personagem selecionado no localStorage para manter entre sessoes

**Depends on:** None
**Plans:** 3/3 plans complete

Plans:
- [x] 1000-01-PLAN.md — Backend: migration + character_slug on all listing endpoints
- [x] 1000-02-PLAN.md — Frontend: API functions, SWR hooks, and page wiring
- [x] 1000-03-PLAN.md — "Todos os Personagens" option in sidebar selector

### Phase 1001: Biblical reels category

**Goal:** Nova categoria "Historias Biblicas" no wizard de reels. Gemini gera narrativas biblicas fieis ao texto original, sem alterar a historia. O roteiro guia a geracao de cenas, imagens e narracoes animadas. Opcao no wizard para gerar roteiro via IA (Gemini) ou inserir roteiro manual no input.

**Requirements:**
- Nova categoria "Historias Biblicas" no wizard de reels (dropdown de nicho)
- Gemini gera roteiro fiel a historia biblica selecionada (nao altera fatos)
- Opcao "Gerar roteiro com IA" vs "Roteiro manual" no wizard
- Roteiro manual: textarea livre onde usuario cola/digita o script completo
- Roteiro IA: usuario seleciona historia (ex: "David e Golias") e Gemini gera script narrativo
- Script gerado segue fielmente a historia — sem licenca poetica ou alteracoes
- Cenas do reels animam elementos da historia (cenarios biblicos, personagens, acoes)
- Prompt de geracao de imagens adaptado para estilo biblico/historico
- Narracoes TTS seguem o roteiro gerado fielmente
- Categoria deve funcionar com o pipeline interativo existente (step-by-step)

**Depends on:** None
**Plans:** 5/5 plans complete

Plans:
- [x] 1001-01-PLAN.md — DB schema (bible_config, series) + stories data + request model
- [x] 1001-02-PLAN.md — Biblical system prompts + image style bypass + API config flow
- [x] 1001-03-PLAN.md — Frontend wizard: BibleConfig component + subThemes expansion
- [x] 1001-04-PLAN.md — Verse highlighting + series CRUD + pipeline image wiring + verse overlay in video
- [x] 1001-05-PLAN.md — Unit tests + E2E CLI test for biblical reels pipeline

### Phase 999.10: Full in-browser video editor (BACKLOG)

**Goal:** Editor de video completo e intuitivo integrado ao memeLab, estilo VEED.io. Permite editar o video final cena por cena: mover frames, cortar, duplicar, estender cenas, customizar transicoes, reposicionar legendas, configurar voz/narracao. UI dedicada com timeline, preview ao vivo, e controles drag-and-drop.

**Requirements:**
- Timeline visual com tracks de video, audio e legendas
- Edicao cena por cena: cortar, duplicar, estender, reordenar via drag-and-drop
- Preview ao vivo do video durante edicao
- Customizacao de transicoes entre cenas (tipo, duracao, easing)
- Editor de legendas: mover, redimensionar, editar texto, estilizar fonte/cor
- Configuracao de voz: selecionar voz TTS, ajustar velocidade, regenerar por cena
- Controles de audio: volume, fade in/out, timing
- Export do video final editado (server-side Remotion CLI render)
- UI responsiva e intuitiva com atalhos de teclado
- Undo/redo completo

**Plans:** 8/8 plans complete (08 = verified-via-proxy through 999.11)

Plans:
- [x] 999.10-01-PLAN.md — Install Remotion + deps, type definitions, Zustand store with undo/redo
- [x] 999.10-02-PLAN.md — Backend PATCH editor-state + POST export-remotion endpoints, frontend API functions
- [x] 999.10-03-PLAN.md — Remotion compositions: ReelComposition, Scene, SubtitleOverlay, Root
- [x] 999.10-04-PLAN.md — Editor page layout, Remotion Player preview, Toolbar
- [x] 999.10-05-PLAN.md — Multi-track timeline with drag-and-drop, trim handles, zoom, ruler
- [x] 999.10-06-PLAN.md — Properties panel, subtitle inline editor, context menu
- [x] 999.10-07-PLAN.md — Autosave hook, full component wiring, "Editar Video" entry points
- [x] 999.10-08-PLAN.md — Human verification (verified-via-proxy via 999.11 + active usage)

### Phase 999.11: Editor critical bugs — data integrity and stability fixes (BACKLOG)

**Goal:** Fix critical and high-severity bugs in the video editor that cause data corruption, silent failures, and poor UX.

**Requirements:**
- Fix SRT fetch race condition in loadFromStepState (abort stale fetches)
- Fix AudioContext leak on zoom (singleton context, resample peaks client-side)
- Fix freezeFrame missing subtitle/audio cascade shift
- Fix video left-trim having no start-offset semantics (add trimFrom to EditorScene)
- Fix contentEditable subtitle text lost on re-render (local draft state)
- Fix duplicate subtitle IDs in parseSrt and splitSubtitle (use genId)
- Fix trimScene cascade delta ignoring min-duration clamp
- Fix autosave timer/request leak after unmount (AbortController)
- Fix context menu stale startFrame offset on split
- Remove duplicate playhead sync (RAF + timeupdate)

**Plans:** 3/3 plans complete

Plans:
- [x] 999.11-01-PLAN.md — Extract pure functions to lib/editor/ with tests, fix Date.now() IDs
- [x] 999.11-02-PLAN.md — Fix trimScene clamp, freezeFrame cascade, add trimFrom + Remotion wiring
- [x] 999.11-03-PLAN.md — Fix AudioContext leak, autosave cleanup, SRT fetch race, contentEditable, playhead dedup, context menu stale offset

### Phase 999.12: Editor UX enhancements — pro editing features (BACKLOG)

**Goal:** Improve the video editor UX with features commonly found in professional editors (VEED, CapCut, Descript-style).

**Requirements:**
- Safe-zone guides overlay for TikTok/Instagram UI danger zones
- Multi-select on timeline for bulk operations
- Snap-to-grid/playhead during drag and trim
- Auto-pause playback when dragging subtitle overlay
- Per-clip volume control with UI slider
- Arrow-key nudging for fine-positioning subtitles/audio
- Zoom-to-fit button to reset timeline view
- Click-outside-to-deselect on empty timeline areas
- Export progress indicator with polling
- Pre-export validation (gaps, overlaps, out-of-bounds audio)
- Resizable timeline panel height
- Per-track mute/solo toggle
- Subtitle style presets (save/apply)

**Plans:** 6/6 plans complete

Plans:
- [x] 999.12-01-PLAN.md — Multi-select model + bulk ops + click-deselect
- [x] 999.12-02-PLAN.md — Snap, nudge, auto-pause subtitle drag
- [x] 999.12-03-PLAN.md — Per-clip volume + per-track mute/solo + zoom-to-fit
- [x] 999.12-04-PLAN.md — Safe-zone overlay + resizable timeline panel
- [x] 999.12-05-PLAN.md — Pre-export validation + export progress modal
- [x] 999.12-06-PLAN.md — Subtitle style presets

### Phase 999.13: Editor audio × subtitle × scene sync via temporal anchors (BACKLOG)

**Goal:** Optimize automatic audio/subtitle/scene synchronization in the editor so the final video is tightly aligned and doesn't feel slow. Currently the final video drags and subtitles drift off their audio during auto-assembly — the user has to edit manually to fix.

**Symptoms observed (2026-04-07, job 8303e35e26e9411b):**
- Final video paced too slowly (scenes stay on screen longer than their narration warrants)
- Subtitles don't land on the audio they correspond to after auto-assembly
- Narration, scenes, and subtitles feel like they're on independent timelines instead of one coherent story
- **Narration voice pace is too slow — feels boring/entediante**

**Requirements:**
- Introduce a shared temporal anchor model: every scene, narration segment, and subtitle entry references the same set of timestamps derived from a single source of truth (likely the word-level transcription output)
- Scene durations should derive from narration anchors, not from the script's `duracao_segundos` hint (which is a pre-TTS estimate, not reality)
- Subtitles align to actual TTS word timings (from Whisper/transcription step) instead of the pre-TTS script
- Auto-assembly step must enforce: `sum(scene.duration) == sum(narration.duration) == last_subtitle.end` (no drift)
- Preserve manual-edit overrides: once the user touches a scene/subtitle in the editor, auto-sync should not clobber it
- Consider whether scene boundaries should SNAP to sentence boundaries in the transcription (so a scene never cuts mid-sentence)
- **Bump TTS default speed for a more energetic/engaging delivery** — current speed feels lethargic for short-form content. Check `tts_speed` default in `ReelsConfig` / `step_state.config` (currently likely 1.0) and raise to ~1.15–1.25. Expose as a per-job override in the config panel so user can dial it in per niche (bible/creation narratives may want slower, memes/trends want faster)

**Plans:** 1/1 plan complete

Plans:
- [x] 999.13-01-PLAN.md — Drift assertion + TTS config UI cleanup (root causes addressed in earlier commits 21a1831, 8957444, 392c0db, 260407-2cj)

### Phase 999.14: Economic asset mode — Ken Burns + longer scenes to slash Kie costs (BACKLOG)

**Goal:** Cut reel generation costs by 70-80% via the "Ken Burns" strategy: use fewer, longer scenes with motion applied in the editor (zoom, pan, fade) instead of many short scenes each requiring a paid Hailuo clip.

**Cost problem observed (2026-04-07, job 8303e35e26e9411b):**
- 25 scenes × 90 credits/clip (Hailuo Pro) = 2250 credits per reel
- User had to deposit extra credits mid-session because the splitter was producing too many cenas
- At Hailuo Pro pricing (~$0.63/call), a 30s reel costs ~$15.75 in video-gen alone

**Economic formula target:**
- 30s reel = 4-5 assets (not 15-20)
- 15s reel = 2-3 assets
- 45s short = 6-8 assets
- With Ken Burns applied: 1 AI image + editor motion = 1 scene of 5-8s
- With AI video: clips of 4-5s, 3-4 concatenated = ready reel

**Visual techniques to keep attention on longer static scenes:**
- Ken Burns: slow zoom in on image (ffmpeg `zoompan` filter)
- Horizontal pan on wider images
- Cross-fade between two versions of the same scene
- Animated text overlay during the dwell
- Blur transition between scenes
- Split-screen with two AI images simultaneously

**Requirements:**
- New config mode `economic` (opposite of the current "max dynamism"): generates 4-6 cenas for 30s instead of 15-20
- Script_gen prompt must accept this mode and adjust n_cenas/min_cenas/max_cenas formulas accordingly (e.g., `duracao // 6` for economic vs `duracao // 3` for dynamic)
- scene_splitter must accept a `max_assets` parameter — when hit, stop subdividing long cenas even if duration exceeds max
- Video assembly step must apply Ken Burns automatically when `config.economic_mode=True` AND the cena has `duracao_segundos > 4.0`: ffmpeg `zoompan` filter with slow zoom-in OR panned pan depending on the image composition
- New UI toggle in reel config: "Dynamic (15-20 cenas)" vs "Economic (4-6 cenas + Ken Burns)"
- Cost indicator in UI shows estimated credit cost BEFORE clicking Generate, so user can choose the mode based on budget

**Implementation sketch:**
- `script_gen.py`: add `economic_mode` branch in `_get_bible_system_prompt` and `generate_script` that uses wider `min_cenas`/`max_cenas`
- `scene_splitter.py`: add `max_assets` kwarg to `split_long_scenes_in_script`
- `video_builder.py`: add `_apply_ken_burns(clip_path, duration)` that uses ffmpeg zoompan on static images, only active when `config.economic_mode`
- `models.py`: add `economic_mode: bool = False` to `ReelsConfig`
- Frontend reel config page: toggle + live cost preview based on target_duration × cenas × model credit cost

**Plans:** 2/2 plans complete

Plans:
- [x] 999.14-01-PLAN.md — Backend: migration + ReelsConfig field + pipeline bypass + splitter bypass
- [x] 999.14-02-PLAN.md — Frontend: toggle + cost preview + Ken Burns motion in Remotion Scene
