# `@qalaam/tsconfig`

Reusable TS configs. All extend `base.json` and add platform layers.

| Config | Use |
|---|---|
| `base.json` | strict-mode primitives only |
| `library.json` | TS library compiled to `dist/` (composite, NodeNext) |
| `node.json` | Node-only library; adds `lib: ["ES2022"]` and `types: ["node"]` |
| `react.json` | React/DOM library; adds `jsx: react-jsx` and DOM libs |
