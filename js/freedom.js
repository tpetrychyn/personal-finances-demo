//============ FINANCIAL FREEDOM EXPLORER ============
// A scenario planner layered on top of the plan. Where the Net-worth card projects ONE
// static income forever, this models income as a TIMELINE of phases per person — a job
// that starts/stops, a layoff gap, a downshift, parental leave — and asks: what do we
// retire with, when do we cross Coast/Full FIRE, and does the portfolio ever run dry?
//
// Scenarios are independent, saved "what-ifs" — editing your real income in Setup does
// NOT rewrite them (they're snapshots you compare side by side). Everything else — goals,
// debts, expenses, assets, return %, FIRE target, ages — is read live from `state`.

const FF_SC_COLORS = ["var(--green)","var(--blue)","var(--violet)","var(--pink)","var(--amber)","var(--sky)","var(--orange)","var(--red)"];
const FF_PERSON_COLORS = ["var(--blue)","var(--indigo)","var(--violet)","var(--pink)","var(--sky)","var(--amber)"];
const ffPersonColor = name => {
  const i = state.people.indexOf(name);
  return FF_PERSON_COLORS[Math.min(Math.max(i,0), FF_PERSON_COLORS.length-1)];
};
const ffDate = m => new Date(START.y, START.m + Math.round(m), 1).toLocaleString("en-US",{month:"short",year:"numeric"});
const ffMoLbl = m => (m>=18 ? (m/12).toFixed(m%12===0?0:1)+" yr" : Math.round(m)+" mo");

//============ MODEL ============
// state.freedom = { horizonYears, scenarios:[{id,name,color,phases:[{id,person,label,annual,startMonth,months}]}] }
// phase.months === null  → income runs indefinitely (a "keep this job" phase)
function ffCurrentPlanScenario(){
  return {
    id: uid("sc"), name: "Current plan", color: FF_SC_COLORS[0],
    phases: (state.income||[]).filter(s=>(+s.monthly||0)>0).map(s=>({
      id: uid("ph"), person: s.person,
      label: s.name.replace(/\s*—\s*(salary|income)$/i,"").trim() || s.name,
      annual: Math.round((+s.monthly||0)*12), startMonth: 0, months: null
    }))
  };
}
function ensureFreedom(){
  if(!state.freedom || typeof state.freedom!=="object") state.freedom = {};
  const f = state.freedom;
  if(!(f.horizonYears>0)) f.horizonYears = Math.max(20, (state.fire.retireAge||60)-(primaryAge()||30)+5);
  if(!Array.isArray(f.scenarios)) f.scenarios = [];
  f.scenarios.forEach(sc=>{
    if(!sc.id) sc.id = uid("sc");
    if(!sc.name) sc.name = "Scenario";
    if(!sc.color) sc.color = FF_SC_COLORS[0];
    if(!Array.isArray(sc.phases)) sc.phases = [];
    sc.phases.forEach(p=>{
      if(!p.id) p.id = uid("ph");
      if(p.annual==null && p.monthly!=null) p.annual = Math.round((+p.monthly||0)*12);
      if(p.months==="") p.months = null;
    });
  });
  if(!f.scenarios.length) f.scenarios.push(ffCurrentPlanScenario());
}
const ffScenario = id => (state.freedom.scenarios||[]).find(s=>s.id===id);
const ffPhase = (sc,id) => (sc.phases||[]).find(p=>p.id===id);
// the projection window in months — everything (phase ends, date pickers) is bounded by this.
// A phase whose `until` reaches the horizon end is stored as months=null ("runs to the end").
function ffHorizonMonths(){
  const age=primaryAge()||0, retAge=state.fire.retireAge||65;
  const retMonth=Math.round(Math.max(1,retAge-age)*12);
  return Math.max(retMonth+12, Math.round((state.freedom.horizonYears||40)*12));
}

