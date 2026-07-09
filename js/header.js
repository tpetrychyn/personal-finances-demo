//============ HEADER STATS ============
function renderHeaderStats(){
  document.getElementById("statIncome").textContent = fmt(baseIncome());
  document.getElementById("statExpenses").textContent = fmt(totalExpenses());
  document.getElementById("statFree").textContent = fmt(baseIncome()-totalExpenses()-totalDebtMinimums());
  document.getElementById("statFireTarget").textContent = fmt(state.fire.target);
  document.querySelector("header .sub").textContent =
    state.people.join(" & ") + " · monthly basis · as of " + state.meta.asOf;
  const al=document.getElementById("nwAgeLabel"); if(al) al.textContent=(state.people[0]||"")+" age now";
}

//============ BUDGET WIDGET ============
function renderBudgetWidget(){
  const inc=baseIncome(); if(!inc) return;
  const fixed=state.expenses.filter(e=>e.cat==="fixed").reduce((a,e)=>a+(+e.amount||0),0)+totalDebtMinimums();
  const guilt=state.expenses.filter(e=>e.cat==="guilt").reduce((a,e)=>a+(+e.amount||0),0);
  const savings=Math.max(0,inc-fixed-guilt);
  const pct=v=>Math.round(v/inc*100);
  const buckets=[
    {label:"Fixed costs", val:fixed,   color:"var(--red)"},
    {label:"Guilt-free",  val:guilt,   color:"var(--amber)"},
    {label:"Savings",     val:savings, color:"var(--green)"},
  ];
  const w=document.getElementById("budgetWidget"); if(!w) return;
  w.innerHTML=`
    <div class="budget-track">${buckets.map(b=>`<div style="width:${pct(b.val)}%;background:${b.color}"></div>`).join("")}</div>
    <div class="budget-pills">${buckets.map(b=>`
      <div class="budget-pill">
        <span class="dot" style="background:${b.color}"></span>
        ${b.label} <b>${fmt(b.val)}</b> <span class="pct">${pct(b.val)}%</span>
      </div>`).join("")}
    </div>`;
}

//============ SANKEY NOTE ============
function renderSankeyNote(){
  const debtTxt = totalDebt()>0
    ? ` You also carry <b>${fmt(totalDebt())}</b> of debt — paying it down is a guaranteed, risk-free return at each debt's rate; schedule lump-sum payoffs in the Debts card below.`
    : "";
  document.getElementById("sankeyNote").innerHTML =
    `<b>How to read this:</b> income splits three ways — expenses (fixed + guilt-free), debt payoff (minimums auto-derived from your debt items, plus any extra surplus), and savings (what's left, routed to goals). Your deployable surplus after expenses and debt minimums is <b>${fmt(surplusAt(0))}/mo</b>.${debtTxt}`;
}

