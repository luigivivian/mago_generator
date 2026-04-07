---
created: 2026-04-06T22:30:54.007Z
title: Refatorar pipeline para gerar esqueleto do editor antes do video final
area: api
files:
  - src/reels_pipeline/main.py
  - src/api/routes/reels.py
  - memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx
  - memelab/src/hooks/use-editor.ts
  - memelab/src/remotion/ReelComposition.tsx
---

## Problem

Atualmente a pipeline gera o video final automaticamente ao final do fluxo interativo. O usuario nao tem oportunidade de validar e editar o video (cortar cenas, ajustar timing, reordenar) antes da renderizacao final. Isso desperdiça creditos de renderizacao e tempo quando o resultado nao agrada.

O fluxo ideal é:
1. Pipeline gera os assets (roteiro, imagens, audio, legendas)
2. Pipeline monta o "esqueleto" do editor (metadata das cenas com timings, sem video final)
3. Usuario é enviado ao editor visual (Remotion) para validar e ajustar
4. Só após aprovação no editor, o video final é renderizado

## Solution

- Modificar a pipeline para parar antes da etapa de composição de video final
- Ao invés de gerar `final.mp4`, gerar apenas o editor state (JSON com cenas, timings, paths de assets)
- Redirecionar o usuario automaticamente para `/reels/{jobId}/edit` após a pipeline completar os assets
- No editor, adicionar botão "Renderizar Final" que dispara a composição do video
- Manter a opção de renderização automatica como flag opcional para fluxos batch/automatizados
