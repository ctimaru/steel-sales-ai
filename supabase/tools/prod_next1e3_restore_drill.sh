#!/usr/bin/env bash
# PROD-NEXT1.E3 — disposable logical backup / restore proof.
# Only synthetic rows and a forced local Supabase connection are permitted.
# This is NOT a backup of production data or Supabase Storage.
set -euo pipefail

if [[ "$(printenv CI || true)" != "true" ]]; then
  echo "E3 refuses execution outside CI; never point this script at a remote DB." >&2
  exit 2
fi
if [[ "$(printenv E3_LOCAL_RESTORE_ACK || true)" != "disposable-local-only" ]]; then
  echo "E3 requires explicit disposable-local-only acknowledgement." >&2
  exit 2
fi

readonly HOST=127.0.0.1
readonly PORT=54322
readonly USER=postgres
readonly SOURCE=postgres
readonly FIXTURE_SCHEMA=prod_next1e3_fixture
readonly TARGET=prod_next1e3_restore_fixture
readonly TEMP_DIR="$(mktemp -d)"
TARGET_CREATED=0
SCHEMA_CREATED=0

psql_local() {
  local database="$1"
  shift
  psql -X -h "$HOST" -p "$PORT" -U "$USER" -d "$database" -v ON_ERROR_STOP=1 "$@"
}
cleanup() {
  if [[ "$TARGET_CREATED" -eq 1 ]]; then
    dropdb -h "$HOST" -p "$PORT" -U "$USER" --if-exists "$TARGET" >/dev/null 2>&1 || true
  fi
  if [[ "$SCHEMA_CREATED" -eq 1 ]]; then
    psql_local "$SOURCE" -q -c "drop schema if exists $FIXTURE_SCHEMA cascade" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

# Port is fixed; enforce local development database identity and closed pilot gate.
[[ "$(psql_local "$SOURCE" -At -c "select current_database()")" == "postgres" ]] || exit 2
[[ "$(psql_local "$SOURCE" -At -c "select enabled::text from private.pilot_activation_release_gate where singleton")" == "false" ]] || {
  echo "E3 NO-GO assertion failed; refusing restore fixture." >&2
  exit 2
}
[[ "$(psql_local "$SOURCE" -At -c "select count(*) from public.marketplace_pilot_participants where status='active'")" == "0" ]] || {
  echo "E3 requires an empty active cohort." >&2
  exit 2
}

# The only source records are deliberately synthetic, isolated from all application tables.
psql_local "$SOURCE" -q <<'SQL'
create schema prod_next1e3_fixture;
create table prod_next1e3_fixture.receipts (
  sequence_id integer primary key,
  decision text not null,
  classification text not null check (classification='SYNTHETIC_CI_ONLY')
);
insert into prod_next1e3_fixture.receipts(sequence_id,decision,classification)
values
  (1,'denied','SYNTHETIC_CI_ONLY'),
  (2,'withdrawn','SYNTHETIC_CI_ONLY');
SQL
SCHEMA_CREATED=1

EXPECTED="$(psql_local "$SOURCE" -At -c "select md5(string_agg(sequence_id::text||':'||decision||':'||classification,'|' order by sequence_id)) from $FIXTURE_SCHEMA.receipts")"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$SOURCE" \
  --format=custom --no-owner --no-acl --schema="$FIXTURE_SCHEMA" \
  --file="$TEMP_DIR/synthetic-only.backup"
[[ -s "$TEMP_DIR/synthetic-only.backup" ]] || exit 1

createdb -h "$HOST" -p "$PORT" -U "$USER" -T template0 "$TARGET"
TARGET_CREATED=1
pg_restore -h "$HOST" -p "$PORT" -U "$USER" -d "$TARGET" \
  --no-owner --no-acl --exit-on-error "$TEMP_DIR/synthetic-only.backup"
RESTORED="$(psql_local "$TARGET" -At -c "select md5(string_agg(sequence_id::text||':'||decision||':'||classification,'|' order by sequence_id)) from $FIXTURE_SCHEMA.receipts")"
COUNT="$(psql_local "$TARGET" -At -c "select count(*) from $FIXTURE_SCHEMA.receipts")"
[[ "$EXPECTED" == "$RESTORED" && "$COUNT" == "2" ]] || {
  echo "E3 synthetic database restoration failed integrity check." >&2
  exit 1
}

# A filesystem byte round-trip is only a synthetic object fixture. It is NOT
# a Supabase Storage API restore and must never be described as one.
printf 'PROD-NEXT1.E3 / SYNTHETIC OBJECT / NO CUSTOMER CONTENT\n' > "$TEMP_DIR/synthetic-object"
cp "$TEMP_DIR/synthetic-object" "$TEMP_DIR/restored-object"
cmp -s "$TEMP_DIR/synthetic-object" "$TEMP_DIR/restored-object" || exit 1

echo "E3 PASS — disposable synthetic logical backup and independent DB restore, 2 verified rows."
echo "E3 PASS — synthetic object byte round-trip (not Supabase Storage restore)."
echo "E3 NO-GO — no production backup, Storage recovery or live pilot authorization is proven."
