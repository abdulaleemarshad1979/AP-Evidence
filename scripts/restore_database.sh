#!/usr/bin/env bash
# Automated PostgreSQL + PostGIS Database Restore Script
# System: Andhra Pradesh Intelligence System (APIS)

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file ${BACKUP_FILE} does not exist."
  exit 1
fi

echo "================================================================"
echo " STARTING DATABASE RESTORE"
echo " Target Backup: ${BACKUP_FILE}"
echo "================================================================"

gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
  -h "${POSTGRES_HOST:-127.0.0.1}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-ap_evidence}"

echo "✓ Database restore completed successfully."
echo "================================================================"
