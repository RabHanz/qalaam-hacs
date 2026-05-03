import base from './index.js';

export default [
  ...base,
  {
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', navigator: 'readonly' },
    },
    rules: {
      // RSC-friendly: default exports allowed in app/ routes, otherwise warn.
      'import/no-default-export': 'off',
    },
  },
];
