//============ DEBTS ============
// baseline amortization: minimum payment only (monthly model), no extra principal
function amortMonthly(balance, monthlyPmt, annualRate){
  const rm=annualRate/12; let bal=+balance||0, interest=0, payoff=null;
  const curve=[{m:0,bal}];
  for(let mi=0; mi<SIM_MONTHS && bal>0.01; mi++){
    const intr=bal*rm; interest+=intr; bal=Math.max(0, bal+intr-monthlyPmt);
    curve.push({m:mi+1,bal});
    if(bal<=0.01 && payoff===null) payoff=mi+1;
  }
  return {curve, interest, months:payoff==null?SIM_MONTHS:payoff, payoff, paidOff:payoff!==null};
}
const carDt = m => new Date(2026,6+Math.round(Math.min(m,600)),1).toLocaleString("en-US",{month:"short",year:"numeric"});

// months to clear a debt given a fixed monthly extra payment (minimum + extra)
function debtPayoffMonths(balance, monthlyPmt, monthlyRate, extra){
  let bal=+balance||0, m=0;
  while(bal>0.01 && m<1200){ bal=bal*(1+monthlyRate)-(monthlyPmt+extra); if(bal<0)bal=0; m++; }
  return bal>0.01 ? Infinity : m;
}
// solve the monthly extra payment that clears a debt in ~targetMonths (for bar-drag resizing)
function extraForDuration(d, targetMonths){
  const bal=+d.balance||0, pm=debtMonthly(d), rm=(+d.rate||0)/12;
  if(targetMonths<=0) return Infinity;
  if(debtPayoffMonths(bal,pm,rm,0) <= targetMonths) return 0;   // minimum alone already clears it in time
  let lo=0, hi=bal;
  for(let k=0;k<44;k++){ const mid=(lo+hi)/2; if(debtPayoffMonths(bal,pm,rm,mid) <= targetMonths) hi=mid; else lo=mid; }
  return Math.round(hi);
}

// base = minimum-only; plan = the priority simulation (extra surplus + dumps for this debt)
function debtCompute(d, sim){
  const base = amortMonthly(+d.balance||0, debtMonthly(d), +d.rate||0);
  const ds = sim && sim.debtState ? sim.debtState[d.id] : null;
  const plan = ds
    ? {curve:ds.curve, interest:ds.interest, payoff:ds.payoff, months:ds.payoff==null?SIM_MONTHS:ds.payoff, paidOff:ds.payoff!=null}
    : base;
  return {base, plan};
}
function debtStatsHTML(d, base, plan){
  const intSaved=Math.max(0, base.interest-plan.interest);
  const baseM=base.paidOff?base.months:SIM_MONTHS, planM=plan.paidOff?plan.months:SIM_MONTHS;
  const moSaved=Math.max(0, baseM-planM);
  return `
    <div class="stat"><div class="k">Payoff — minimum only</div><div class="v sm">${base.paidOff?carDt(base.months):">50y"}</div><div class="k" style="margin-top:3px">${fmt(base.interest)} interest</div></div>
    <div class="stat"><div class="k">Payoff — with your plan</div><div class="v sm" style="color:var(--green)">${plan.paidOff?carDt(plan.payoff):">50y"}</div><div class="k" style="margin-top:3px">${fmt(plan.interest)} interest</div></div>
    <div class="stat"><div class="k">Interest saved (guaranteed)</div><div class="v sm" style="color:var(--green)">${fmt(intSaved)}</div></div>
    <div class="stat"><div class="k">Payoff shortened by</div><div class="v sm">${moSaved.toFixed(0)} mo</div></div>`;
}

function renderDebts(){
  const box=document.getElementById("debtBlocks"); if(!box) return;
  box.innerHTML="";
  const title=document.getElementById("debtCardTitle");
  if(title) title.textContent = (state.debts||[]).length===1
    ? `${state.debts[0].name} — ${fmt(state.debts[0].balance)} @ ${(state.debts[0].rate*100).toFixed(1)}%`
    : "Debts";
  const sim=simulate();
  (state.debts||[]).forEach((d,di)=>{
    const {base,plan}=debtCompute(d,sim);
    const freqTxt=d.freq==="biweekly"?"biweekly":"monthly";
    const aggressive = sim.alloc0 && sim.alloc0[d.id]>0;
    const block=el("div","debt-block"); block.dataset.di=di;
    block.innerHTML=`
      <h3><span class="dot" style="background:var(--faint)"></span>${esc(d.name)} <span style="font-weight:400;color:var(--muted);font-size:13px">· ${esc(d.kind||"Debt")} · ${fmt(d.balance)} @ ${(d.rate*100).toFixed(1)}%</span></h3>
      <p class="dbsub">${fmt(d.payment)} ${freqTxt} minimum (≈ ${fmt(debtMonthly(d))}/mo)${aggressive?" · <span style=\"color:var(--green)\">+ surplus (high priority — see goal timeline)</span>":" · drag it up the goal priority list to pay it off aggressively from surplus"}${base.paidOff?"":" — ⚠ minimum payment too small to ever clear this debt"}</p>
      <div class="ctl-lbl">One-time lump sums (existing cash, or surplus at a chosen month) — on top of the priority-driven payoff</div>
      <div class="dumps"></div>
      <button class="addbtn">+ Add a lump sum</button>
      <div class="stats debt-stats">${debtStatsHTML(d,base,plan)}</div>
      <svg viewBox="0 0 900 240" preserveAspectRatio="xMidYMid meet" style="margin-top:8px" class="debt-chart"></svg>`;
    box.appendChild(block);
    renderDebtChart(block.querySelector(".debt-chart"), base, plan, (+d.balance||0)*1.05);
    renderDumpRows(block.querySelector(".dumps"), di);
    block.querySelector(".addbtn").addEventListener("click",()=>{
      snapState(); state.debts[di].dumps.push({month:12,amount:2000,fromSavings:false}); renderDebts(); renderAll();
    });
  });
}

