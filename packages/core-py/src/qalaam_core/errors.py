"""Stable, machine-readable error codes for the Qalaam domain (Python mirror).

Code strings MUST match the TS strings in `packages/core/src/errors/index.ts`
exactly. Parity is enforced by a cross-language CI test.
"""

from __future__ import annotations

from typing import Literal

QalaamErrorCode = Literal[
    "qalaam.verse-key.invalid-format",
    "qalaam.verse-key.surah-out-of-range",
    "qalaam.verse-key.ayah-out-of-range",
    "qalaam.range.start-after-end",
    "qalaam.range.empty",
    "qalaam.mushaf.unknown-layout",
    "qalaam.mushaf.no-coverage",
    "qalaam.data.not-loaded",
    "qalaam.adapter.capability-unsupported",
    "qalaam.asr.privacy-boundary-violation",
]


class QalaamError(Exception):
    """Base exception for all Qalaam domain errors. Branch on `.code`, never type."""

    code: QalaamErrorCode
    outcome_impacted: str | None

    def __init__(
        self,
        code: QalaamErrorCode,
        message: str,
        *,
        outcome_impacted: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.outcome_impacted = outcome_impacted

    def __repr__(self) -> str:
        suffix = f" outcome={self.outcome_impacted}" if self.outcome_impacted else ""
        return f"QalaamError(code={self.code!r}, message={str(self)!r}{suffix})"
