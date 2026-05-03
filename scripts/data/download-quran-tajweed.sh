#!/usr/bin/env bash
# Download quran/quran-tajweed (CC-BY-4.0) per-character tajweed annotations.
# Per ADR-0002: drives tajweed-colored mushaf rendering.

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

require_cmd curl
require_cmd sha256sum

OUT="${QALAAM_DATA_DIR}/quran-tajweed.json"
URL="${QURAN_TAJWEED_URL:-https://raw.githubusercontent.com/quran/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json}"
SHA256="${QURAN_TAJWEED_SHA256:-PENDING_FIRST_DOWNLOAD}"

if [[ -f "${OUT}" && -z "${FORCE_REDOWNLOAD:-}" ]]; then
    ok "quran-tajweed already present at ${OUT}"
    exit 0
fi

if [[ "${SHA256}" == "PENDING_FIRST_DOWNLOAD" ]]; then
    log "quran-tajweed: bootstrap fetch (no SHA pinned yet)"
    curl --silent --show-error --location --fail \
         --output "${OUT}" "${URL}" \
        || die "Download failed: ${URL}"
    log "Computed SHA256: $(sha256sum "${OUT}" | awk '{print $1}')"
    log "Pin QURAN_TAJWEED_SHA256 in this script before merging."
else
    fetch_with_sha256 "${URL}" "${SHA256}" "${OUT}"
fi

ok "quran-tajweed ready at ${OUT}"
