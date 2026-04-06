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

**Plans:** 3/4 plans executed

Plans:
- [x] 999.9-01-PLAN.md — Schema, migration, CREDIT_COSTS config, CreditService with tests
- [x] 999.9-02-PLAN.md — Gate all Kie API call paths (video, reels, ads) with credit pre-check
- [x] 999.9-03-PLAN.md — Credits API routes (balance, logs, admin top-up)
- [ ] 999.9-04-PLAN.md — Frontend /credits page with balance card, logs table, admin top-up

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
- [ ] 1000-03-PLAN.md — "Todos os Personagens" option in sidebar selector

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
- [ ] 1001-04-PLAN.md — Verse highlighting + series CRUD + pipeline image wiring + verse overlay in video
- [x] 1001-05-PLAN.md — Unit tests + E2E CLI test for biblical reels pipeline

### Phase 999.10: Full in-browser video editor (BACKLOG)

**Goal:** Editor de video completo e intuitivo integrado ao memeLab, estilo VEED.io. Permite editar o video final cena por cena: mover frames, cortar, duplicar, estender cenas, customizar transicoes, reposicionar legendas, configurar voz/narração. UI dedicada com timeline, preview ao vivo, e controles drag-and-drop.

**Requirements:**
- Timeline visual com tracks de video, audio e legendas
- Edicao cena por cena: cortar, duplicar, estender, reordenar via drag-and-drop
- Preview ao vivo do video durante edicao
- Customizacao de transicoes entre cenas (tipo, duracao, easing)
- Editor de legendas: mover, redimensionar, editar texto, estilizar fonte/cor
- Configuracao de voz: selecionar voz TTS, ajustar velocidade, regenerar por cena
- Controles de audio: volume, fade in/out, timing
- Export do video final editado (server-side FFmpeg render)
- UI responsiva e intuitiva com atalhos de teclado
- Undo/redo completo

**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
