FROM python:3.11-slim-bookworm AS base
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.5.4

COPY services/asr-worker/pyproject.toml ./
RUN uv pip install --system --no-cache-dir \
    'fastapi>=0.115.5' 'uvicorn[standard]>=0.32.1' \
    'pydantic>=2.9.0' 'structlog>=24.4.0' \
    'faster-whisper>=1.0.3' 'numpy>=1.26'

# Heavy model weights are pulled lazily on first request (so the image stays
# slim and we can bake multiple model_ids on different deployments).

COPY services/asr-worker/src/ ./src/

EXPOSE 5001

CMD ["uvicorn", "qalaam_asr_worker.server:app", "--host", "0.0.0.0", "--port", "5001"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/healthz').read()"