//============ PROJECTION ============
// Track invested assets and debt balances SEPARATELY (unlike the headline card), so a debt
// payment is a transfer (not a net-worth loss) and freeing the payment at payoff is captured.
// contribution can go NEGATIVE when income doesn't cover expenses+goals+debt — the portfolio
// funds the gap (the whole point of modelling a layoff or a career break).
function ffIncomeAt(sc, mi){
  return (sc.phases||[]).reduce((sum,p)=>{
    const st  = Math.max(0, +p.startMonth||0);
    const dur = (p.months==null || p.months==="") ? Infinity : Math.max(0, +p.months||0);
    return sum + ((mi>=st && mi<st+dur) ? (+p.annual||0)/12 : 0);
  }, 0);
}
function ffProject(sc){
  const r = (state.fire.returnPct||0)/100, mr = r/12;
  const fire = state.fire.target||0;
  const age = primaryAge()||0, retAge = state.fire.retireAge||65;
  const yearsToRet = Math.max(1, retAge-age);
  const retMonth = Math.round(yearsToRet*12);
  const horizon = ffHorizonMonths();
  const expenses = totalExpenses();

  // Lifestyle goals = planned spending. Their active window is income-independent: each runs
  // from its start month for however long its monthly pace takes to hit target.
  const lifeWin = state.goals.filter(g=>g.kind==="lifestyle").map(g=>{
    const st=+g.startMo||0, m=+g.monthly||0, tgt=+g.target||0;
    return { st, end: st + (m>0 ? Math.ceil(tgt/m) : 0), m };
  });
  const lifeAt = mi => lifeWin.reduce((a,w)=> a + ((mi>=w.st && mi<w.end) ? w.m : 0), 0);

  const debts = (state.debts||[]).map(d=>({ bal:+d.balance||0, rm:(+d.rate||0)/12, pm:debtMonthly(d) }));

  let assets = Object.keys(state.assets).reduce((a,w)=>a+sumAssets(w),0);
  let debtBal = debts.reduce((a,d)=>a+d.bal,0);
  let nw = assets - debtBal;
  const series = [{ m:0, v:nw, inc:ffIncomeAt(sc,0) }];
  let coastMonth=null, fireMonth=null, dryMonth=null, minNW=nw, peakNW=nw, nwAtRet=nw;
  for(let mi=0; mi<horizon; mi++){
    const income = ffIncomeAt(sc, mi);
    // debt: accrue interest, take the (frequency-normalized) payment; payment stops at payoff
    let dserv = 0;
    debts.forEach(d=>{ if(d.bal>0.01){ const intr=d.bal*d.rm; const pay=Math.min(d.pm, d.bal+intr); d.bal=d.bal+intr-pay; dserv+=pay; } });
    debtBal = debts.reduce((a,d)=>a+d.bal,0);
    const contribution = income - expenses - lifeAt(mi) - dserv;   // + invests, − draws down
    assets = assets*(1+mr) + contribution;
    if(assets < 0){ if(dryMonth===null) dryMonth = mi+1; assets = 0; }   // portfolio exhausted
    nw = assets - debtBal;
    if(nw<minNW) minNW=nw;
    if(nw>peakNW) peakNW=nw;
    const yearsRemain = Math.max(0, yearsToRet-(mi+1)/12);
    const coastNeed = fire/Math.pow(1+r, yearsRemain);
    if(coastMonth===null && nw>=coastNeed) coastMonth = mi+1;
    if(fireMonth===null && nw>=fire) fireMonth = mi+1;
    if(mi+1===retMonth) nwAtRet = nw;
    if((mi+1)%3===0 || mi===horizon-1) series.push({ m:mi+1, v:nw, inc:income });
  }
  return { sc, series, coastMonth, fireMonth, dryMonth, minNW, peakNW, nwAtRet, retMonth, horizon, retAge, fire };
}

