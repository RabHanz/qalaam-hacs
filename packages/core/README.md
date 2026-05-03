# `@qalaam/core`

Domain primitives for Qalaam. The keystone library — used by `@qalaam/data-loader`, `@qalaam/hifdh-engine`, `@qalaam/api-client-ts`, `@qalaam/adapter-interface`, and every app.

## Modules

- `verse-key` — parse, validate, format, compare `VerseKey` strings (`"surah:ayah"`).
- `range` — `AyahRange` arithmetic: contains, intersect, union, expand, walk.
- `mushaf` — page-layout math (Madani 15-line, Indo-Pak 16-line). Mushaf-agnostic API per ADR-0002 / strategy §7.1 same-mushaf rule.
- `errors` — `QalaamError` base class with stable error codes. All thrown errors must inherit.

## Design rules

1. **Pure & deterministic.** No I/O, no global state. Mushaf-page tables are loaded by `@qalaam/data-loader` and passed in.
2. **Mushaf-agnostic.** Public API takes `VerseKey`s, never page numbers, except in `mushaf/` itself.
3. **Branded types.** `VerseKey` is a branded `string`; `AyahRange` is a branded `readonly` tuple. Cannot be confused with raw values.
4. **Property-tested.** `fast-check` generators for every function over `VerseKey`/`AyahRange`.
5. **Zero deps at runtime** beyond `@qalaam/types-ts`.

## Use

```ts
import { parseVerseKey, formatVerseKey } from '@qalaam/core/verse-key';
import { AyahRange, contains, walk } from '@qalaam/core/range';
import { pageBoundsForRange } from '@qalaam/core/mushaf';
```
