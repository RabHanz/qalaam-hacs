#!/usr/bin/env bash
# Compute + print the SHA256 of the downloaded QUL SQLite, suitable for
# pasting into download-qul.sh's QUL_SHA256 default.
#
# Per ADR-0002 risk mitigation: the SHA must be human-verified against a
# known-good QUL release before it's committed. This script does NOT commit
# the SHA — it just prints it. The human reviewer pins.

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

require_cmd sha256sum
require_cmd sqlite3

QUL_OUT="${QALAAM_DATA_DIR}/qul.sqlite"
if [[ ! -f "${QUL_OUT}" ]]; then
    die "No QUL file at ${QUL_OUT}. Run download-qul.sh first (with bootstrap mode)."
fi

# Integrity check before quoting the SHA — a corrupt download has a
# legitimate SHA but is useless, and a pinned SHA on it would block
# legitimate fixes.
sqlite3 "${QUL_OUT}" 'PRAGMA integrity_check;' | grep -qi '^ok$' \
    || die "SQLite integrity check failed. Don't pin a corrupt file."

SHA="$(sha256sum "${QUL_OUT}" | awk '{print $1}')"
SIZE_BYTES="$(stat -c '%s' "${QUL_OUT}")"
TABLES="$(sqlite3 "${QUL_OUT}" '.tables' | tr -s ' \n' ' ' | sed 's/[[:space:]]*$//')"

cat <<EOF
QUL pin candidate — review BEFORE committing:

  File:    ${QUL_OUT}
  Size:    ${SIZE_BYTES} bytes
  Tables:  ${TABLES}
  SHA256:  ${SHA}

Pin by editing scripts/data/download-qul.sh:
    QUL_SHA256="${SHA}"

…then commit with the QUL release notes URL in the commit message.
EOF
