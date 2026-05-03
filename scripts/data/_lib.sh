#!/usr/bin/env bash
# Common helpers for data-fetch scripts. Sourced by every download script.
#
# Per ADR-0002: vendored data lives in `data/`, tracked via Git LFS.
# Every download MUST verify SHA256 against a pinned manifest entry.

set -Eeuo pipefail

QALAAM_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
QALAAM_DATA_DIR="${QALAAM_REPO_ROOT}/data"
QALAAM_DATA_TMP="${QALAAM_DATA_DIR}/.tmp"

mkdir -p "${QALAAM_DATA_DIR}" "${QALAAM_DATA_TMP}"

log() {
    printf '\033[36m→\033[0m %s\n' "$*" >&2
}

ok() {
    printf '\033[32m✓\033[0m %s\n' "$*" >&2
}

die() {
    printf '\033[31m✗\033[0m %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

# fetch_with_sha256 <url> <expected_sha256> <output_path>
fetch_with_sha256() {
    local url="$1"
    local expected="$2"
    local out="$3"
    local tmp
    tmp="$(mktemp "${QALAAM_DATA_TMP}/dl.XXXXXX")"

    log "Fetching ${url}"
    curl --silent --show-error --location --fail \
         --retry 5 --retry-delay 3 --retry-connrefused \
         --output "${tmp}" \
         "${url}"

    local actual
    actual="$(sha256sum "${tmp}" | awk '{print $1}')"
    if [[ "${actual}" != "${expected}" ]]; then
        die "SHA256 mismatch for ${url}\n  expected: ${expected}\n  actual:   ${actual}"
    fi

    mv "${tmp}" "${out}"
    ok "Verified and placed: ${out}"
}

ensure_lfs_tracked() {
    local pattern="$1"
    if ! git -C "${QALAAM_REPO_ROOT}" check-attr filter "${pattern}" 2>/dev/null | grep -q lfs; then
        log "Note: ${pattern} should be Git LFS tracked (see .gitattributes)."
    fi
}
