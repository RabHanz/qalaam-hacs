FROM python:3.11-slim-bookworm AS base
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN pip install --no-cache-dir uv==0.5.4

COPY services/tts-worker/pyproject.toml ./
RUN uv pip install --system --no-cache-dir \
    'fastapi>=0.115.5' 'uvicorn[standard]>=0.32.1' \
    'pydantic>=2.9.0' 'structlog>=24.4.0' 'httpx>=0.28.0'

COPY services/tts-worker/src/ ./src/

EXPOSE 5002

CMD ["uvicorn", "qalaam_tts_worker.server:app", "--host", "0.0.0.0", "--port", "5002"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5002/healthz').read()"
