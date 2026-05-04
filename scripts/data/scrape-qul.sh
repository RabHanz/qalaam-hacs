#!/usr/bin/env bash
# Authenticated QUL scraper. Per ADR-0020 + Docs/research/qul-inventory.md §4.
#
# Walks the priority QUL resource pages with a logged-in session, captures
# the Active Storage signed-URL on each Download button, downloads the
# JSON or SQLite payload, unpacks zip envelopes, and stages the bytes
# under data/qul-source/raw/ for the existing ingest scripts to consume.
#
# Credentials come from env (QUL_EMAIL, QUL_PASSWORD). Sign up at
# https://qul.tarteel.ai/users/sign_up if you don't have an account yet.
#
# Per-resource license review is the user's responsibility — every
# downloaded file lands in data/qul-source/raw/ with a sidecar
# `<file>.license.json` that records the source URL + sha256 + a
# `license_tag` placeholder the user must edit before the ingest scripts
# accept it (the ingest framework refuses `license_tag: unverified`).
#
# Usage:
#   export QUL_EMAIL=...
#   export QUL_PASSWORD=...
#   ./scripts/data/scrape-qul.sh

set -Euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RAW_DIR="${REPO_ROOT}/data/qul-source/raw"
COOKIE_JAR="${REPO_ROOT}/data/qul-source/.cookies.txt"

mkdir -p "${RAW_DIR}"

if [[ -z "${QUL_EMAIL:-}" ]] || [[ -z "${QUL_PASSWORD:-}" ]]; then
    echo "ERR: set QUL_EMAIL and QUL_PASSWORD." >&2
    exit 2
fi

echo "[1/3] Signing in as ${QUL_EMAIL}"
SIGNIN_HTML="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" \
    'https://qul.tarteel.ai/users/sign_in')"
TOKEN="$(printf '%s' "${SIGNIN_HTML}" | grep -oE 'name="authenticity_token" value="[^"]+"' \
    | head -1 | sed 's/.*value="\([^"]*\)".*/\1/')"
[[ -n "${TOKEN}" ]] || { echo "ERR: no CSRF token." >&2; exit 2; }

curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -L \
    -X POST 'https://qul.tarteel.ai/users/sign_in' \
    -H 'content-type: application/x-www-form-urlencoded' \
    --data-urlencode "authenticity_token=${TOKEN}" \
    --data-urlencode "user[email]=${QUL_EMAIL}" \
    --data-urlencode "user[password]=${QUL_PASSWORD}" \
    --data-urlencode "user[remember_me]=1" \
    --data-urlencode "commit=Sign in" \
    -o /dev/null

if ! grep -q remember_user_token "${COOKIE_JAR}"; then
    echo "ERR: login failed (no remember_user_token cookie)." >&2
    exit 2
fi
echo "    OK — logged in"

# Resource list — slug + numeric id + filename hint. Each row produces one
# downloaded file at data/qul-source/raw/<slug>-<id>.<ext>.zip plus a
# sidecar JSON with sha256 + source URL the user reviews before ingest.
RESOURCES=(
    # quran-metadata bundle (one entry covers all 8 sub-tables)
    "quran-metadata 63 sqlite quran-metadata-63.sqlite.zip"
    # Mushaf layouts — Madani 15-line + KFGQPC V4 + Indopak 15-line
    "mushaf-layout 1 sqlite mushaf-layout-madani-15.sqlite.zip"
    "mushaf-layout 19 sqlite mushaf-layout-kfgqpc-v4.sqlite.zip"
    "mushaf-layout 22 sqlite mushaf-layout-indopak-15.sqlite.zip"
    # Quran scripts: Uthmani simple + KFGQPC Hafs + KFGQPC V4 tajweed + Indopak Nastaleeq
    "quran-script 56 json quran-script-uthmani-simple.json.zip"
    "quran-script 47 json quran-script-kfgqpc-v4-tajweed.json.zip"
    "quran-script 59 json quran-script-indopak-nastaleeq.json.zip"
    # Mutashabihat (the v2 confusion engine source)
    "mutashabihat 1 json mutashabihat.json.zip"
    # Similar ayahs
    "similar-ayah 1 json similar-ayah.json.zip"
    # Word-by-word translation packs (English first)
    "translation 84 json wbw-en.json.zip"
    # Surah info — English
    "surah-info 3 json surah-info-en.json.zip"
    # Recitations — Husary + Mishary + Abdul Basit Murattal (segmented)
    "recitation 5 json recitation-husary.json.zip"
    "recitation 9 json recitation-mishary.json.zip"
    "recitation 11 json recitation-abdul-basit-murattal.json.zip"
)

echo "[2/3] Walking ${#RESOURCES[@]} resources"
for row in "${RESOURCES[@]}"; do
    set +e
    slug=$(echo "${row}" | awk '{print $1}')
    id=$(echo "${row}" | awk '{print $2}')
    ext=$(echo "${row}" | awk '{print $3}')
    outname=$(echo "${row}" | awk '{print $4}')
    DETAIL_URL="https://qul.tarteel.ai/resources/${slug}/${id}"
    DETAIL_HTML=$(curl -sS -b "${COOKIE_JAR}" "${DETAIL_URL}" 2>/dev/null)

    # The download anchors are emitted in source order: SQLite first, then JSON.
    if [[ "${ext}" == "sqlite" ]]; then PICK=1; else PICK=2; fi
    DOWNLOAD_PATH=$(printf '%s' "${DETAIL_HTML}" \
        | grep -oE '/resources/[a-z-]+/[a-f0-9]{32}/download' \
        | sed -n "${PICK}p")

    if [[ -z "${DOWNLOAD_PATH}" ]]; then
        echo "    WARN: no ${ext} link for ${slug}/${id} — skipping"
        continue
    fi

    OUT_PATH="${RAW_DIR}/${outname}"
    HTTP_CODE=$(curl -sS -L -b "${COOKIE_JAR}" \
        -o "${OUT_PATH}" \
        -w '%{http_code}' \
        "https://qul.tarteel.ai${DOWNLOAD_PATH}" 2>/dev/null)
    SIZE=$(stat -c '%s' "${OUT_PATH}" 2>/dev/null || echo 0)
    echo "    ${slug}/${id} (${ext}): HTTP ${HTTP_CODE}, ${SIZE} bytes -> ${outname}"

    SHA=$(sha256sum "${OUT_PATH}" 2>/dev/null | awk '{print $1}')
    cat > "${OUT_PATH}.license.json" <<EOF
{
  "source_id": "qul-${slug}-${id}",
  "source_url": "${DETAIL_URL}",
  "download_url": "https://qul.tarteel.ai${DOWNLOAD_PATH}",
  "sha256": "${SHA}",
  "size_bytes": ${SIZE},
  "license_tag": "unverified",
  "attribution_text": "Quranic Universal Library (QUL) by Tarteel AI",
  "downloaded_at": "$(date -u +%FT%TZ)"
}
EOF
    set -e
done

echo "[3/3] Done. Files at ${RAW_DIR}/:"
ls -la "${RAW_DIR}/" | grep -v license.json | head
echo
echo "Next step: review each .license.json sidecar, set license_tag to the"
echo "appropriate value (factual / permissive-with-credit / kfgqpc-terms /"
echo "per-reciter), then run scripts/data/_ingest-from-scrape.py to feed"
echo "the unpacked bytes into ingest-qul-*.ts."
