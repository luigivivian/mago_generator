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
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 1000 to break down)
