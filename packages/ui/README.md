# `@qalaam/ui`

Qalaam design-system primitives. Pure React; framework-agnostic (Next + Expo + Lovelace card all consume the same components).

## Modules

- `tokens` — design tokens as TypeScript constants. Mirror of `apps/web/src/styles/tokens.css`.
- `primitives` — `Button`, `Card`, `Heading`, `Text`, `Skeleton`, `Sheet`, `Toast`, `VisuallyHidden`.
- `hooks` — `useReducedMotion`, `usePrefersDarkMode`, `useDirection`.

## Design rules

1. **Tokens, not magic numbers.** Every spacing/color/radius value lives in `tokens/`.
2. **Reduced-motion-aware.** `useReducedMotion` is the gate; primitives degrade to instant.
3. **RTL-aware.** All primitives respect inherited `dir`.
4. **Accessibility non-negotiable.** Every interactive element passes axe-core; every state has a screen-reader label.
5. **No client-only deps in the bundle.** Primitives are RSC-friendly.

Per CLAUDE.md §11.3.
