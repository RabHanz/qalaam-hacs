#!/usr/bin/env bash
# ==============================================================================
# seed-host-data.sh — one-shot seed of qul.sqlite + mushaf-images into the
# named Docker volumes used by qalaam-production.
# ==============================================================================
# Idempotent. Run from a developer machine with:
#   - SSH access to the production host
#   - local copies of `data/qul.sqlite` and `apps/web/public/mushaf-images/`
#
# Usage:
#   ./infrastructure/scripts/seed-host-data.sh [HOST]
#
# Env overrides:
#   QALAAM_HOST=root@178.156.218.66          target host (default)
#   QALAAM_QUL_SQLITE=data/qul.sqlite        local path to qul.sqlite
#   QALAAM_MUSHAF_DIR=apps/web/public/mushaf-images  local path to PNG dir
#
# Strategy: SCP the data into /tmp on the host, then a one-shot
# `docker run alpine cp` copies it into the named volumes with the
# container UID/GID (1001:1001) the runtime images expect.
# ==============================================================================

set -euo pipefail

HOST="${1:-${QALAAM_HOST:-root@178.156.218.66}}"
QUL_LOCAL="${QALAAM_QUL_SQLITE:-data/qul.sqlite}"
MUSHAF_LOCAL="${QALAAM_MUSHAF_DIR:-apps/web/public/mushaf-images}"

# Repo root sanity check
if [[ ! -f "$QUL_LOCAL" ]]; then
  echo "ERROR: $QUL_LOCAL not found. Run from the qalaam repo root." >&2
  exit 1
fi
if [[ ! -d "$MUSHAF_LOCAL" ]]; then
  echo "ERROR: $MUSHAF_LOCAL not found. Run from the qalaam repo root." >&2
  exit 1
fi

QUL_BYTES=$(wc -c <"$QUL_LOCAL")
MUSHAF_FILES=$(find "$MUSHAF_LOCAL" -type f | wc -l)
echo "==> Seeding $HOST"
echo "    qul.sqlite     $QUL_LOCAL  ($((QUL_BYTES / 1024 / 1024)) MB)"
echo "    mushaf-images  $MUSHAF_LOCAL ($MUSHAF_FILES files)"

# Step 1 — ensure named volumes exist on the host (no-op if present).
ssh -o BatchMode=yes "$HOST" '
  docker volume create qalaam-data           >/dev/null
  docker volume create qalaam-mushaf-images  >/dev/null
'

# Step 2 — copy qul.sqlite to /tmp on host, then into the volume.
echo "==> uploading qul.sqlite"
scp -o BatchMode=yes "$QUL_LOCAL" "$HOST:/tmp/qul.sqlite"
ssh -o BatchMode=yes "$HOST" '
  docker run --rm \
    -v qalaam-data:/dst \
    -v /tmp/qul.sqlite:/src:ro \
    alpine \
    sh -c "cp /src /dst/qul.sqlite \
        && chown 1001:1001 /dst/qul.sqlite \
        && chmod 0644 /dst/qul.sqlite"
  rm -f /tmp/qul.sqlite
'

# Step 3 — tar + ship + extract mushaf-images. Streaming tar avoids
# the per-file SCP overhead (610 PNGs × ~100KB each).
echo "==> uploading mushaf-images"
tar czf - -C "$(dirname "$MUSHAF_LOCAL")" "$(basename "$MUSHAF_LOCAL")" \
  | ssh -o BatchMode=yes "$HOST" 'cat > /tmp/mushaf-images.tgz'
ssh -o BatchMode=yes "$HOST" '
  docker run --rm \
    -v qalaam-mushaf-images:/dst \
    -v /tmp/mushaf-images.tgz:/src.tgz:ro \
    alpine \
    sh -c "cd /dst \
        && tar xzf /src.tgz --strip-components=1 \
        && chown -R 1001:1001 /dst \
        && find /dst -type f -exec chmod 0644 {} +"
  rm -f /tmp/mushaf-images.tgz
'

# Step 4 — verify
echo "==> verifying"
ssh -o BatchMode=yes "$HOST" '
  echo "    qalaam-data:"
  docker run --rm -v qalaam-data:/dst alpine \
    sh -c "ls -l /dst | head -10"
  echo "    qalaam-mushaf-images (count of PNGs):"
  docker run --rm -v qalaam-mushaf-images:/dst alpine \
    sh -c "find /dst -type f -name *.png | wc -l"
'

echo "==> done. Volumes seeded:"
echo "    qalaam-data            qul.sqlite owned 1001:1001"
echo "    qalaam-mushaf-images   $MUSHAF_FILES files owned 1001:1001"
echo
echo "First Dokploy compose deploy can now start. The runtime"
echo "containers (qalaam-backend / qalaam-web) will mount these"
echo "volumes read-only (mushaf) / read-write (data) on boot."
