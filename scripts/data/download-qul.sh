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
    if [[ -z "${QALAAM_BOOTSTRAP_QUL:-}" ]]; then
        die "QUL_SHA256 not pinned and QALAAM_BOOTSTRAP_QUL is unset.
Per ADR-0002, the QUL SQLite must be content-pinned before any build uses it
so a tampered or replaced upstream file cannot enter the data layer silently.

To bootstrap a brand-new pin (one-time, requires human review of the QUL
changelog at https://qul.tarteel.ai):
  1. export QUL_VERSION=<version>            # e.g., 2026-01
  2. export QUL_URL=<actual-release-url>     # from the QUL exports page
  3. export QALAAM_BOOTSTRAP_QUL=1
  4. ./scripts/data/download-qul.sh
  5. ./scripts/data/compute-qul-sha.sh        # prints the SHA256
  6. Edit this script: set QUL_SHA256=<value> and unset QALAAM_BOOTSTRAP_QUL.
  7. Commit BOTH the pinned URL and SHA in the same change with the QUL
     release notes referenced in the commit message."
    fi
    log "BOOTSTRAP MODE — QUL_SHA256 not yet pinned."
    log "After download, run scripts/data/compute-qul-sha.sh and pin the SHA."
    curl --silent --show-error --location --fail \
         --retry 5 --retry-delay 3 \
         --output "${QUL_OUT}" \
         "${QUL_URL}" \
        || die "Download failed. The QUL_URL may need updating — check qul.tarteel.ai"
    log "Bootstrap fetch complete. Computed SHA256: $(sha256sum "${QUL_OUT}" | awk '{print $1}')"
    log "Pin this value in QUL_SHA256 above and re-run without QALAAM_BOOTSTRAP_QUL."
else
    fetch_with_sha256 "${QUL_URL}" "${QUL_SHA256}" "${QUL_OUT}"
fi

# Quick integrity check
log "Verifying SQLite integrity"
sqlite3 "${QUL_OUT}" 'PRAGMA integrity_check;' | grep -qi '^ok$' \
    || die "SQLite integrity check failed for ${QUL_OUT}"

ensure_lfs_tracked 'data/qul.sqlite'
ok "QUL ready at ${QUL_OUT}"
