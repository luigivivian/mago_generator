# CreatorLab

Pipeline multi-agente para criacao automatizada de conteudo visual — memes, video ads cinematicos, reels e imagens com IA.

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async), MySQL
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, SWR
- **IA**: Google Gemini (imagens), Kling v3 (video), Kie.ai (video gateway)
- **Infra**: Vercel (frontend), MySQL local (dev)

## Setup

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env  # configurar DATABASE_URL, API keys

# Frontend
cd cretorlab && npm install

# Iniciar tudo
make dev
```

## Comandos

```bash
make dev        # Backend (8000) + Frontend (3000)
make api        # Apenas backend
make front      # Apenas frontend
make restart    # Reiniciar backend
make kill       # Matar processos nas portas 8000/3000
make backup     # Exportar assets + banco para zip
make restore FILE=<arquivo.zip>  # Importar backup
```

## Backup & Restore

Ferramenta para exportar e importar todos os assets gerados e o banco de dados.

### Exportar

```bash
make backup
# ou
./scripts/backup.sh export
```

Gera um arquivo `cretorlab-backup-YYYYMMDD_HHMMSS.zip` na raiz do projeto contendo:

- **Database dump** completo (MySQL)
- **Assets**: ads, backgrounds, memes, reels, videos, fonts
- **Manifest** com metadata do backup

### Importar

```bash
make restore FILE=cretorlab-backup-20260413_015806.zip
# ou
./scripts/backup.sh import cretorlab-backup-20260413_015806.zip
```

O import:

1. Restaura o banco de dados (drop + create + import do SQL dump)
2. Restaura assets via merge (nao deleta arquivos existentes)
3. Aguarda 3s antes de sobrescrever o banco (Ctrl+C para abortar)

Apos importar, reinicie o backend: `make restart`

## Estrutura

```
cretor-lab/
  src/                    # Backend Python
    api/routes/           # Rotas FastAPI
    product_studio/       # Pipeline v2 de video ads
    video_gen/            # Client Kling/Kie.ai
    reels_pipeline/       # Pipeline de reels
    database/             # Models, migrations, repos
    auth/                 # JWT auth
  cretorlab/              # Frontend Next.js
    src/app/              # App Router pages
    src/components/       # React components
    src/lib/              # API client, utils
    src/hooks/            # SWR hooks
  output/                 # Assets gerados
    ads/                  # Video ads pipeline output
    backgrounds_generated/# Backgrounds via Gemini/ComfyUI
    memes/                # Memes compostos
    reels/                # Reels output
    videos/               # Videos gerados
  assets/                 # Assets estaticos
    backgrounds/          # Imagens de referencia
    fonts/                # Fontes
  scripts/                # Scripts utilitarios
    backup.sh             # Backup/restore
  config.py               # Configuracao central
```
