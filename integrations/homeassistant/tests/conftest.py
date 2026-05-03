"""Shared pytest fixtures for the Qalaam HA integration.

Uses pytest-homeassistant-custom-component to spin up a real HA instance per
test. Add this to a `tests-ha` extra in pyproject.toml when you start running
the suite — kept light here so CI is decoupled from the heavy HA dependency.
"""

from __future__ import annotations

from typing import Generator

import pytest


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: object) -> Generator[None, None, None]:
    """Allow custom_components to load — required for our HA-test runs."""
    yield
