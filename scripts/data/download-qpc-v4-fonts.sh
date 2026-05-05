#!/usr/bin/env bash
# Download all 604 KFGQPC V4 Tajweed page fonts (COLRv1 woff2 variant).
#
# Source: Quran Foundation public CDN — `verses.quran.foundation/fonts/
# quran/hafs/v4/colrv1/woff2/p{N}.woff2`. The COLRv1 variant has the
# tajweed colors baked into the font's COLR + CPAL tables, so the
# browser renders the Madinah V4 mushaf bit-for-bit identical to the
# canonical printed tajweed-coloured edition.
#
# Pairs with `qalaam_v1_qul_qpc_v4_text` (per-verse PUA U+FC41-FC64
# codepoints from QUL #47 / qpc-v4.db) — together they let
# /read?layout=tajweed render the canonical KFGQPC V4 Tajweed mushaf
# instead of the CSS-overlay tajweed approximation we use on
# UthmanicHafs Unicode text.
#
# License: KFGQPC reuse terms (kfgqpc-terms in our LicenseTag enum).
# Per-font sidecar with SHA256 pin per ADR-0002.
#
# Usage:  ./scripts/data/download-qpc-v4-fonts.sh
# Idempotent — skips already-downloaded files.

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/apps/web/public/fonts/quran-tajweed-v4"
SHA_FILE="${REPO_ROOT}/data/qul-source/qpc-v4-fonts.sha256"

mkdir -p "${OUT_DIR}"
mkdir -p "$(dirname "${SHA_FILE}")"

echo "[download-qpc-v4-fonts] downloading 604 page fonts to ${OUT_DIR}"

# 8-way parallel download via xargs. Each font is ~25-30 KB; 604 pages
# = ~16 MB total. Polite to QF's CDN (BunnyCDN — handles concurrent
# fine).
seq 1 604 \
  | xargs -P 8 -I {} bash -c '
    PAGE="$1"
    OUT="$2/p${PAGE}.woff2"
    if [[ -f "$OUT" ]] && [[ -s "$OUT" ]]; then
      exit 0  # resume — already downloaded
    fi
    URL="https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${PAGE}.woff2"
    if curl -sfL "$URL" -o "${OUT}.partial"; then
      mv "${OUT}.partial" "$OUT"
    else
      rm -f "${OUT}.partial"
      echo "FAIL p${PAGE}" >&2
      exit 1
    fi
  ' _ {} "${OUT_DIR}"

echo "[download-qpc-v4-fonts] computing SHA256 pins -> ${SHA_FILE}"
( cd "${OUT_DIR}" && sha256sum p*.woff2 ) | sort > "${SHA_FILE}"

count=$(ls -1 "${OUT_DIR}"/p*.woff2 2>/dev/null | wc -l)
size=$(du -sh "${OUT_DIR}" | cut -f1)
echo "[download-qpc-v4-fonts] OK — ${count}/604 fonts, ${size}"

if [[ "${count}" -lt 604 ]]; then
  echo "WARN: ${count} of 604 fonts present; re-run to retry missing pages." >&2
  exit 1
fi
