/**
 * Conventional Commits — required per CLAUDE.md §11.1 documentation discipline.
 * Every commit message must include a scope tied to a package or app.
 *
 * Format: <type>(<scope>): <subject>
 *
 * Example: feat(hifdh-engine): implement FSRS-6 scheduler (ADR-0004)
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'adr',
      ],
    ],
    'scope-empty': [2, 'never'],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
