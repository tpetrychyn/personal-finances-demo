//============ PAGE LAYOUT ============
// The page scaffold (cards + element IDs) lives here ONCE, shared by every entry
// HTML file (public index.html and the gitignored index-taylor.html). Those files
// are thin launchers: <link> + this + the other js/*.js. Keeping the markup here —
// not duplicated per HTML file — means a new feature/card is added in one place and
// both the public demo and a personal seed pick it up. Header text (names, "as of")
// is data-driven by renderHeaderStats(), so the placeholders below are just defaults.
// Runs FIRST (before state.js…main.js), inserting the scaffold ahead of those <script>
// siblings so their getElementById() calls resolve.
document.body.insertAdjacentHTML("afterbegin", `
<div class="wrap">
  <header>
    <h1>Household Cashflow &amp; Funding Plan</h1>
    <p class="sub">monthly basis</p>
  </header>

  <!-- Setup card inserted before stats -->
  <div class="setup-card" id="setupCard">
    <button class="setup-toggle" id="setupToggle">
      <span>⚙ Setup / Edit inputs</span>
      <span id="setupChevron">▾</span>
    </button>
    <div class="setup-body" id="setupBody" style="display:none">
      <!-- populated by renderSetup() -->
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="k">Monthly income</div><div class="v" id="statIncome">—</div></div>
    <div class="stat"><div class="k">Expenses</div><div class="v" id="statExpenses">—</div></div>
    <div class="stat"><div class="k">Free to deploy / mo</div><div class="v" id="statFree" style="color:var(--green)">—</div></div>
    <div class="stat"><div class="k">FIRE target</div><div class="v sm" id="statFireTarget">—</div></div>
    <div class="stat"><div class="k">Yrs to FIRE*</div><div class="v sm" id="fireYears">—</div></div>
  </div>

  <!-- SANKEY card -->
  <div class="card">
    <div class="cardhead">
      <div><h2>Where the money goes</h2>
      <p class="sub">Income → expenses, debt payoff, and savings. Use ‹ › to browse months.</p></div>
      <div class="sankey-nav">
        <button id="sankeyPrev">‹</button>
        <span class="mo-lbl" id="sankeyMonthLbl">—</span>
        <button id="sankeyNext">›</button>
      </div>
    </div>
    <div class="budget-widget" id="budgetWidget"></div>
    <div class="sankey"><svg id="sankey" viewBox="0 0 1300 780" preserveAspectRatio="xMidYMid meet"></svg></div>
    <div class="note" id="sankeyNote"></div>
  </div>

  <!-- GANTT card -->
  <div class="card">
    <div class="cardhead">
      <div><h2>Funding goals &amp; timelines</h2>
      <p class="sub">Every goal <b>and debt</b> shares one priority list — top = funded first. <b>Drag the ⠿ grip to reprioritize</b> (drag a debt up to pay it off aggressively). In <b>Custom</b> mode, <b>drag a bar to move/pace it</b>: goals move (start month) and resize ($/mo); debts resize to set payoff speed. Accounts fill from whatever's left unless you cap them.</p></div>
    </div>

    <div class="controls">
      <div>
        <div class="ctl-lbl">Strategy</div>
        <div class="presets">
          <button class="btn" data-mode="parallel">Parallel</button>
          <button class="btn" data-mode="waterfall">Waterfall</button>
          <button class="btn active" data-mode="custom">Custom (phased)</button>
        </div>
        <button id="undoBtn" class="reset" title="Undo last goal change (⌘/Ctrl+Z)" disabled>↩ Undo</button>
        <button id="resetBtn" class="reset" title="Clear saved settings and reload">↺ Reset to defaults</button>
        <span class="savehint">· changes auto-save to this browser</span>
      </div>
      <div style="flex:1;min-width:280px">
        <div class="ctl-lbl" id="inputsLabel">Monthly $ &amp; start month per lifestyle goal · accounts absorb the rest</div>
        <div class="inputs" id="inputs"></div>
      </div>
    </div>

    <div class="gantt">
      <div class="axis">
        <div></div>
        <div class="months" id="axis"></div>
        <div></div>
      </div>
      <div class="grow">
        <div class="gridlines" id="gridlines"></div>
        <div id="rows"></div>
      </div>
    </div>
    <div id="barTip" class="bartip"></div>

    <div class="legend2" id="ganttLegend"></div>
    <div class="note">
      <b>Accounts are per person.</b> Leftover cash each month cascades into your savings/registered accounts in this order: <b id="cascadeOrderText">—</b>. Reorder it under <b>Setup → Funding cascade order</b>. A goal can carry a <b>deadline</b> (e.g. an RRSP tax-year cutoff) — shown as a vertical line — and a one-time <b>room bump</b> (new contribution room unlocking on a set month). Vertical lines mark deadlines.<br><br>
      <b>Three strategies:</b> <b>Parallel</b> — lifestyle goals take fixed monthly slices, accounts absorb the rest. <b>Waterfall</b> — one goal at a time in priority order. <b>Custom (phased, shown)</b> — set each lifestyle goal's monthly $ <i>and</i> a start month (e.g. RRSP + wedding now, vacation/furniture deferred); the accounts soak up whatever's left. Bulk car dumps (car card) come off that month's surplus — except ones flagged "existing cash" like Sally's $4k, which don't.<br><br>
      The <b>~$5k RRSP refund</b> arriving spring 2027 isn't modeled in the bars; routing it to the car loan or a TFSA pulls finish lines in. *FIRE estimate ignores investment growth — purely savings ÷ target, so the real timeline is faster.
    </div>
  </div>

  <!-- DEBTS card -->
  <div class="card">
    <div class="cardhead">
      <div><h2 id="debtCardTitle">Debts</h2>
      <p class="sub">Any debt — car loan, credit card, student loan, line of credit — costs money. Paying it down is a <b>guaranteed, risk-free return</b> at the debt's interest rate, often beating (and safer than) investing. Schedule lump-sum payoffs below to see the interest saved. Add or edit debts in <b>Setup → Debts</b>.</p></div>
    </div>

    <div id="debtBlocks"></div>

    <div class="note">
      <b>Decision rule:</b> a dollar against a debt earns a <b>guaranteed</b> return equal to its rate; the same dollar invested earns ~6% <i>and isn't guaranteed</i>. So high-rate debt (credit cards especially) is usually your best-value dollar — arguably ahead of topping up a TFSA. <b>Opportune times</b> to dump: whenever a goal finishes and frees cash, or any windfall — there's no penalty for early payoff, and every month carried keeps costing the rate. Surplus-funded dumps are wired into the goal timeline above, so you can see what each one costs your investing pace that month.
    </div>
  </div>

  <!-- NET WORTH & FIRE card -->
  <div class="card">
    <div class="cardhead">
      <div><h2>Net worth &amp; FIRE projection</h2>
      <p class="sub">Today's holdings compounded forward, plus what you keep investing — with Full FIRE and Coast FIRE milestones.</p></div>
    </div>

    <div class="assets" id="assetsBox"></div>

    <div class="controls" style="margin-top:18px">
      <div>
        <div class="ctl-lbl">Assumptions (edit freely)</div>
        <div class="inputs">
          <div class="inp"><label>Return %/yr (nominal)</label><input id="nwReturn" type="number" step="0.5" value="6"></div>
          <div class="inp"><label id="nwAgeLabel">Age now</label><input id="nwAge" type="number" step="1" value="34"></div>
          <div class="inp"><label>Coast retire age</label><input id="nwRetAge" type="number" step="1" value="60"></div>
          <div class="inp"><label>FIRE target</label><input id="nwFire" type="number" step="10000" value="1250000"></div>
        </div>
      </div>
    </div>

    <div class="stats" id="nwStats"></div>

    <svg id="nwChart" viewBox="0 0 920 320" preserveAspectRatio="xMidYMid meet" style="margin-top:8px"></svg>
    <div class="legend2" id="nwLegend"></div>

    <div class="note">
      <b>Coast FIRE</b> = the point where your invested assets are big enough that, <i>even if you never contribute another dollar</i>, normal market growth carries them to your FIRE number by your retirement age. Once you cross it, work/saving becomes optional — you're just "coasting." <b>Full FIRE</b> = the portfolio actually reaching your target (here $1.25M, ~4% withdrawal ≈ $50k/yr). After Full FIRE the line models a 4%/yr drawdown, so it roughly plateaus.<br><br>
      <b>Assumptions to sanity-check:</b> one blended <b>nominal</b> return across all accounts (cash included — lower its drag by adjusting the rate); Bob's age is a guess — set it and the retire age for an accurate Coast number. Contributions follow the plan above (surplus minus lifestyle spending while goals are active, then the full surplus). Only the car loan is subtracted as a liability.
    </div>
  </div>

  <!-- FIRE IMPACT card -->
  <div class="card">
    <div class="cardhead">
      <div><h2>What moves your FIRE date</h2>
      <p class="sub">How much each spending goal pushes FIRE out — and how trimming monthly expenses pulls FIRE <b>and</b> Coast FIRE forward. Driven by the same projection as the chart above (returns included, so more accurate than the headline estimate).</p></div>
    </div>

    <div class="fi-sub">Each spending goal's drag on FIRE</div>
    <div id="goalImpactRows"></div>
    <div class="legend2" id="goalImpactNote" style="margin-top:12px"></div>

    <div class="fi-sub">Trim spending → pull FIRE forward</div>
    <div class="exp-explorer">
      <div class="exp-slider-row">
        <label style="font-size:12px;color:var(--muted);white-space:nowrap">Cut from monthly spending</label>
        <input type="range" id="expCutSlider" min="0" max="100" step="50" value="0">
        <span id="expCutLbl" style="font-variant-numeric:tabular-nums;min-width:72px;font-weight:650;text-align:right">$0/mo</span>
      </div>
      <div class="exp-readout" id="expReadout"></div>
      <svg id="expFireChart" viewBox="0 0 920 300" preserveAspectRatio="xMidYMid meet" style="margin-top:4px"></svg>
      <div class="legend2" id="expFireLegend"></div>
    </div>

    <div class="note" id="fireImpactNote"></div>
  </div>

  <!-- FINANCIAL FREEDOM EXPLORER card -->
  <div class="card" id="freedomCard">
    <div class="cardhead">
      <div><h2>Financial freedom explorer</h2>
      <p class="sub">Model different income paths for each partner — a layoff and gap, a new job at a lower salary, a hard downshift, parental leave — and see what you'd retire with, when you cross Coast/Full FIRE, and whether the portfolio ever runs dry. Uses your live goals, debts, expenses, assets, return and ages; each scenario is an independent what-if you can compare side by side.</p></div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div class="inp"><label>Horizon (yrs)</label><input id="freedomHorizon" type="number" step="1" min="5" style="width:74px"></div>
        <button class="btn" id="addScenarioBtn">+ Scenario</button>
      </div>
    </div>

    <div id="freedomScenarios"></div>

    <div class="fi-sub">Net worth by scenario</div>
    <svg id="freedomChart" viewBox="0 0 920 340" preserveAspectRatio="xMidYMid meet" style="margin-top:4px"></svg>
    <div class="legend2" id="freedomLegend"></div>

    <div class="fi-sub">Outcomes</div>
    <div id="freedomOutcomes"></div>

    <div class="note" id="freedomNote"></div>
  </div>
</div>
`);
