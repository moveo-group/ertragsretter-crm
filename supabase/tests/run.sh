#!/usr/bin/env bash
# Spielt Stub + Migrationen + Seed in eine frische lokale Datenbank und führt die Rechte-Tests aus.
# Voraussetzung: lokaler Postgres-Server. Verbindung über PGHOST/PGPORT/PGUSER.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=ertragsretter_test
psql -q -c "drop database if exists $DB" postgres
psql -q -c "create database $DB" postgres
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run tests/supabase_stub.sql
for f in migrations/*.sql; do run "$f"; done
run seed.sql
run tests/rls_test.sql
