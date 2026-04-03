# Phase 1001: Biblical Reels Category - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning
**Source:** Interactive discussion (21 areas)

<domain>
## Phase Boundary

Nova categoria "Historias Biblicas" integrada ao wizard de reels existente. Quando o usuario seleciona o nicho `biblical-stories` (tier 4), campos extras aparecem condicionalmente: toggle IA/Manual, lista de historias, toggle reflexao, slider duracao. O pipeline interativo de 7 steps continua igual. Inclui series completas com continuidade narrativa.

Nao inclui: novo wizard separado, efeitos sonoros por cena, dashboard analitico de performance biblica.

</domain>

<decisions>
## Implementation Decisions

### Modo de Roteiro
- Toggle IA/Manual aparece no step 'prompt' do wizard interativo quando nicho=biblical-stories
- **Modo IA:** Lista de historias pre-definidas (NT+AT) + campo livre para referencia biblica (ex: "Genesis 22", "Parabola do semeador"). Lista e atalho, campo livre aceita qualquer referencia.
- **Modo Manual:** Textarea livre onde usuario cola/digita o script completo. Pipeline quebra em cenas automaticamente (por paragrafo/marcadores).
- Ambos os modos seguem o pipeline interativo normal (script > tts > srt > images > clips > video)

### Fidelidade Biblica
- **Citacao literal prioritaria:** Usa texto biblico real como base, parafraseia apenas para fluir como narracao. Sempre inclui referencia de capitulo/versiculo.
- **Canon evangelico (66 livros):** Foco no canon protestante. Deuterocanonicos nao incluidos na lista pre-definida.
- Toggle "Incluir reflexao moderna" no wizard (default: ligado). Quando ligado, script termina com 2-3 frases conectando a historia com a vida atual.
- System prompt dedicado para modo biblico com guardrails contra alucinacao: "Siga fielmente o texto das Escrituras. Cite capitulo/versiculo. NAO invente fatos. NAO adicione personagens."
- Review humano obrigatorio no step 'script' — usuario revisa/edita antes de aprovar

### Estilo Visual
- **Ilustracao moderna/cartoon** estilo 'The Bible Project' no YouTube — acessivel e leve
- Personagem do canal NAO influencia cenas biblicas — DNA visual nao se aplica. Cenas sao 100% da historia.
- Claude decide se personagem aparece como narrador visual (moldura/intro) ou so narracao por voz — baseado no que faz sentido com o pipeline

### Estrutura do Wizard
- Integrado ao wizard existente — campos condicionais inline com animacao quando nicho=biblical-stories
- SubThemes mudam para historias biblicas especificas (Davi e Golias, Moises Mar Vermelho, etc). Ja tem 9 no nicho, expandir para ~20-30.
- Usar base do nicho `biblical-stories` existente (tier 4) e expandir com opcoes de roteiro IA/manual

### Narracao e TTS
- Tom **engajante e dramatico** — como contador de historias. Variacao de ritmo nos momentos-chave, calmo nas reflexoes.
- **Trilha cinematografica instrumental** de fundo (sem letra), volume baixo sob narracao. Sem efeitos sonoros individuais.

### Duracao e Ritmo
- **Opcao no wizard:** Slider de duracao (30-90s). Default: 60s para biblicos.
- **Numero de cenas:** Automatico baseado na duracao + sugestao configuravel. ~1 cena a cada 10-12s como baseline.

### Legendas e Versiculos
- Legendas SRT padrao durante narracao + **overlay especial** quando citar versiculo (fonte maior, cor diferente)
- **Referencia de versiculo sempre visivel na tela** quando citado — ex: "1 Samuel 17:40" discreto no canto
- Preview enriquecido no step 'script': versiculos destacados em cor diferente com referencias inline

### Monetizacao e Engajamento
- **CTAs:** Usar os 5 CTAs existentes do nicho biblical-stories + expandir
- **Hashtags:** Set fixo automatico: #historiasbiblicas #biblia #fe #deus #jesus #versiculododia
- Adicionadas automaticamente ao publicar

