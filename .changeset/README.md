# Changesets

This folder is used by [Changesets](https://github.com/changesets/changesets) to track per-package version intent. Apps and services don't get versioned (see `ignore` in `config.json`); only publishable libraries do.

## Adding a changeset

```bash
pnpm changeset
```

Pick the affected packages and the bump type (patch / minor / major). Write a one-paragraph summary describing the user-visible change.

## Releasing

CI runs `changeset version` on merges to `main`, then opens a release PR. Merging that PR triggers `changeset publish` (npm) and a GitHub Release.
