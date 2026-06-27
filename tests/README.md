# Tests

Headless smoke tests for `../index.html`, run in [jsdom](https://github.com/jsdom/jsdom).

```bash
cd tests
npm install   # first time only — pulls jsdom (dev-only; the app itself has zero deps)
npm test
```

`smoke.js` loads the real `index.html`, then asserts on:

- the pure model (income/expenses/surplus, bonuses, `simulate()`, debt amortization),
- the unified **priority** model (dragging a debt to the top pays it off sooner; capping a
  debt's/account's monthly amount paces it),
- the Sankey expense ordering, shared bar component (resize handles on every item type),
- persistence + migration from the old `car`/`fundingOrder` schema, and
- that every Setup section and chart renders without throwing.

These are headless checks — they can't drive real mouse drag, so still spot-check
drag/resize in a browser after big UI changes. The app ships as a single self-contained
`index.html`; this folder is dev tooling only and is not part of the deployed site.
