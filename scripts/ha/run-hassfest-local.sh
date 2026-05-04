#!/usr/bin/env bash
# Local hassfest validation for the qalaam HA custom_component.
#
# Mirrors the GitHub Action that hassfest runs on HACS submission so we
# catch manifest / strings / icon-set / quality-scale issues before push.
#
# Per Phase 1.6 + Phase 11 closure (HA integration v1).
#
# Usage:
#   ./scripts/ha/run-hassfest-local.sh
#
# Requires Docker. The hassfest Action runs the same image we mount here.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INTEG_ROOT="${REPO_ROOT}/integrations/homeassistant"

if [[ ! -d "${INTEG_ROOT}/custom_components/qalaam" ]]; then
    echo "ERROR: ${INTEG_ROOT}/custom_components/qalaam not found." >&2
    exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker not found on PATH." >&2
    echo "Install Docker, then re-run." >&2
    exit 2
fi

echo "[hassfest] running validation on ${INTEG_ROOT}/custom_components/qalaam ..."
docker run --rm \
    -v "${INTEG_ROOT}":/github/workspace \
    -e GITHUB_ACTIONS=false \
    ghcr.io/home-assistant/hassfest:latest

echo "[hassfest] running HACS validation ..."
docker run --rm \
    -v "${INTEG_ROOT}":/github/workspace \
    -e INPUT_CATEGORY=integration \
    -e INPUT_GITHUB_TOKEN=fake \
    -e GITHUB_REPOSITORY=qalaam/qalaam \
    ghcr.io/hacs/action:main

echo "[hassfest] OK — integration is HACS-clean."
