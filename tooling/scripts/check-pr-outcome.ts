#!/usr/bin/env tsx
/**
 * CI gate: every PR description MUST contain `Outcome: O-XX (opportunity = N)`.
 * Per Docs/STRATEGY_AND_ROADMAP.md §23.4. Wired into .github/workflows/ci.yml.
 *
 * Reads the PR body from the GITHUB_EVENT_PATH file (PR event) and exits 1 if
 * the line is missing or malformed.
 *
 * Local debug: PR_BODY="Outcome: O-04 (opportunity = 16)" tsx tooling/scripts/check-pr-outcome.ts
 */
import { existsSync, readFileSync } from 'node:fs';

interface GithubPrEvent {
  pull_request?: { body?: string | null };
}

const OUTCOME_RE = /^Outcome:\s*O-\d+(?:,\s*O-\d+)*\s*(?:\(opportunity\s*=\s*\d+\))?\s*$/m;
const FOUNDATION_RE = /^Outcome:\s*foundation\b/im;

function loadBody(): string {
  if (process.env['PR_BODY']) return process.env['PR_BODY'];
  const eventPath = process.env['GITHUB_EVENT_PATH'];
  if (eventPath && existsSync(eventPath)) {
    try {
      const ev = JSON.parse(readFileSync(eventPath, 'utf-8')) as GithubPrEvent;
      return ev.pull_request?.body ?? '';
    } catch {
      return '';
    }
  }
  return '';
}

function fail(msg: string): never {
  process.stdout.write(`::error::check-pr-outcome: ${msg}\n`);
  process.exit(1);
}

function main(): void {
  const body = loadBody();
  if (!body.trim()) {
    fail(
      'PR description is empty. Add an "Outcome: O-XX (opportunity = N)" line per Docs/STRATEGY_AND_ROADMAP.md §23.4.',
    );
  }
  if (FOUNDATION_RE.test(body)) {
    process.stdout.write('check-pr-outcome: foundation work declared. ✓\n');
    return;
  }
  const match = OUTCOME_RE.exec(body);
  if (!match) {
    fail(
      'No "Outcome: O-XX" line found. Reference an outcome from STRATEGY_AND_ROADMAP.md §23.2 (e.g. "Outcome: O-04 (opportunity = 16)") or write "Outcome: foundation" for repo-wide infra.',
    );
  }
  process.stdout.write(`check-pr-outcome: ✓ ${match[0]}\n`);
}

main();
