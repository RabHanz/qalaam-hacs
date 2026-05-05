/**
 * Filtered lint-staged config — excludes data/qul-source/raw/ from any
 * formatter/linter runs. That tree contains 1,300+ auto-generated
 * sidecar JSON files that crash prettier (OOM) when batch-formatted.
 * They're machine-written + machine-read; no human-edited consistency
 * to enforce.
 */

const filterRaw = (files) => files.filter((f) => !f.includes('data/qul-source/raw/'));

module.exports = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': (files) => {
    const f = filterRaw(files);
    if (f.length === 0) return [];
    const list = f.map((x) => `"${x}"`).join(' ');
    return [`prettier --write --cache ${list}`, `eslint --fix --cache ${list}`];
  },
  '*.{json,jsonc,yaml,yml,md,html,css}': (files) => {
    const f = filterRaw(files);
    if (f.length === 0) return [];
    const list = f.map((x) => `"${x}"`).join(' ');
    return [`prettier --write --cache ${list}`];
  },
  '*.py': (files) => {
    const f = filterRaw(files);
    if (f.length === 0) return [];
    const list = f.map((x) => `"${x}"`).join(' ');
    return [`uv run ruff format ${list}`, `uv run ruff check --fix ${list}`];
  },
  'packages/schema/schemas/**/*.json': ['pnpm codegen'],
};
