#!/usr/bin/env bash
# Download QUL SQLite (TarteelAI/quranic-universal-library, MIT) per ADR-0002.
#
# The URL + SHA256 are pinned to a known-good release. Bumping requires
# explicit human review of the QUL changelog (per ADR-0002 risk mitigation).

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

require_cmd curl
require_cmd sha256sum
require_cmd sqlite3

# TODO(qalaam): replace with the actual QUL release URL + SHA after first
# successful download, then commit. The placeholder below documents the
# expected source per ADR-0002.
QUL_VERSION="${QUL_VERSION:-pending}"
QUL_URL="${QUL_URL:-https://qul.tarteel.ai/exports/qul-${QUL_VERSION}.sqlite}"
QUL_SHA256="${QUL_SHA256:-PENDING_FIRST_DOWNLOAD}"
QUL_OUT="${QALAAM_DATA_DIR}/qul.sqlite"

if [[ -f "${QUL_OUT}" ]]; then
    if [[ -n "${FORCE_REDOWNLOAD:-}" ]]; then
        log "FORCE_REDOWNLOAD set — removing existing ${QUL_OUT}"
        rm -f "${QUL_OUT}"
    else
        ok "QUL already present at ${QUL_OUT} (set FORCE_REDOWNLOAD=1 to refetch)"
        exit 0
    fi
fi

if [[ "${QUL_SHA256}" == "PENDING_FIRST_DOWNLOAD" ]]; then
    log "QUL_SHA256 not pinned. Doing one-time bootstrap fetch."
    log "After successful download, run 'sha256sum ${QUL_OUT}' and commit the value to this script."
    curl --silent --show-error --location --fail \
         --retry 5 --retry-delay 3 \
         --output "${QUL_OUT}" \
         "${QUL_URL}" \
        || die "Download failed. The QUL_URL placeholder may need updating — check qul.tarteel.ai"
    log "Computed SHA256: $(sha256sum "${QUL_OUT}" | awk '{print $1}')"
    log "Update QUL_SHA256 in this script before merging."
else
    fetch_with_sha256 "${QUL_URL}" "${QUL_SHA256}" "${QUL_OUT}"
fi

# Quick integrity check
log "Verifying SQLite integrity"
sqlite3 "${QUL_OUT}" 'PRAGMA integrity_check;' | grep -qi '^ok$' \
    || die "SQLite integrity check failed for ${QUL_OUT}"

ensure_lfs_tracked 'data/qul.sqlite'
ok "QUL ready at ${QUL_OUT}"
