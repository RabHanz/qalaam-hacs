#!/usr/bin/env bash
# Download cpfair/quran-align (CC-BY-4.0) timing JSON for the default reciter set.
# Per ADR-0002: used as fallback when QUL doesn't carry segments for a reciter.

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

require_cmd curl
require_cmd sha256sum

OUT_DIR="${QALAAM_DATA_DIR}/quran-align"
mkdir -p "${OUT_DIR}"

# Default reciter set — matches Habibi-TTS targets (per ADR-0006) and the
# Tarteel Quranly UX competitive set (§21).
declare -A RECITERS=(
    [alafasy]="https://github.com/cpfair/quran-align/releases/download/v1.2/alafasy.json"
    [husary]="https://github.com/cpfair/quran-align/releases/download/v1.2/husary.json"
    [abdul-basit]="https://github.com/cpfair/quran-align/releases/download/v1.2/abdul-basit.json"
)

# SHA256 manifest — pin per release. Update via:
#   sha256sum data/quran-align/<reciter>.json
# Pending values are filled in on first successful download per ADR-0002.
declare -A SHA256=(
    [alafasy]="PENDING_FIRST_DOWNLOAD"
    [husary]="PENDING_FIRST_DOWNLOAD"
    [abdul-basit]="PENDING_FIRST_DOWNLOAD"
)

for reciter in "${!RECITERS[@]}"; do
    out="${OUT_DIR}/${reciter}.json"
    if [[ -f "${out}" && -z "${FORCE_REDOWNLOAD:-}" ]]; then
        ok "${reciter} already present (FORCE_REDOWNLOAD=1 to refetch)"
        continue
    fi
    expected="${SHA256[$reciter]}"
    url="${RECITERS[$reciter]}"
    if [[ "${expected}" == "PENDING_FIRST_DOWNLOAD" ]]; then
        log "${reciter}: bootstrap fetch (no SHA pinned yet)"
        curl --silent --show-error --location --fail \
             --output "${out}" "${url}" \
            || die "Download failed for ${reciter}: ${url}"
        log "Computed: $(sha256sum "${out}" | awk '{print $1}')"
    else
        fetch_with_sha256 "${url}" "${expected}" "${out}"
    fi
done

ensure_lfs_tracked 'data/quran-align/**/*.json'
ok "quran-align ready in ${OUT_DIR}"
