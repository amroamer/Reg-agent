#!/usr/bin/env bash
# Restore PostgreSQL database from backup
set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/reginspector_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will DROP and recreate the reginspector database."
echo "Backup file: $BACKUP_FILE"
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "Dropping and recreating database..."
docker exec ri-postgres psql -U reginspector -d postgres -c "DROP DATABASE IF EXISTS reginspector;"
docker exec ri-postgres psql -U reginspector -d postgres -c "CREATE DATABASE reginspector OWNER reginspector;"

echo "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i ri-postgres psql -U reginspector -d reginspector

echo "Database restored successfully from: $BACKUP_FILE"