//============ RENDER (editors) ============
function renderFreedom(){
  const host = document.getElementById("freedomScenarios");
  if(!host) return;
  ensureFreedom();
  host.innerHTML = "";
  const f = state.freedom;

  f.scenarios.forEach(sc=>{
    const block = el("div","scenario"); block.dataset.sc = sc.id;
    // ── header: color · name · inline outcome · duplicate · delete ──
    const head = el("div","scenario-head");
    head.innerHTML = `
      <span class="dot" style="background:${cssVar(sc.color)}"></span>
      <input class="sc-name" type="text" value="${esc(sc.name)}" placeholder="Scenario name">
      <span class="sc-metrics" id="ff-m-${sc.id}"></span>
      <span class="spacer"></span>
      <button class="iconbtn" data-act="dup" title="Duplicate scenario">⧉</button>
      <button class="iconbtn" data-act="del" title="Delete scenario">×</button>`;
    head.querySelector(".sc-name").addEventListener("input", e=>{ sc.name = e.target.value; renderFreedomOutput(); });
    head.querySelector('[data-act="dup"]').addEventListener("click", ()=>{
      snapState();
      const copy = structuredClone(sc);
      copy.id = uid("sc"); copy.name = sc.name+" (copy)";
      copy.color = FF_SC_COLORS[f.scenarios.length % FF_SC_COLORS.length];
      copy.phases.forEach(p=>p.id=uid("ph"));
      const at = f.scenarios.indexOf(sc);
      f.scenarios.splice(at+1, 0, copy);
      renderFreedom();
    });
    head.querySelector('[data-act="del"]').addEventListener("click", ()=>{
      if(f.scenarios.length<=1){ alert("Keep at least one scenario."); return; }
      snapState();
      f.scenarios = f.scenarios.filter(s=>s.id!==sc.id);
      renderFreedom();
    });
    block.appendChild(head);

    // ── phase timeline (refreshed live by renderFreedomOutput) ──
    const tl = el("div","phase-timeline"); tl.id = "ff-tl-"+sc.id;
    block.appendChild(tl);

    // ── phase editor, grouped by partner (each partner has their own list + add button) ──
    const editor = el("div","ff-phase-editor");
    const persons = [...state.people];
    sc.phases.forEach(p=>{ const who=p.person||state.people[0]; if(who && !persons.includes(who)) persons.push(who); });
    persons.forEach(person=>{
      const grp = el("div","ff-pgroup");
      const gh = el("div","ff-pgroup-head");
      gh.innerHTML = `<span class="dot" style="background:${cssVar(ffPersonColor(person))}"></span>${esc(person)}`;
      grp.appendChild(gh);
      sc.phases.filter(p=>(p.person||state.people[0])===person).forEach(p=>grp.appendChild(ffPhaseRow(sc, p, person)));
      const add = el("button","addbtn"); add.textContent = "+ income for "+person; add.style.marginTop="2px";
      add.addEventListener("click", ()=>{
        snapState();
        sc.phases.push({ id:uid("ph"), person, label: person+" income", annual: 60000, startMonth: 0, months: null });
        renderFreedom();
      });
      grp.appendChild(add);
      editor.appendChild(grp);
    });
    block.appendChild(editor);
    host.appendChild(block);
  });

  renderFreedomOutput();
}

