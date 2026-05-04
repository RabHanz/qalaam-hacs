#!/usr/bin/env bash
# Render the C4 PlantUML sources to PNG.
#
# Per Phase 1.6 (Sphinx C4 PNG renders). Uses the local `plantuml` command if
# installed, otherwise falls back to the official Docker image. Output PNGs
# go alongside the .puml sources in Docs/architecture/, with a `.png.sha256`
# sidecar so we can detect drift in CI.
#
# Usage:
#   ./scripts/docs/render-c4-png.sh
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARCH_DIR="${REPO_ROOT}/Docs/architecture"

cd "${REPO_ROOT}"

if command -v plantuml >/dev/null 2>&1; then
    plantuml -tpng "${ARCH_DIR}"/*.puml
elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
        -v "${ARCH_DIR}":/work \
        -w /work \
        plantuml/plantuml -tpng "*.puml"
else
    echo "ERROR: neither 'plantuml' nor 'docker' is on PATH." >&2
    echo "Install plantuml (apt install plantuml) or Docker, then re-run." >&2
    exit 2
fi

# Pin SHAs so PR review can spot drift.
for png in "${ARCH_DIR}"/*.png; do
    [[ -f "${png}" ]] || continue
    sha256sum "${png}" | awk '{print $1}' > "${png}.sha256"
done
echo "Rendered $(ls "${ARCH_DIR}"/*.png 2>/dev/null | wc -l) PNG(s)."
