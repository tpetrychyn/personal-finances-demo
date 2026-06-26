# Personal Finance Planner — Demo

A single self-contained, offline HTML dashboard for visualizing a household's
cashflow and savings plan. **Live demo:** https://tpetrychyn.github.io/personal-finances-demo/

> ⚠️ All names and numbers in this demo (**"Bob & Sally"**) are **fictional** — made-up
> figures roughly aligned with an average Canadian household, for illustration only.

## What it shows

1. **Header stats** — income, expenses, surplus, FIRE target, years-to-FIRE.
2. **Sankey** — two-tier cashflow: income sources → income pool → expenses + a savings node → funding-goal buckets.
3. **Funding goals & timeline** — a Gantt of every goal's funding window, with parallel / waterfall / custom strategies, **draggable/resizable bars**, deadline markers, and **undo**.
4. **Car loan card** — amortization with scheduled bulk lump-sum payments.
5. **Net worth & FIRE projection** — current assets compounded forward, Full FIRE date + Coast FIRE.

## Tech

Vanilla everything — no frameworks, no build step, no external requests. CSS + JS are
inline in `index.html` and charts are hand-rolled inline SVG, so it works fully offline
(just open the file). User edits auto-save to `localStorage`.