// One phase reads like a sentence: "‹label› $‹amount›/yr  from ‹month› until ‹month›/ongoing".
// Start/end are real Month-Year pickers; the model still stores startMonth + months (duration),
// so the projection and drag are unchanged — the pickers just convert to/from month offsets.
function ffPhaseRow(sc, p, person){
  const row = el("div","phase-row"); row.dataset.ph = p.id;
  const H = ffHorizonMonths();
  const startOff = Math.min(+p.startMonth||0, H-1);
  const runsToEnd = (p.months==null || p.months==="");     // no explicit end → runs to the horizon
  const untilOff = runsToEnd ? H : Math.min(H, startOff + Math.max(1,+p.months||0));
  row.innerHTML = `
    <span class="dot" style="background:${cssVar(ffPersonColor(person||p.person))}"></span>
    <input class="ph-label" type="text" value="${esc(p.label||"")}" placeholder="e.g. New job, Mat leave">
    <span class="paren">$</span><input class="ph-annual" type="number" step="1000" min="0" value="${+p.annual||0}" title="Gross $/year">
    <span class="paren">/yr</span><span class="hint ff-mohint">= ${fmt((+p.annual||0)/12)}/mo</span>
    <label class="paren">from</label><input class="ph-from" type="month" min="${monthInputValue(0)}" max="${monthInputValue(H-1)}" value="${monthInputValue(startOff)}">
    <label class="paren">until</label><input class="ph-until" type="month" min="${monthInputValue(startOff+1)}" max="${monthInputValue(H)}" value="${monthInputValue(untilOff)}">
    <span class="hint ff-durlbl">${ffDurLbl(p)}</span>
    <button class="del" title="Remove phase">×</button>`;

  const durEl = row.querySelector(".ff-durlbl");
  const fromEl = row.querySelector(".ph-from");
  const untilEl = row.querySelector(".ph-until");
  const syncFromUntil = ()=>{                               // recompute duration from the two dates
    const s = Math.min(offsetFromMonthInput(fromEl.value), H-1);
    let u = offsetFromMonthInput(untilEl.value);
    u = Math.max(s+1, Math.min(H, u));                      // end after start, capped at the horizon
    p.startMonth = s;
    p.months = (u>=H) ? null : (u-s);                       // reaching the horizon end = runs to the end
    untilEl.min = monthInputValue(s+1);
    durEl.textContent = ffDurLbl(p);
  };

  row.querySelector(".ph-label").addEventListener("input", e=>{ p.label=e.target.value; renderFreedomOutput(); });
  row.querySelector(".ph-annual").addEventListener("input", e=>{
    p.annual=Math.max(0,Math.round(+e.target.value||0));
    row.querySelector(".ff-mohint").textContent = "= "+fmt(p.annual/12)+"/mo";
    renderFreedomOutput();
  });
  fromEl.addEventListener("change", ()=>{ syncFromUntil(); renderFreedomOutput(); });
  untilEl.addEventListener("change", ()=>{ syncFromUntil(); renderFreedomOutput(); });
  row.querySelector(".del").addEventListener("click", ()=>{
    snapState();
    sc.phases = sc.phases.filter(x=>x.id!==p.id);
    renderFreedom();
  });
  return row;
}
function ffDurLbl(p){
  const start = +p.startMonth||0;
  const months = (p.months==null || p.months==="") ? (ffHorizonMonths()-start) : (+p.months||0);
  return "· "+ffMoLbl(months);   // yr for ≥18 mo, else mo
}

//============ RENDER (chart · timelines · outcomes — no editor rebuild, so inputs keep focus) ============
function renderFreedomOutput(){
  ensureFreedom();
  const projs = state.freedom.scenarios.map(ffProject);
  renderFreedomTimelines(projs);
  renderFreedomChart(projs);
  renderFreedomOutcomes(projs);
  renderFreedomNote();
  projs.forEach(pr=>{
    const m = document.getElementById("ff-m-"+pr.sc.id);
    if(m) m.innerHTML = `retire with <b style="color:${cssVar(pr.sc.color)}">${fmt(pr.nwAtRet)}</b> at age ${pr.retAge}`
      + (pr.dryMonth ? ` · <span style="color:var(--red)">runs dry ${ffDate(pr.dryMonth)}</span>` : "");
  });
  if(!dragging) persist();   // during a bar drag, persist once on mouseup instead of every frame
}

