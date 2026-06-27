# Plan — Make the Finance Planner Fully Dynamic & Editable

## Goal
Turn the hardcoded "Bob & Sally" dashboard into a tool where the user can edit
**every** input — names, income (multiple sources + bonuses on set months),
expenses (add/remove/amount), goals (add/remove, target, monthly, deadline,
color), savings-account funding order, car loan (balance/rate/payment + dumps),
FIRE assumptions, and current assets — while staying a single self-contained
offline `index.html` (no build, no deps). Ship sane defaults (the current
example) so it works the moment it opens.

## Current state (what's already dynamic vs hardcoded)
- **Already editable** (keep): goal monthly $ & start month, drag/resize bars,
  car dumps, FIRE assumptions (return/age/retAge/target), localStorage + undo.
- **Hardcoded** (must become editable): names ("Bob & Sally" baked in header,
  ASSETS keys, INCOME names, goal `who`/names, legend, notes); INCOME sources;
  EXPENSES; `SURPLUS` (constant 3090); header stat numbers; GOAL_DEFS targets/
  colors/deadlines; INVEST_ORDER (cascade); CAR_LOAN; ASSETS.
- **Net-new feature**: income **bonuses on specific months**.

## Target architecture

### 1. Single source of truth: `STATE`
Replace all top-level `const` data with one `DEFAULT_STATE` object; `state` is a
deep clone of it (or the persisted copy). Every render/sim function reads `state`.

```js
const DEFAULT_STATE = {
  meta: { asOf: "June 2026", startYear: 2026, startMonth: 6, viewMonths: 24 },
  people: ["Bob", "Sally"],          // drives asset columns, ownership <select>s
  income: [                          // base monthly + optional bonuses
    { id:"inc1", name:"Bob — salary",   person:"Bob",   monthly:4800, color:"var(--blue)",   bonuses:[] },
    { id:"inc2", name:"Sally — salary", person:"Sally", monthly:3400, color:"var(--indigo)", bonuses:[] },
    { id:"inc3", name:"Sally — side gig",person:"Sally",monthly:300,  color:"var(--violet)", bonuses:[] },
    // bonus example seeded so the feature is discoverable:
    // bonuses:[{month:6, amount:8000}]  // month index (0 = startMonth), one-time
  ],
  expenses: [
    { id:"ex1", name:"Mortgage", amount:2100 }, ... (all 12 current items)
  ],
  goals: [
    // kind:"lifestyle" → fixed monthly cap, may have deadline/start, draggable
    { id:"emergency", kind:"lifestyle", name:"Emergency fund", target:15000, monthly:1000, startMo:0,  color:"var(--orange)", deadline:null },
    { id:"wedding",   kind:"lifestyle", name:"Wedding", target:20000, monthly:2000, startMo:0, color:"var(--pink)", deadline:10 },
    ... vacation, furniture, homerepair, carfund ...
    // kind:"account" → absorbs leftover cash in cascade order; optional roomBump
    { id:"rrsp_t26", kind:"account", name:"Bob RRSP '26", person:"Bob", target:18000, startMo:0,  color:"var(--green)", deadline:8,  roomBump:null },
    { id:"rrsp_t27", kind:"account", name:"Bob RRSP '27", person:"Bob", target:9000,  startMo:6,  color:"#16a34a", deadline:20, roomBump:null },
    { id:"rrsp_e",   kind:"account", name:"Sally RRSP", person:"Sally", target:0,     startMo:0,  color:"#15803d", deadline:null, roomBump:{month:6, amount:8000} },
    { id:"tfsa_t",   kind:"account", name:"Bob TFSA",   person:"Bob",   target:22000, startMo:0,  color:"#34d399", deadline:null, roomBump:{month:6, amount:7000} },
    { id:"tfsa_e",   kind:"account", name:"Sally TFSA", person:"Sally", target:15000, startMo:0,  color:"#2dd4bf", deadline:null, roomBump:{month:6, amount:7000} },
  ],
  fundingOrder: ["rrsp_t26","rrsp_t27","rrsp_e","tfsa_t","tfsa_e"], // cascade; reorderable; = account goal ids
  waterfallOrder: ["emergency","wedding","rrsp_t26","carfund","vacation","furniture","homerepair","rrsp_t27","rrsp_e","tfsa_t","tfsa_e"],
  car: { name:"Honda Civic", balance:18000, rate:0.07, biweekly:189,
         dumps:[ {month:0, amount:4000, fromSavings:true}, {month:12, amount:5000, fromSavings:false} ] },
  assets: { Bob:[["Chequing",3000],["Bank Savings",8000],["TFSA",24000],["RRSP",41000]],
            Sally:[["Chequing",2500],["Savings",6000],["TFSA",16000],["RRSP (work pension)",22000]] },
  fire: { target:1250000, returnPct:6, age:34, retireAge:60 },
  mode: "custom",
};
```

**Key generalizations of the existing special-case logic**
- `ROOM_2026`/`NEW_2027`/`NEW_ROOM_MONTH` → folded into each account goal as
  `target` (base room) + optional `roomBump:{month,amount}`.
  `targetAt(g,mi)` becomes `g.target + (g.roomBump && mi>=g.roomBump.month ? g.roomBump.amount : 0)`
  for **all** goals (lifestyle goals just have no roomBump).
- `LIFESTYLE` = `goals.filter(kind==="lifestyle").map(id)` (derived).
- `INVEST_ORDER` = `state.fundingOrder` (editable).
- `WF_ORDER` = `state.waterfallOrder` (auto-extended when goals added/removed).
- `goalBy(k)` = `state.goals.find(g=>g.id===k)`.

