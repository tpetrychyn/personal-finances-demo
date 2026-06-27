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

Vanilla everything — no frameworks, no build step, no external requests. CSS + JS are
inline in `index.html` and charts are hand-rolled inline SVG, so it works fully offline
(just open the file). State auto-saves to `localStorage`.

## Tests

Headless smoke tests live in [`tests/`](tests/) (jsdom). After any big change:

```bash
cd tests && npm install && npm test
```

They cover the model, the unified priority simulation (incl. dragging debts to pay off
faster), persistence/migration, and that every section renders. The app itself stays
dependency-free; the tests are dev-only tooling.
