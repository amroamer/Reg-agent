#!/usr/bin/env bash
# Backup PostgreSQL database
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/reginspector_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up RegInspector database..."

docker exec ri-postgres pg_dump -U reginspector -d reginspector | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($FILESIZE)"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -t reginspector_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

REMAINING=$(ls reginspector_*.sql.gz 2>/dev/null | wc -l)
echo "Backups retained: $REMAINING (max 7)"
