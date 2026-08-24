#!/usr/bin/env bash
# Automated PostgreSQL + PostGIS Database Backup Script
# System: Andhra Pradesh Intelligence System (APIS)

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/apis_db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "================================================================"
echo " STARTING DATABASE BACKUP: ${TIMESTAMP}"
echo " Destination: ${BACKUP_FILE}"
echo "================================================================"

PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump \
  -h "${POSTGRES_HOST:-127.0.0.1}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-ap_evidence}" \
  --clean --if-exists --create \
  | gzip > "${BACKUP_FILE}"

echo "✓ Database backup completed successfully: ${BACKUP_FILE}"
echo "================================================================"
