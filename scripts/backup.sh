#!/usr/bin/env bash
# backup.sh — Export/import all assets + database
# Usage:
#   ./scripts/backup.sh export          → creates cretorlab-backup-YYYYMMDD.zip at project root
#   ./scripts/backup.sh import <file>   → restores from zip at project root

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PROJECT_ROOT}/.venv/bin/python3"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$HOME/.pyenv/versions/3.12.8/bin/python3"
fi

# DB credentials from .env
DB_NAME="cretorlab"
DB_USER="root"
DB_PASS="masterkey"
DB_HOST="localhost"

# Asset directories to backup (relative to PROJECT_ROOT)
ASSET_DIRS=(
  "output/ads"
  "output/backgrounds_generated"
  "output/memes"
  "output/reels"
  "output/videos"
  "assets/backgrounds"
  "assets/fonts"
)

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[backup]${NC} $*"; }
warn() { echo -e "${YELLOW}[backup]${NC} $*"; }
err()  { echo -e "${RED}[backup]${NC} $*" >&2; }

# ── Export ──
do_export() {
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_name="cretorlab-backup-${timestamp}"
  local tmp_dir="${PROJECT_ROOT}/.tmp/${backup_name}"

  log "Starting export..."
  mkdir -p "${tmp_dir}"

  # 1. Database dump
  log "Dumping database ${DB_NAME}..."
  if command -v mysqldump &>/dev/null; then
    mysqldump -u "${DB_USER}" -p"${DB_PASS}" -h "${DB_HOST}" \
      --skip-lock-tables --quick \
      "${DB_NAME}" 2>/dev/null > "${tmp_dir}/database.sql"
    local db_size
    db_size=$(du -sh "${tmp_dir}/database.sql" | cut -f1)
    log "  Database dump: ${db_size}"
  else
    err "mysqldump not found — skipping database"
    warn "Install mysql client: brew install mysql-client"
  fi

  # 2. Copy asset directories
  log "Copying assets..."
  local total_files=0
  for dir in "${ASSET_DIRS[@]}"; do
    local src="${PROJECT_ROOT}/${dir}"
    if [[ -d "$src" ]]; then
      local dest="${tmp_dir}/assets/${dir}"
      mkdir -p "$(dirname "$dest")"
      cp -R "$src" "$dest"
      local count
      count=$(find "$dest" -type f | wc -l | tr -d ' ')
      total_files=$((total_files + count))
      log "  ${dir}: ${count} files"
    else
      warn "  ${dir}: not found, skipping"
    fi
  done
  log "Total asset files: ${total_files}"

  # 3. Manifest
  cat > "${tmp_dir}/manifest.json" << EOF
{
  "version": "1.0",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project": "cretorlab",
  "database": "${DB_NAME}",
  "asset_dirs": $(printf '%s\n' "${ASSET_DIRS[@]}" | jq -R . | jq -s .),
  "total_files": ${total_files}
}
EOF

  # 4. Zip
  log "Compressing..."
  local zip_path="${PROJECT_ROOT}/${backup_name}.zip"
  (cd "${PROJECT_ROOT}/.tmp" && zip -r -q "${zip_path}" "${backup_name}")

  # 5. Cleanup temp
  rm -rf "${tmp_dir}"

  local zip_size
  zip_size=$(du -sh "${zip_path}" | cut -f1)
  echo ""
  log "${GREEN}Export complete!${NC}"
  log "  File: ${CYAN}${backup_name}.zip${NC}"
  log "  Size: ${zip_size}"
  log "  Files: ${total_files} assets + database dump"
}

# ── Import ──
do_import() {
  local zip_file="$1"

  # Resolve path
  if [[ ! "$zip_file" = /* ]]; then
    zip_file="${PROJECT_ROOT}/${zip_file}"
  fi

  if [[ ! -f "$zip_file" ]]; then
    err "File not found: ${zip_file}"
    exit 1
  fi

  log "Starting import from $(basename "$zip_file")..."

  local tmp_dir="${PROJECT_ROOT}/.tmp/restore_$$"
  mkdir -p "${tmp_dir}"

  # 1. Extract
  log "Extracting..."
  unzip -q "$zip_file" -d "${tmp_dir}"

  # Find the actual backup directory inside (zip contains one top-level dir)
  local backup_dir
  backup_dir=$(find "${tmp_dir}" -maxdepth 1 -mindepth 1 -type d | head -1)
  if [[ -z "$backup_dir" ]]; then
    err "Invalid backup: no directory found inside zip"
    rm -rf "${tmp_dir}"
    exit 1
  fi

  # Validate manifest
  if [[ ! -f "${backup_dir}/manifest.json" ]]; then
    err "Invalid backup: missing manifest.json"
    rm -rf "${tmp_dir}"
    exit 1
  fi

  log "Manifest:"
  cat "${backup_dir}/manifest.json" | $PYTHON -m json.tool 2>/dev/null || cat "${backup_dir}/manifest.json"
  echo ""

  # 2. Restore database
  if [[ -f "${backup_dir}/database.sql" ]]; then
    log "Restoring database ${DB_NAME}..."
    warn "  This will OVERWRITE the current database. Ctrl+C to abort (3s)..."
    sleep 3

    if command -v mysql &>/dev/null; then
      # Drop and recreate
      mysql -u "${DB_USER}" -p"${DB_PASS}" -h "${DB_HOST}" \
        -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\`;" 2>/dev/null
      mysql -u "${DB_USER}" -p"${DB_PASS}" -h "${DB_HOST}" \
        "${DB_NAME}" < "${backup_dir}/database.sql" 2>/dev/null
      log "  Database restored"
    else
      err "  mysql client not found — skipping database restore"
      warn "  Manual: mysql -u root -pmasterkey cretorlab < database.sql"
    fi
  else
    warn "No database.sql in backup — skipping"
  fi

  # 3. Restore assets
  if [[ -d "${backup_dir}/assets" ]]; then
    log "Restoring assets..."
    local restored=0

    # Walk the asset structure inside backup
    for dir in "${ASSET_DIRS[@]}"; do
      local src="${backup_dir}/assets/${dir}"
      local dest="${PROJECT_ROOT}/${dir}"
      if [[ -d "$src" ]]; then
        mkdir -p "$(dirname "$dest")"
        # Use rsync to merge (don't delete existing files not in backup)
        if command -v rsync &>/dev/null; then
          rsync -a "$src/" "$dest/"
        else
          cp -R -n "$src/." "$dest/" 2>/dev/null || cp -R "$src/." "$dest/"
        fi
        local count
        count=$(find "$src" -type f | wc -l | tr -d ' ')
        restored=$((restored + count))
        log "  ${dir}: ${count} files"
      fi
    done
    log "Total restored: ${restored} files"
  else
    warn "No assets directory in backup — skipping"
  fi

  # 4. Cleanup
  rm -rf "${tmp_dir}"

  echo ""
  log "${GREEN}Import complete!${NC}"
  log "Restart the API to pick up database changes: ${CYAN}make restart${NC}"
}

# ── Main ──
case "${1:-}" in
  export)
    do_export
    ;;
  import)
    if [[ -z "${2:-}" ]]; then
      err "Usage: $0 import <backup-file.zip>"
      exit 1
    fi
    do_import "$2"
    ;;
  *)
    echo "Usage:"
    echo "  $0 export              Create backup zip at project root"
    echo "  $0 import <file.zip>   Restore from backup zip"
    exit 1
    ;;
esac
