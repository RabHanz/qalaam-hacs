FROM python:3.11-slim-bookworm AS base
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.5.4

COPY services/prosody-worker/pyproject.toml ./
RUN uv pip install --system --no-cache-dir \
    'fastapi>=0.115.5' 'uvicorn[standard]>=0.32.1' \
    'pydantic>=2.9.0' 'structlog>=24.4.0' 'numpy>=1.26'

COPY services/prosody-worker/src/ ./src/

EXPOSE 5004

CMD ["uvicorn", "qalaam_prosody_worker.server:app", "--host", "0.0.0.0", "--port", "5004"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5004/healthz').read()"
