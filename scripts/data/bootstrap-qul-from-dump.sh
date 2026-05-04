#!/usr/bin/env bash
# Bootstrap QUL data from the public mini Postgres dump.
#
# Per Docs/research/qul-inventory.md §4 + ADR-0020. The dump URL is
# documented in the QUL repo README; it's labeled "limited subset of
# data, specifically selected for local development and testing." That's
# exactly what we need to populate the Qalaam ingest pipeline end-to-end
# without scraping the live site.
#
# Pipeline:
#   1. Download + verify the dump.
#   2. Boot a throwaway Postgres in Docker.
#   3. Restore the dump.
#   4. Export each Qalaam-relevant resource as JSON into data/qul-source/.
#   5. Tear down the Postgres.
#
# After this script, run the ingest scripts:
#   tsx scripts/data/ingest-qul-metadata.ts
#   tsx scripts/data/ingest-qul-mutashabihat-v2.ts
#   ...

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/data/qul-source"
DUMP_URL="${QUL_DUMP_URL:-https://static-cdn.tarteel.ai/qul/mini-dumps/mini_quran_dev.sql.zip}"
DUMP_DIR="${REPO_ROOT}/data/qul-dump"
PG_CONTAINER="qalaam-qul-bootstrap-pg"
PG_DB="quran_dev"
PG_USER="postgres"
PG_PASS="qalaam-bootstrap-only"
PG_PORT="${QUL_BOOTSTRAP_PG_PORT:-15433}"

# Sudo-A wrapper so docker access works in environments where the user
# isn't in the docker group.
if [[ -n "${SUDO_ASKPASS:-}" ]] && [[ -x "${SUDO_ASKPASS:-}" ]]; then
    DOCKER="sudo -A docker"
else
    DOCKER="docker"
fi

cleanup() {
    if [[ -z "${KEEP_PG:-}" ]]; then
        ${DOCKER} rm -f "${PG_CONTAINER}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

mkdir -p "${SOURCE_DIR}" "${DUMP_DIR}"

echo "[1/5] Downloading dump from ${DUMP_URL}"
DUMP_ZIP="${DUMP_DIR}/mini_quran_dev.sql.zip"
DUMP_SQL="${DUMP_DIR}/mini_quran_dev.sql"
if [[ ! -f "${DUMP_ZIP}" ]] || [[ -n "${FORCE_REDOWNLOAD:-}" ]]; then
    curl --silent --show-error --location --fail --retry 5 --retry-delay 3 \
        --output "${DUMP_ZIP}" "${DUMP_URL}"
fi
if [[ ! -f "${DUMP_SQL}" ]] || [[ -n "${FORCE_REDOWNLOAD:-}" ]]; then
    rm -f "${DUMP_SQL}"
    unzip -q -o "${DUMP_ZIP}" -d "${DUMP_DIR}"
    # The zip may extract to a nested name; normalize.
    if [[ ! -f "${DUMP_SQL}" ]]; then
        FOUND="$(find "${DUMP_DIR}" -maxdepth 2 -type f -name '*.sql' | head -1)"
        [[ -n "${FOUND}" ]] && mv "${FOUND}" "${DUMP_SQL}"
    fi
fi
[[ -f "${DUMP_SQL}" ]] || { echo "ERR: SQL dump not extracted." >&2; exit 2; }
echo "    SQL dump: $(stat -c '%s' "${DUMP_SQL}") bytes"

echo "[2/5] Booting throwaway Postgres 17 in Docker (port ${PG_PORT})"
${DOCKER} rm -f "${PG_CONTAINER}" >/dev/null 2>&1 || true
${DOCKER} run -d --name "${PG_CONTAINER}" \
    -e POSTGRES_DB="${PG_DB}" \
    -e POSTGRES_USER="${PG_USER}" \
    -e POSTGRES_PASSWORD="${PG_PASS}" \
    -p "127.0.0.1:${PG_PORT}:5432" \
    postgres:17-alpine >/dev/null

echo "    Waiting for Postgres to accept connections..."
for _ in {1..30}; do
    if ${DOCKER} exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "[3/5] Pre-creating roles + restoring dump"
# The dump references a 'naveedahmad' role as object owner. Pre-create
# it so ALTER … OWNER TO naveedahmad doesn't ERROR — Postgres accepts
# the dump but emits warnings otherwise.
${DOCKER} exec "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" -c \
    "CREATE ROLE naveedahmad LOGIN; GRANT ALL ON DATABASE ${PG_DB} TO naveedahmad;" \
    >/dev/null 2>&1 || true

# Pipe the dump through psql with -v ON_ERROR_STOP=0 so non-fatal owner
# warnings don't abort the load. Discard stdout (only need stderr line
# count for diagnostics).
${DOCKER} exec -i "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" --quiet -v ON_ERROR_STOP=0 \
    < "${DUMP_SQL}" >/dev/null 2>&1 || true

TABLE_COUNT="$(${DOCKER} exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -tAc \
    "SELECT count(*) FROM pg_tables WHERE schemaname='quran'")"
echo "    Tables loaded in 'quran' schema: ${TABLE_COUNT}"
[[ "${TABLE_COUNT}" -gt 5 ]] || { echo "ERR: dump load failed — too few tables." >&2; exit 2; }

echo "[4/5] Exporting resources to ${SOURCE_DIR}"
# Copy the dispatcher script into the container and run it inside.
${DOCKER} cp "${SCRIPT_DIR}/_qul-export.sql" "${PG_CONTAINER}:/tmp/_qul-export.sql"
${DOCKER} exec "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" -f /tmp/_qul-export.sql -tAo /tmp/qul-export.json
${DOCKER} cp "${PG_CONTAINER}:/tmp/qul-export.json" "${SOURCE_DIR}/_raw-export.json"
python3 "${SCRIPT_DIR}/_qul-export-split.py" \
    "${SOURCE_DIR}/_raw-export.json" "${SOURCE_DIR}"

echo "[5/5] Tearing down Postgres"
# trap handles cleanup; just confirm the export files.
echo
echo "Source files written:"
ls -la "${SOURCE_DIR}"/*.json | grep -v _raw-export
echo
echo "Next: run the ingest scripts."
echo "  tsx scripts/data/ingest-qul-metadata.ts"
echo "  tsx scripts/data/ingest-qul-mutashabihat-v2.ts"
echo "  tsx scripts/data/ingest-qul-wbw.ts"
