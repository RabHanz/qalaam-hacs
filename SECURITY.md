# Security Policy

## Reporting a vulnerability

**Do not open public issues for security vulnerabilities.**

Email maintainers privately at `security@qalaam.app` (placeholder until domain is set; meanwhile open a GitHub Security Advisory under "Security" → "Advisories" → "Report a vulnerability").

Include:

- A description of the vulnerability.
- Steps to reproduce.
- Affected versions / commits.
- Your proposed remediation, if any.
- Whether you'd like credit on disclosure.

## Disclosure timeline

- **Acknowledgement:** within 72 hours.
- **Triage + severity assessment:** within 7 days.
- **Patch + advisory:** within 30 days for high/critical, 90 days for medium/low.
- **Coordinated disclosure** preferred — we will work with you on timing.

## Scope

In scope:

- All code in this repository (`packages/`, `apps/`, `integrations/`, `services/`, `ml/`, `tooling/`).
- The hosted SaaS at `qalaam.app` (once live).
- The Home Assistant integration.

Out of scope (please report upstream):

- Vulnerabilities in third-party dependencies — report to the upstream project; we will track and update.
- Issues in vendored data (QUL, quran-align, quran-tajweed) — report to the respective upstream maintainers.

## Privacy-related concerns

Qalaam runs on-device ASR by design (per ADR-0005). If you discover a path where user audio could leave the device contrary to this design, treat it as a critical security report.

## Recognition

Reporters who follow this process and disclose responsibly are credited in the release notes (with their permission).
