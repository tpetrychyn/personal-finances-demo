# Personal Finance Planner — Demo

A single self-contained, offline HTML dashboard for planning a household's
cashflow, savings goals, and FIRE timeline — fully editable with no code.
**Live demo:** https://tpetrychyn.github.io/personal-finances-demo/

> ⚠️ All names and numbers in this demo (**"Bob & Sally"**) are **fictional** — made-up
> figures roughly aligned with an average Canadian household, for illustration only.

## What it shows

1. **Header stats** — income, expenses, surplus, FIRE target, and years-to-FIRE, all computed live from your inputs.
2. **Sankey** — two-tier cashflow: income sources → income pool → expenses + a savings node → funding-goal buckets.
3. **Funding goals & timeline** — a Gantt of every goal *and debt*, with parallel / waterfall / custom strategies, **drag a row up/down by its ⠿ grip to reprioritize**, draggable/resizable bars, deadline markers, and **undo**.
4. **Debts card** — any kind of debt (car loan, credit card, student loan, …); amortization showing minimum-only vs. your plan, with one-time lump sums.
5. **Net worth & FIRE projection** — current assets compounded forward, Full FIRE date + Coast FIRE.
6. **What moves your FIRE date** — each goal's drag on FIRE, plus a trim-spending explorer.
7. **Financial freedom explorer** — model income as a *timeline of phases per partner* (a layoff + gap, a new job at a lower salary, a downshift, parental leave) and compare scenarios side by side: what you'd retire with, when you cross Coast/Full FIRE, and whether the portfolio ever runs dry. Phase bars are draggable (move + resize from either edge) and it reads live goals, debts, expenses, assets, return and ages.

## How to use / What you can edit

Everything is configured through the collapsible **⚙ Setup / Edit inputs** card at the top of the page — no code required.

| Section | What you can change |
|---|---|
| **People** | Names; renaming migrates all linked assets and income/goal ownership automatically |
| **Income sources** | Add/remove sources; set name, person, monthly amount, and **bonuses on specific months** (e.g. an annual bonus in June) |
| **Expenses** | Add/remove line items and their monthly amounts |
| **Goals** | Add/remove; set type (lifestyle vs. savings-account), target, monthly contribution, start month, **deadline**, color, and owner |
| **Funding priority** | One drag-to-reorder list of **all goals *and debts*** — top = funded first. Drag a debt to the top to aggressively pay it off from surplus; surplus flows down the list each month (lifestyle goals take their monthly $, accounts & debts absorb the rest) |
| **Debts** | Add/remove **any debt** (car loan, credit card, student loan, line of credit, …); name, type, balance, interest rate, payment + frequency (monthly/biweekly) |
| **Assets** | Per-person account rows and current balances |
| **Export / Import JSON** | Snapshot or restore your entire plan |

FIRE assumptions (return rate, current age, retire age, target portfolio) are editable directly in the **Net worth & FIRE projection** card.

Changes auto-save to `localStorage` (key `finplan_demo_v2`). Use **↩ Undo** (⌘/Ctrl+Z) to step back, or **↺ Reset to defaults** to restore the built-in example data.

## Tech

Vanilla everything — no frameworks, no build step, no external requests, no bundler.
`index.html` is just markup that pulls in one stylesheet and a handful of plain
`<script src>` modules; charts are hand-rolled inline SVG. The scripts are classic
(non-`module`) scripts that share one global scope, so the app works fully offline
(just open the file) **and** on GitHub Pages, with no build step either way. State
auto-saves to `localStorage`.

Every `<link>`/`<script>` tag in `index.html` (and `index-taylor.html`) carries a
`?v=N` query string for cache-busting — bump `N` (find/replace across the file)
whenever you push a change to `styles.css` or any `js/*.js` file, so returning
browsers fetch the new version instead of a cached one. GitHub Pages' own build
lag is separate from this — right after a push, give the Pages build a minute
before checking, then hard-refresh.

### File layout

| File | What lives there |
|---|---|
| `index.html` | Thin launcher — just `<link>`/`<script>` tags; no markup or logic of its own |
| `styles.css` | All styling (design tokens in `:root`, then component rules) |
| `js/layout.js` | The page scaffold (all cards + element IDs) — injected into the DOM; runs **first** |
| `js/state.js` | `GENERIC_STATE`/`DEFAULT_STATE`, seed override, derived getters, undo, persistence + migration |
| `js/util.js` | Shared helpers reused everywhere: `fmt`, `el`, `sec`, `esc`, `monthLabel`, color utils |
| `js/simulate.js` | The month-by-month funding/debt/interest simulation |
| `js/header.js` | Header stat tiles, budget widget, Sankey note |
| `js/sankey.js` | Cashflow Sankey (model builder + SVG renderer) |
| `js/gantt.js` | Goal/debt Gantt, bar drag/resize, funding-priority reorder |
| `js/debts.js` | Debt amortization math + per-debt cards and charts |
| `js/projection.js` | Net worth & FIRE projection, plus the "what moves your FIRE date" analysis |
| `js/freedom.js` | Financial freedom explorer — per-partner income-phase scenarios, drawdown-aware projection, draggable phase bars |
| `js/setup.js` | The ⚙ Setup / Edit-inputs editor |
| `js/render.js` | `renderAll()` / `applyAndRender()` orchestration |
| `js/main.js` | Bar tooltip + init: load state, wire events, first render (loads **last**) |

Files load in dependency order and communicate through the shared global scope (the same
model the old single-file version used). `js/layout.js` must stay **first** — it builds the
DOM the other scripts render into — and `js/main.js` must stay **last** (it runs the init).
The headless tests inline these files back into one document before handing them to jsdom,
so they exercise exactly what ships.

### Personal seed (running your own numbers)

The app has **one** copy of everything — logic *and* markup live in `js/*.js`, shared by
every entry page. To keep a private plan with your real numbers without maintaining a
second app:

1. `js/seed-taylor.js` (gitignored) defines two globals — `SEED_STATE` (your hardcoded
   starting numbers) and `SEED_KEY` (a separate `localStorage` key). Because the numbers
   are baked into this file, they **survive a browser cache clear**, and **↺ Reset to
   defaults** falls back to them.
2. `index-taylor.html` (gitignored) is identical to `index.html` except it loads
   `js/seed-taylor.js` *before* `js/state.js`. `state.js` uses `SEED_STATE`/`SEED_KEY`
   when present, else the public `GENERIC_STATE` / `finplan_demo_v2` demo.

Because both pages pull the same `js/*.js`, any feature you build shows up in both — the
public demo (`index.html`) and your personal plan — with no copy to keep in sync. To bank
a new baseline after editing live, paste the app's **Export JSON** back into `SEED_STATE`.

## Tests

Headless smoke tests live in [`tests/`](tests/) (jsdom). After any big change:

```bash
cd tests && npm install && npm test
```

They cover the model, the unified priority simulation (incl. dragging debts to pay off
faster), persistence/migration, and that every section renders. The app itself stays
dependency-free; the tests are dev-only tooling.