// Per-scenario phase timeline, grouped by PARTNER. Each partner gets a labeled band and one
// lane per income phase, so a job → gap → new job (or a salary running alongside a side gig)
// reads clearly and never overlaps. Time axis runs to the retire month; gaps = empty lane.
function renderFreedomTimelines(projs){
  projs.forEach(pr=>{
    const host = document.getElementById("ff-tl-"+pr.sc.id);
    if(!host) return;
    const span = Math.max(24, pr.retMonth);            // months shown
    const X = m => (Math.min(m,span)/span)*100;
    const stepYr = span>240 ? 5 : (span>120 ? 2 : 1);
    let ticks = "";
    for(let y=0; y*12<=span; y+=stepYr){ const m=y*12;
      ticks += `<span class="ff-tick" style="left:${X(m)}%">${START.y+Math.floor((START.m+m)/12)}</span>`; }

    // partner ordering: real people first, then any orphaned names still referenced by phases
    const persons = [...state.people];
    (pr.sc.phases||[]).forEach(p=>{ const who=p.person||state.people[0]; if(who && !persons.includes(who)) persons.push(who); });

    const groups = persons.map(person=>{
      const phs = (pr.sc.phases||[]).filter(p=>(p.person||state.people[0])===person);
      if(!phs.length) return "";
      const c = cssVar(ffPersonColor(person));
      const lanes = phs.map(p=>{
        const st = +p.startMonth||0;
        const ong = (p.months==null || p.months==="");
        const end = ong ? span : Math.min(span, st+(+p.months||0));
        const zero = (+p.annual||0)<=0;
        let bar = "";
        if(end>st && st<span){
          const w = Math.max(1.5, X(end)-X(st));
          const lbl = zero ? "no income" : "$"+Math.round((+p.annual||0)/1000)+"k";
          const title = `${esc(p.label||person)} · ${fmt(+p.annual||0)}/yr · ${ffDate(st)}–${ong?"ongoing":ffDate(st+(+p.months||0))}  ·  drag to move · drag right edge to set when it ends`;
          bar = `<div class="phase-tl-bar${zero?" zero":""}" data-ph="${p.id}" style="left:${X(st)}%;width:${w}%;${zero?"":"background:"+c}" title="${title}">${lbl}<div class="ff-rz ff-rz-l"></div><div class="ff-rz ff-rz-r"></div></div>`;
        }
        return `<div class="ff-tl-lane">${bar}</div>`;
      }).join("");
      return `<div class="ff-tl-group">
        <div class="ff-tl-plabel"><span class="dot" style="background:${c}"></span>${esc(person)}</div>
        <div class="ff-tl-lanes">${lanes}</div></div>`;
    }).join("");

    host.innerHTML =
      `<div class="ff-tl-axis"><div></div><div class="ff-tl-ticks">${ticks}</div></div>
       ${groups || `<div class="ff-tl-empty">no income — full drawdown</div>`}`;
    ffWirePhaseDrag(host, pr.sc, span);
  });
}