// light refresh of one debt's stats+chart, leaving its dump inputs (and focus) intact
function refreshDebt(di){
  const d=state.debts[di]; if(!d) return;
  const block=document.querySelector('.debt-block[data-di="'+di+'"]'); if(!block) return;
  const sim=simulate();
  const {base,plan}=debtCompute(d,sim);
  const st=block.querySelector(".debt-stats"); if(st) st.innerHTML=debtStatsHTML(d,base,plan);
  renderDebtChart(block.querySelector(".debt-chart"), base, plan, (+d.balance||0)*1.05);
}

function renderDumpRows(box, di){
  if(!box) return;
  box.innerHTML="";
  (state.debts[di].dumps||[]).forEach((d,i)=>{
    const row=document.createElement("div"); row.className="dumprow";
    row.innerHTML=`$<input class="amt" type="number" step="500" min="0" value="${d.amount}" data-i="${i}" data-f="amount">
      <span class="x">in</span>
      <input class="mo" type="month" min="${monthInputValue(0)}" value="${monthInputValue(d.month)}" data-i="${i}" data-f="month">
      <span class="hint">${carDt(d.month)}</span>
      <label class="cashtog" title="Paid from existing cash — doesn't reduce your monthly investing surplus">
        <input type="checkbox" data-i="${i}" data-f="fromSavings" ${d.fromSavings?"checked":""}> existing cash</label>
      <button class="del" data-i="${i}" title="remove">×</button>`;
    box.appendChild(row);
  });
  box.querySelectorAll("input[type=number]").forEach(inp=>inp.addEventListener("input",e=>{
    state.debts[di].dumps[+e.target.dataset.i][e.target.dataset.f]=Math.round(+e.target.value||0);
    refreshDebt(di); renderAll();   // light refresh keeps input focus; gantt+sankey reflect dumps
  }));
  box.querySelectorAll("input[type=month]").forEach(inp=>inp.addEventListener("change",e=>{
    const i=+e.target.dataset.i, month=offsetFromMonthInput(e.target.value);
    state.debts[di].dumps[i].month=month;
    e.target.parentElement.querySelector(".hint").textContent=carDt(month);
    refreshDebt(di); renderAll();
  }));
  box.querySelectorAll("input[type=checkbox]").forEach(inp=>inp.addEventListener("change",e=>{
    state.debts[di].dumps[+e.target.dataset.i].fromSavings=e.target.checked; refreshDebt(di); renderAll();
  }));
  box.querySelectorAll(".del").forEach(b=>b.addEventListener("click",()=>{
    snapState(); state.debts[di].dumps.splice(+b.dataset.i,1); renderDebts(); renderAll();
  }));
}

function renderDebtChart(svg, base, plan, maxYIn){
  if(!svg) return;
  const W=900,H=240,pL=58,pR=16,pT=14,pB=28;
  const maxM=Math.min(360, Math.max(1, base.months||1)), maxY=Math.max(1, maxYIn||1);
  const X=m=>pL+(Math.min(m,maxM)/maxM)*(W-pL-pR);
  const Y=v=>H-pB-(v/maxY)*(H-pT-pB);
  let s="";
  for(let i=0;i<=4;i++){ const v=maxY*i/4, y=Y(v);
    s+=`<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="var(--line)"/>`;
    s+=`<text x="${pL-8}" y="${y+4}" text-anchor="end" fill="var(--faint)" font-size="11">${fmt(v)}</text>`; }
  const stepM=maxM>36?12:6;
  for(let m=0;m<=maxM;m+=stepM){ s+=`<text x="${X(m)}" y="${H-9}" text-anchor="middle" fill="var(--faint)" font-size="11">${new Date(2026,6+Math.round(m),1).getFullYear()}</text>`; }
  const path=(curve,color,w)=>curve&&curve.length?`<path d="M${curve.map(p=>`${X(p.m).toFixed(1)},${Y(p.bal).toFixed(1)}`).join(" L")}" fill="none" stroke="${cssVar(color)}" stroke-width="${w}"/>`:"";
  s+=path(base.curve,'var(--amber)',2);
  s+=path(plan.curve,'var(--green)',2.5);
  s+=`<rect x="${pL+8}" y="${pT}" width="12" height="3" fill="${cssVar('var(--amber)')}"/><text x="${pL+24}" y="${pT+5}" fill="var(--muted)" font-size="11">minimum payments</text>`;
  s+=`<rect x="${pL+8}" y="${pT+16}" width="12" height="3" fill="${cssVar('var(--green)')}"/><text x="${pL+24}" y="${pT+21}" fill="var(--muted)" font-size="11">with your plan (priority + lump sums)</text>`;
  svg.innerHTML=s;
}