### Multi-idioma
- **Multi-idioma desde o inicio:** PT-BR, EN, ES
- Cada idioma com traducao biblica apropriada (NVI para PT-BR, NIV para EN, NVI espanhol para ES)
- Script gerado no idioma selecionado no wizard

### Thumbnail/Capa
- **Cena mais dramatica + texto:** Selecao automatica da cena mais impactante + overlay com titulo da historia
- Estilo consistente com ilustracao moderna

### Transicoes
- **Crossfade suave** entre cenas. Tom reverente e cinematografico. Consistente com estilo Bible Project.

### Series Completas
- Campo `series_id` (FK nullable) + `part_number` (int) no ReelsJob
- Series como entidade simples com titulo e descricao
- Suporte a continuidade narrativa, playlist, numeracao automatica
- UI para criar serie, adicionar partes, visualizar sequencia

### Integracao com Personagem
- DNA visual do personagem **NAO influencia cenas biblicas** — estilo e fixo (ilustracao moderna)
- Personagem afeta apenas voz/tom da narracao e marca do canal

### Backend
- Claude decide: reusar endpoints existentes com campos extras ou criar rota separada
- Campo `bible_config` (JSON) no ReelsJob: story_ref, script_mode (ai/manual), include_reflection, bible_version

### Teste E2E
- **Script de teste end-to-end via CLI:** Comando que cria reel biblico de teste (historia curta, 3 cenas, 30s) e verifica: script gerado, imagens criadas, video montado, versiculos presentes
- Usa creditos reais mas valida o fluxo completo

### Claude's Discretion
- Escolha tecnica de como implementar o system prompt dedicado para Gemini
- Estrutura exata do campo `bible_config` no backend
- Se personagem aparece como narrador visual ou apenas voz
- Implementacao backend (reusar endpoint vs novo)
- Quais historias biblicas iniciais na lista pre-definida (~20-30 opcoes NT+AT)
- Como serializar series no frontend (playlist UI)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reels Pipeline
- `src/reels_pipeline/main.py` — Pipeline principal com 7 steps
- `src/reels_pipeline/script_gen.py` — Geracao de scripts via Gemini (onde system prompt biblico sera adicionado)
- `src/reels_pipeline/image_gen.py` — Geracao de imagens por cena
- `src/reels_pipeline/video_builder.py` — Montagem final do video com transicoes

### Frontend Wizard
- `memelab/src/app/(app)/reels/page.tsx` — Wizard de criacao (GenerationForm component)
- `memelab/src/components/reels/reel-niches.ts` — Definicao dos nichos incluindo `biblical-stories` tier 4

### API e Models
- `src/api/routes/reels.py` — Endpoints de reels (interactive, step approve)
- `src/database/models.py` — ReelsJob, ReelsConfig models (onde bible_config e series_id serao adicionados)

### Steps Interativos
- `memelab/src/app/(app)/reels/[jobId]/` — Paginas dos steps interativos (onde preview enriquecido sera implementado)

</canonical_refs>

<specifics>
## Specific Ideas

- Estilo visual referencia: 'The Bible Project' (YouTube) — ilustracao moderna, acessivel, clean
- Trilha sonora referencia: cinematografica instrumental tipo soundtrack biblico (sem vocais)
- Transicoes: crossfade suave, reverente
- Lista de historias: mix NT+AT, foco evangelico (66 livros)
- Preview do script: versiculos em cor diferente com referencia inline

</specifics>

<deferred>
## Deferred Ideas

- Efeitos sonoros por cena (trovao, agua, espadas) — complexidade alta, fase futura
- Dashboard analitico de performance de reels biblicos vs outros nichos
- Validacao automatica por IA de fidelidade biblica (segundo call ao Gemini)
- Checklist automatico de existencia de referencias biblicas

</deferred>

---

*Phase: 1001-biblical-reels-category*
*Context gathered: 2026-04-03 via interactive discussion*
