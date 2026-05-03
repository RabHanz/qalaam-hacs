// Preact JSX is configured via tsconfig `jsxImportSource: "preact"`.
// This stub keeps `customElements.define` typed without depending on a DOM lib polyfill.
declare global {
  interface Window {
    customElements: CustomElementRegistry;
  }
}
export {};