// Draggable phase bars — same idiom as the gantt's shared bar drag (startBarDrag): drag the
// bar body to shift when the income STARTS, drag the right-edge grip to set when it STOPS
// (drag it past the far right to make it ongoing again). Live-updates the chart as you drag.
function ffWirePhaseDrag(host, sc, span){
  host.querySelectorAll(".phase-tl-bar").forEach(bar=>{
    const rzL = bar.querySelector(".ff-rz-l"), rzR = bar.querySelector(".ff-rz-r");
    bar.addEventListener("mousedown", e=>{ if(e.target===rzL || e.target===rzR) return; startPhaseDrag(e, sc, bar.dataset.ph, "move", span); });
    if(rzL) rzL.addEventListener("mousedown", e=>{ e.stopPropagation(); startPhaseDrag(e, sc, bar.dataset.ph, "resizeL", span); });
    if(rzR) rzR.addEventListener("mousedown", e=>{ e.stopPropagation(); startPhaseDrag(e, sc, bar.dataset.ph, "resizeR", span); });
  });
}
function startPhaseDrag(e, sc, phId, kind, span){
  e.preventDefault();
  const lane = e.target.closest(".ff-tl-lane"); if(!lane) return;
  const pxPerMonth = lane.getBoundingClientRect().width / Math.max(1, span);
  const p = ffPhase(sc, phId); if(!p) return;
  const startX = e.clientX;
  const origStart = +p.startMonth||0;
  const ong = (p.months==null || p.months==="");
  const origDur = ong ? span : Math.max(1, +p.months||0);
  snapState();
  dragging = true;
  document.body.style.userSelect = "none";
  document.body.style.cursor = kind==="resize" ? "ew-resize" : "grabbing";
  const origEnd = origStart + origDur;   // for finite phases; ongoing treats end as the horizon
  let changed = false;
  function move(ev){
    const dM = Math.round((ev.clientX-startX)/pxPerMonth);
    if(kind==="move"){                                   // shift the whole phase, keep its length
      const ns = Math.max(0, origStart+dM);
      if(ns !== (+p.startMonth||0)){ p.startMonth = ns; changed = true; renderFreedomOutput(); }
    } else if(kind==="resizeR"){                          // drag right edge → change when it ENDS
      const newEnd = origStart + Math.max(1, origDur+dM);
      if(newEnd >= span){ if(p.months !== null){ p.months = null; changed = true; renderFreedomOutput(); } }  // past far right → ongoing
      else { const nd = Math.max(1, newEnd-origStart); if(nd !== p.months){ p.months = nd; changed = true; renderFreedomOutput(); } }
    } else {                                              // resizeL: drag left edge → change when it STARTS, keep the end
      const ns = Math.max(0, Math.min(origEnd-1, origStart+dM));
      if(ong){ if(ns !== (+p.startMonth||0)){ p.startMonth = ns; changed = true; renderFreedomOutput(); } }  // ongoing has no fixed end → just move start
      else {
        const nd = Math.max(1, origEnd-ns);
        if(ns !== (+p.startMonth||0) || nd !== p.months){ p.startMonth = ns; p.months = nd; changed = true; renderFreedomOutput(); }
      }
    }
  }
  function up(){
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.body.style.userSelect = ""; document.body.style.cursor = "";
    dragging = false;
    if(changed) renderFreedom();   // rebuild editors so the start/for inputs reflect the drag
  }
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

function renderFreedomChart(projs){
  const svg = document.getElementById("freedomChart");
  if(!svg) return;
  const W=920, H=340, pL=78, pR=16, pT=16, pB=28;
  const fire = state.fire.target||0;
  const horizon = Math.max(...projs.map(p=>p.horizon), 12);
  let maxV = fire*1.06, minV = 0;
  projs.forEach(p=>p.series.forEach(pt=>{ if(pt.v>maxV)maxV=pt.v; if(pt.v<minV)minV=pt.v; }));
  maxV = maxV*1.04 || 1;
  const X = m => pL + (m/horizon)*(W-pL-pR);
  const Y = v => H-pB - ((v-minV)/(maxV-minV))*(H-pT-pB);
  let s = "";
  // y gridlines
  for(let i=0;i<=4;i++){ const v=minV+(maxV-minV)*i/4, y=Y(v);
    s += `<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="var(--line)"/>`;
    s += `<text x="${pL-8}" y="${y+4}" text-anchor="end" fill="var(--faint)" font-size="11">${fmt(v)}</text>`; }
  // x year labels
  const stepY = horizon>180?60:24;
  for(let m=0;m<=horizon;m+=stepY){ s += `<text x="${X(m)}" y="${H-8}" text-anchor="middle" fill="var(--faint)" font-size="11">${START.y+Math.floor((START.m+m)/12)}</text>`; }
  // zero baseline (only if some scenario dips below 0)
  if(minV<0){ const y=Y(0); s += `<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="2 3"/>`; }
  // retire-age marker (all scenarios share age/retAge)
  const retM = projs[0]?projs[0].retMonth:0;
  if(retM>0 && retM<=horizon){ s += `<line x1="${X(retM)}" y1="${pT}" x2="${X(retM)}" y2="${H-pB}" stroke="var(--faint)" stroke-dasharray="3 3"/>`;
    s += `<text x="${X(retM)-4}" y="${pT+11}" text-anchor="end" fill="var(--faint)" font-size="10">age ${state.fire.retireAge}</text>`; }
  // FIRE target line
  s += `<line x1="${pL}" y1="${Y(fire)}" x2="${W-pR}" y2="${Y(fire)}" stroke="${cssVar('var(--amber)')}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<text x="${W-pR-4}" y="${Y(fire)-6}" text-anchor="end" fill="${cssVar('var(--amber)')}" font-size="11">FIRE ${fmt(fire)}</text>`;
  // one line per scenario + a marker at the retire month
  projs.forEach(pr=>{
    const c = cssVar(pr.sc.color);
    s += `<path d="M${pr.series.map(pt=>`${X(pt.m).toFixed(1)},${Y(pt.v).toFixed(1)}`).join(" L")}" fill="none" stroke="${c}" stroke-width="2.4"/>`;
    if(retM>0 && retM<=horizon){ s += `<circle cx="${X(retM)}" cy="${Y(pr.nwAtRet)}" r="4" fill="${c}"/>`; }
    if(pr.dryMonth){ s += `<circle cx="${X(pr.dryMonth)}" cy="${Y(0)}" r="4.5" fill="none" stroke="var(--red)" stroke-width="2"/>`; }
  });
  svg.innerHTML = s;
  const leg = document.getElementById("freedomLegend");
  if(leg) leg.innerHTML = projs.map(pr=>`<span><i style="background:${cssVar(pr.sc.color)}"></i> ${esc(pr.sc.name)}</span>`).join("")
    + `<span style="color:var(--faint)"><i style="background:var(--amber)"></i> FIRE target · ● = net worth at age ${state.fire.retireAge}</span>`;
}

function renderFreedomOutcomes(projs){
  const host = document.getElementById("freedomOutcomes");
  if(!host) return;
  const head = `<div class="ff-row ff-head">
    <div>Scenario</div><div>Retire with</div><div>Coast FIRE</div><div>Full FIRE</div><div>Lowest point</div><div>Verdict</div></div>`;
  const rows = projs.map(pr=>{
    const coast = pr.coastMonth ? ffDate(pr.coastMonth) : "—";
    const full  = pr.fireMonth  ? ffDate(pr.fireMonth)  : "—";
    const low   = fmt(pr.minNW);
    let badge, cls;
    if(pr.dryMonth){ badge = "Runs dry "+ffDate(pr.dryMonth); cls="no"; }
    else if(pr.fireMonth && pr.fireMonth<=pr.retMonth){ badge = "FIRE by retirement"; cls="ok"; }
    else if(pr.coastMonth){ badge = "Coasting"; cls="ok"; }
    else { badge = "Building"; cls="mid"; }
    return `<div class="ff-row">
      <div class="ff-name"><span class="dot" style="background:${cssVar(pr.sc.color)}"></span>${esc(pr.sc.name)}</div>
      <div><b style="color:${cssVar(pr.sc.color)}">${fmt(pr.nwAtRet)}</b><span class="ff-sub2">age ${pr.retAge}</span></div>
      <div>${coast}</div>
      <div>${full}</div>
      <div class="${pr.minNW<0?'ff-neg':''}">${low}</div>
      <div><span class="badge ${cls}">${badge}</span></div>
    </div>`;
  }).join("");
  host.innerHTML = head + rows;
}

function renderFreedomNote(){
  const note = document.getElementById("freedomNote");
  if(!note) return;
  const r = state.fire.returnPct;
  note.innerHTML =
    `<b>How this works:</b> each scenario compounds today's ${fmt(Object.keys(state.assets).reduce((a,w)=>a+sumAssets(w),0)-totalDebt())} net worth at ${r}%/yr, `+
    `adding each month's income (from the phases above) minus your ${fmt(totalExpenses())}/mo expenses, active lifestyle-goal spending, and debt payments. `+
    `When income doesn't cover the outflow, the shortfall is <b>drawn from the portfolio</b> — so a layoff or career break shows up as a dip, and if the line hits $0 the scenario <b>runs dry</b> (red ○). `+
    `Debts are paid down on schedule and stop draining cash once cleared. <b>Retire with</b> = net worth at age ${state.fire.retireAge}; <b>Coast FIRE</b> = the month savings alone would grow to ${fmt(state.fire.target)} by then with no further contributions. `+
    `Today's (real) dollars, one blended real return, taxes ignored — directional, not a guarantee.`;
}