### 2. SURPLUS becomes per-month (income may vary by month w/ bonuses)
```js
const baseIncome   = () => state.income.reduce((a,s)=>a+(+s.monthly||0),0);
const bonusAt      = mi => state.income.reduce((a,s)=>a+(s.bonuses||[]).reduce((b,x)=>b+(+x.month===mi?(+x.amount||0):0),0),0);
const totalExpenses= () => state.expenses.reduce((a,e)=>a+(+e.amount||0),0);
const surplusAt    = mi => Math.max(0, baseIncome() + bonusAt(mi) - totalExpenses());
```
- `simulate()`: replace `let avail = Math.max(0, SURPLUS - carDumpSurplusAt(mi))`
  with `let avail = Math.max(0, surplusAt(mi) - carDumpSurplusAt(mi))`.
- `renderFire()` (header years-to-FIRE): use avg monthly surplus
  `surplusAt(0)` (base, no bonus) or a 12-mo average — use base surplus for the
  simple header estimate; keep label `*` caveat.
- `renderNW()`: `contrib = Math.max(0, surplusAt(mi) - lifeSpend(mi))`.
- Header stats (`.stats` at top) become computed: monthly income = baseIncome(),
  living+car = totalExpenses(), free = baseIncome()-totalExpenses(),
  FIRE target = state.fire.target, years-to-FIRE = renderFire(). Render via JS
  into the existing `.stat .v` slots (give them ids).

### 3. Names / people fully dynamic
- Header `<p class="sub">` → `${people.join(" & ")} · monthly basis · as of ${meta.asOf}`.
- Assets columns iterate `state.people` (not literal Bob/Sally).
- Income/goal `person` fields use `<select>` populated from `state.people`.
- Person dot color: map first person→blue, second→indigo, rest cycle a palette.
- Legend under the gantt: build dynamically from goals that have a `deadline`.

### 4. Editor UI — one collapsible "Setup" card at the very top
"Dead simple": a single **Setup / Edit inputs** card (collapsible, open by
default on first load, remembers collapsed state) holding labeled sub-sections.
Reuse existing input styles (`.inp`, `.inrow`, `.dumprow`, `.addbtn`, `.del`).
Each edit calls a debounced `applyAndRender()` that re-renders everything +
persists. Sections:

1. **People** — text inputs per person, add/remove (min 1). Renaming a person
   updates income/goal/asset ownership references (keep assets keyed by name;
   on rename, migrate the key).
2. **Income sources** — rows: name, person `<select>`, monthly $, **+ bonus**
   (each bonus = amount + month, with month→date hint), remove source, add source.
3. **Expenses** — rows: name + amount + remove; add expense.
4. **Goals** — rows: name, kind `<select>` (lifestyle/account), target $,
   monthly $ (lifestyle only), start month, deadline month (blank=none),
   color swatch, person (account only), remove; add goal. Adding/removing keeps
   `fundingOrder` (accounts) and `waterfallOrder` in sync.
5. **Funding (cascade) order** — the account goals listed with ↑/↓ buttons to
   reorder `state.fundingOrder`. (Drag optional; arrows are simplest & robust.)
6. **Car loan** — name, balance, rate %, biweekly payment. (Dumps stay in the
   existing car card.)
7. **Assets** — per person: rows of label+value, add/remove; add account.
8. **FIRE** — already in NW card; leave there (or mirror). Keep single source.

A **Reset to defaults** already exists; extend it to clear full state.
Add **Export / Import JSON** buttons (textarea or file) so a plan is portable —
nice-to-have, include if low-risk.

### 5. Persistence — whole state
`persist()` writes `JSON.stringify(state)` under a bumped key
`finplan_demo_v2`. `loadState()` deep-merges saved over `DEFAULT_STATE`
(so new fields in future still default). Drop the old piecemeal save of NW
inputs (now part of state). Undo stack snapshots `state` (structuredClone).

### 6. Things to keep working
- All three strategies (parallel/waterfall/custom), drag-to-move & resize bars,
  per-month hover tooltip, deadline markers, car amortization + chart, NW/FIRE
  projection + chart, Coast FIRE math.
- Bars/sim loop still run 72 months internally, view = `meta.viewMonths`.

## Risks & mitigations
- **Interconnected single file** → one coherent rewrite by one agent, not split.
- **Account `target:0` (Sally RRSP)** stays valid (roomBump adds room at mo 6).
- **Color picker**: use `<input type=color>` mapped to hex; CSS-var colors in
  defaults resolve via `cssVar()`; store resolved hex when user edits.
- **person rename** must not orphan assets — migrate key.
- **Empty states** (no income/goals/expenses) must not throw (guard reduces).

## Execution & delegation
1. **opus**: this plan (done).
2. **sonnet subagent**: full implementation per this spec → rewrite `index.html`.
3. **subagents (QA, parallel)**: (a) extract `<script>`, `node --check` + headless
   sim harness with numeric assertions vs known-good baseline; (b) feature-coverage
   audit (every editable feature present & wired).
4. **opus**: review QA, fix any breakage, confirm goal met.
5. **subagent**: productionalize — update README, polish, comments.

## Acceptance criteria (the goal)
User can, with no code edits, change: names ✓ · named income from multiple
sources ✓ · income bonuses on set months ✓ · goals w/ deadlines (add/remove) ✓ ·
savings funding order ✓ · car loan amount & rate ✓ · FIRE target ✓ · expenses
(add/remove/amount) ✓ · assets ✓ — all auto-saving, with sane defaults, no errors.
