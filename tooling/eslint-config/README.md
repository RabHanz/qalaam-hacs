# `@qalaam/eslint-config`

Shared flat ESLint configs.

## Usage

```js
// packages/foo/eslint.config.js
import qalaam from '@qalaam/eslint-config';
export default qalaam;

// app with RSC + DOM globals
import qalaam from '@qalaam/eslint-config/react';
export default qalaam;

// Node service / library
import qalaam from '@qalaam/eslint-config/node';
export default qalaam;
```
