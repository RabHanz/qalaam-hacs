# Qalaam device-bridge — Cast + AirPlay sidecar.
# Multi-stage to keep the runtime image lean.

FROM python:3.11-slim-bookworm AS base
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv==0.5.4

# Install dependencies (cached layer)
COPY services/device-bridge/pyproject.toml ./
RUN uv pip install --system --no-cache-dir \
    'fastapi>=0.115.5' 'uvicorn[standard]>=0.32.1' \
    'pychromecast>=14.0.10' 'pyatv>=0.16.0' \
    'pydantic>=2.9.0' 'structlog>=24.4.0'

# Copy source
COPY services/device-bridge/src/ ./src/

EXPOSE 50051

# mDNS / zeroconf needs host networking — set in docker-compose.dev.yml.
CMD ["uvicorn", "qalaam_device_bridge.server:app", "--host", "0.0.0.0", "--port", "50051"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:50051/healthz').read()"
