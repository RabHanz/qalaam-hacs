# Qalaam — top-level developer shortcuts.
# All commands run from repo root.

.PHONY: bootstrap dev codegen lint typecheck test build clean \
        ci-local py-lint py-typecheck py-test docker-up docker-down \
        data-fetch help

# Default target: show help
.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install all deps (Node + Python), run codegen, do an initial build
	@echo "→ Installing Node dependencies (pnpm)…"
	pnpm install --frozen-lockfile
	@echo "→ Installing Python dependencies (uv)…"
	uv sync --all-extras --dev
	@echo "→ Running codegen…"
	pnpm codegen
	@echo "→ Initial build…"
	pnpm turbo build
	@echo "✓ Bootstrap complete. Run 'make dev' to start working."

dev: ## Bring up the dev environment (watch mode)
	pnpm dev

codegen: ## Generate TS + Python types from JSON Schema
	pnpm codegen

lint: ## Lint everything (TS + Python + format check)
	pnpm lint
	$(MAKE) py-lint

typecheck: ## Type-check everything
	pnpm typecheck
	$(MAKE) py-typecheck

test: ## Run full test suite
	pnpm test
	$(MAKE) py-test

build: ## Build all packages
	pnpm build

clean: ## Remove build artifacts and caches
	pnpm clean
	rm -rf .turbo .next coverage
	find . -type d -name '__pycache__' -prune -exec rm -rf {} +
	find . -type d -name '.mypy_cache' -prune -exec rm -rf {} +
	find . -type d -name '.ruff_cache' -prune -exec rm -rf {} +
	find . -type d -name '.pytest_cache' -prune -exec rm -rf {} +

ci-local: ## Run everything CI runs, locally
	pnpm ci:all

py-lint: ## Python lint (ruff)
	uv run ruff check .
	uv run ruff format --check .

py-typecheck: ## Python type-check (mypy)
	uv run mypy .

py-test: ## Python tests (pytest)
	uv run pytest

docker-up: ## Bring up local dev services (postgres, redis, ha-dev, workers)
	docker compose -f docker-compose.dev.yml up -d

docker-down: ## Tear down local dev services
	docker compose -f docker-compose.dev.yml down

data-fetch: ## Download vendored datasets (QUL, quran-align, quran-tajweed)
	bash scripts/data/download-qul.sh
	bash scripts/data/download-quran-align.sh
	bash scripts/data/download-quran-tajweed.sh
