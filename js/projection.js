//============ FIRE ============
function renderFire(){} // fireYears stat updated by renderNW() using the projection result


//============ NET WORTH & FIRE ============
function renderAssets(){
  const box=document.getElementById("assetsBox"); box.innerHTML="";
  const personColors=["var(--blue)","var(--indigo)","var(--violet)","var(--pink)","var(--sky)","var(--amber)"];
  const dotFor=i=>personColors[Math.min(i,personColors.length-1)];
  state.people.forEach((who,wi)=>{
    const col=document.createElement("div"); col.className="asset-col";
    const rows=(state.assets[who]||[]).map(([n,v])=>`<div class="arow"><span>${esc(n)}</span><span>${fmt(+v||0)}</span></div>`).join("");
    col.innerHTML=`<h3><span class="dot" style="background:${cssVar(dotFor(wi))}"></span>${esc(who)}</h3>${rows}
      <div class="asub"><span>Subtotal</span><span>${fmt(sumAssets(who))}</span></div>`;
    box.appendChild(col);
  });
  const nwt=netWorthToday();
  const totalAssets=Object.keys(state.assets).reduce((a,w)=>a+sumAssets(w),0);
  const bar=document.createElement("div"); bar.className="nwbar";
  bar.innerHTML=`
    <div><div class="lbl">Net worth today</div><div class="big" style="color:var(--green)">${fmt(nwt)}</div></div>
    <div class="pc">${fmt(totalAssets)} assets − ${fmt(totalDebt())} debt.</div>`;
  box.appendChild(bar);
}

function renderNW(){
  const r=(state.fire.returnPct||0)/100;
  const age=primaryAge()||0;
  const retAge=state.fire.retireAge||65;
  const fire=state.fire.target||0;
  const nwToday=netWorthToday();
  const sim=simulate();
  const lifeSpend = mi => LIFESTYLE().reduce((a,id)=>{
    const g=goalBy(id); if(!g) return a;
    const s=sim.start[id], e=sim.end[id];
    return a+((s!==undefined&&mi>=s&&(e===undefined||mi<=e))?(g.monthly||0):0);
  },0);
  const yearsToRet=Math.max(1,retAge-age);
  const horizon=Math.min(480,Math.max(yearsToRet+2,12)*12);
  const withC=[{m:0,v:nwToday}], coast=[{m:0,v:nwToday}];
  let nw=nwToday, cn=nwToday, fireMonth=null, retired=false;
  const draw=fire*0.04/12;
  for(let mi=0;mi<horizon;mi++){
    let contrib;
    if(!retired && nw<fire){ contrib=Math.max(0, surplusAt(mi) - lifeSpend(mi)); }
    else { retired=true; contrib=-draw; }
    nw=nw*(1+r/12)+contrib;
    cn=cn*(1+r/12);
    if(fireMonth===null && nw>=fire) fireMonth=mi+1;
    if((mi+1)%3===0||mi===horizon-1){ withC.push({m:mi+1,v:nw}); coast.push({m:mi+1,v:cn}); }
  }
  const coastTarget=fire/Math.pow(1+r,yearsToRet);
  const coastOK=nwToday>=coastTarget;
  const coastAtRet=nwToday*Math.pow(1+r,yearsToRet);
  const fmtDate=m=>new Date(2026,6+m,1).toLocaleString("en-US",{month:"short",year:"numeric"});
  const fyEl=document.getElementById("fireYears");
  if(fyEl) fyEl.textContent=fireMonth?(fireMonth/12).toFixed(1)+" yr":">"+(horizon/12)+"yr";
  document.getElementById("nwStats").innerHTML=`
    <div class="stat"><div class="k">Net worth today</div><div class="v sm">${fmt(nwToday)}</div></div>
    <div class="stat"><div class="k">Coast FIRE number (today)</div><div class="v sm">${fmt(coastTarget)}</div>
      <div class="k" style="margin-top:3px">${coastOK?`<span class="badge ok">✓ achieved</span> +${fmt(nwToday-coastTarget)}`:`<span class="badge no">not yet</span> need ${fmt(coastTarget-nwToday)}`}</div></div>
    <div class="stat"><div class="k">Coast value at age ${retAge}</div><div class="v sm" style="color:var(--blue)">${fmt(coastAtRet)}</div><div class="k" style="margin-top:3px">today's assets alone, no new $</div></div>
    <div class="stat"><div class="k">Full FIRE (${fmt(fire)})</div><div class="v sm" style="color:var(--green)">${fireMonth?fmtDate(fireMonth):">"+(horizon/12)+"yr"}</div>${fireMonth?`<div class="k" style="margin-top:3px">in ${(fireMonth/12).toFixed(1)} yrs · age ${Math.round(age+fireMonth/12)}</div>`:""}</div>`;
  renderNWChart(withC, coast, fire, fireMonth, yearsToRet, retAge, horizon);
  document.getElementById("nwLegend").innerHTML=`
    <span><i style="background:var(--green)"></i> Net worth — saving the plan, then 4% drawdown after FIRE</span>
    <span><i style="background:var(--blue)"></i> Coast — today's assets, zero new contributions</span>
    <span><i style="background:var(--amber)"></i> FIRE target ${fmt(fire)}</span>`;
  persist();
}

function renderNWChart(withC, coast, fire, fireMonth, yearsToRet, retAge, horizon){
  const W=920,H=320,pL=64,pR=16,pT=14,pB=30;
  const maxM=horizon;
  const maxV=Math.max(fire, withC[withC.length-1].v, coast[coast.length-1].v)*1.06;
  const X=m=>pL+(m/maxM)*(W-pL-pR);
  const Y=v=>H-pB-(v/maxV)*(H-pT-pB);
  let s="";
  for(let i=0;i<=4;i++){const v=maxV*i/4,y=Y(v);
    s+=`<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="var(--line)"/>`;
    s+=`<text x="${pL-8}" y="${y+4}" text-anchor="end" fill="var(--faint)" font-size="11">${fmt(v)}</text>`;}
  const stepY=maxM>180?60:24;
  for(let m=0;m<=maxM;m+=stepY){ s+=`<text x="${X(m)}" y="${H-9}" text-anchor="middle" fill="var(--faint)" font-size="11">${2026+Math.floor((6+m)/12)}</text>`;}
  const retM=yearsToRet*12;
  if(retM<=maxM){ s+=`<line x1="${X(retM)}" y1="${pT}" x2="${X(retM)}" y2="${H-pB}" stroke="var(--faint)" stroke-dasharray="3 3"/>`;
    s+=`<text x="${X(retM)-4}" y="${pT+10}" text-anchor="end" fill="var(--faint)" font-size="10">age ${retAge}</text>`;}
  s+=`<line x1="${pL}" y1="${Y(fire)}" x2="${W-pR}" y2="${Y(fire)}" stroke="${cssVar('var(--amber)')}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s+=`<text x="${W-pR-4}" y="${Y(fire)-6}" text-anchor="end" fill="${cssVar('var(--amber)')}" font-size="11">FIRE ${fmt(fire)}</text>`;
  s+=`<path d="M${coast.map(p=>`${X(p.m).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" L")}" fill="none" stroke="${cssVar('var(--blue)')}" stroke-width="2" stroke-dasharray="6 4"/>`;
  s+=`<path d="M${withC.map(p=>`${X(p.m).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" L")}" fill="none" stroke="${cssVar('var(--green)')}" stroke-width="2.5"/>`;
  if(fireMonth){const cx=X(fireMonth),cy=Y(fire);
    s+=`<circle cx="${cx}" cy="${cy}" r="5" fill="${cssVar('var(--green)')}"/>`;
    s+=`<text x="${cx+7}" y="${cy+15}" fill="var(--txt)" font-size="11">FIRE ${2026+Math.floor((6+fireMonth)/12)}</text>`;}
  document.getElementById("nwChart").innerHTML=s;
}

//============ FIRE IMPACT ANALYSIS ============
// Run any scenario through the SAME net-worth projection as renderNW, returning the month
// FIRE and Coast FIRE are reached. Reads global `state`, so callers mutate a temp clone.
function fireProjection(){
  const r=(state.fire.returnPct||0)/100;
  const age=primaryAge()||0, retAge=state.fire.retireAge||65;
  const fire=state.fire.target||0;
  const nwToday=netWorthToday();
  const sim=simulate();
  const lifeSpend = mi => LIFESTYLE().reduce((a,id)=>{
    const g=goalBy(id); if(!g) return a;
    const s=sim.start[id], e=sim.end[id];
    return a+((s!==undefined&&mi>=s&&(e===undefined||mi<=e))?(g.monthly||0):0);
  },0);
  const yearsToRet=Math.max(1,retAge-age);
  const horizon=Math.min(480,Math.max(yearsToRet+2,12)*12);
  const coastTargetToday=fire/Math.pow(1+r,yearsToRet);
  let nw=nwToday, fireMonth=null, coastMonth=null, retired=false;
  const draw=fire*0.04/12;
  for(let mi=0;mi<horizon;mi++){
    let contrib;
    if(!retired && nw<fire){ contrib=Math.max(0, surplusAt(mi) - lifeSpend(mi)); }
    else { retired=true; contrib=-draw; }
    nw=nw*(1+r/12)+contrib;
    // coast threshold falls each month as fewer years remain for the market to do the work
    const yearsRemain=Math.max(0, yearsToRet-(mi+1)/12);
    const coastNeed=fire/Math.pow(1+r, yearsRemain);
    if(coastMonth===null && nw>=coastNeed) coastMonth=mi+1;
    if(fireMonth===null && nw>=fire) fireMonth=mi+1;
    if(fireMonth!==null && coastMonth!==null) break;
  }
  return {fireMonth, coastMonth, horizon, nwToday, coastOKToday:nwToday>=coastTargetToday};
}
// evaluate fireProjection() against a temporarily mutated copy of state, then restore
function withTempState(mutator, fn){
  const saved=structuredClone(state);
  try{ mutator(); return fn(); } finally{ state=saved; }
}
const projWithoutGoal = id => withTempState(()=>{
  state.goals=state.goals.filter(g=>g.id!==id);
  state.priority=(state.priority||[]).filter(x=>x!==id);
}, fireProjection);
const projWithCut = cut => withTempState(()=>{
  state.expenses=state.expenses.concat([{id:"__cut",name:"trim",amount:-cut,cat:"fixed"}]);
}, fireProjection);

const moDur = m => m==null?"—":(m>=18?(m/12).toFixed(1)+" yrs":Math.round(m)+" mo");
const moDays = m => Math.round(Math.max(0,m)*30.44).toLocaleString();

function renderFireImpact(){
  if(!document.getElementById("goalImpactRows")) return;
  const base=fireProjection();
  const H=base.horizon;
  const baseFire=base.fireMonth ?? H, baseCoast=base.coastMonth ?? H;
  const r=(state.fire.returnPct||0)/100;
  const fmtDate=m=>new Date(2026,6+Math.round(m),1).toLocaleString("en-US",{month:"short",year:"numeric"});

  // ── 1) each lifestyle goal's drag on FIRE (remove it → see how much sooner FIRE lands) ──
  const lifeGoals=state.goals.filter(g=>g.kind==="lifestyle");
  const rows=lifeGoals.map(g=>{
    const w=projWithoutGoal(g.id);
    return { g, spent:targetAt(g,VIEW_MONTHS),
      fireDelay:Math.max(0, baseFire-(w.fireMonth ?? H)),
      coastDelay:Math.max(0, baseCoast-(w.coastMonth ?? H)) };
  }).sort((a,b)=>b.fireDelay-a.fireDelay);
  const maxDelay=Math.max(0.001,...rows.map(r=>r.fireDelay));
  const ib=document.getElementById("goalImpactRows");
  ib.innerHTML = rows.length ? rows.map((r,i)=>{
    const w=r.fireDelay>0?Math.max(3,(r.fireDelay/maxDelay)*100):0;
    const dtxt=r.fireDelay>=0.5?`+${moDur(r.fireDelay)}`:"~none";
    const coastTxt=r.coastDelay>=0.5?` · Coast +${moDur(r.coastDelay)}`:"";
    return `<div class="impact-row${i===0?" first":""}">
      <div class="rl2"><span class="dot" style="background:${cssVar(r.g.color)}"></span>${esc(r.g.name)}</div>
      <div class="impact-bar-wrap"><div class="impact-bar" style="width:${w}%;background:${cssVar(r.g.color)}">${r.fireDelay>=1?dtxt+" · "+moDays(r.fireDelay)+" days":""}</div></div>
      <div class="rr2">${fmt(r.spent)} spent → FIRE <b>${dtxt}</b> later${coastTxt}</div>
    </div>`;
  }).join("") : `<p class="sub" style="margin:0">No spending goals yet — add a lifestyle goal in Setup to see its FIRE cost.</p>`;
  const acct=state.goals.filter(g=>g.kind==="account").length;
  document.getElementById("goalImpactNote").innerHTML =
    `<span>Each bar = how much sooner FIRE would arrive if that goal's cash stayed invested instead. `+
    (acct?`Your ${acct} account goal${acct>1?"s":""} (TFSA/RRSP) <b>are</b> your FIRE money — funding them builds toward FIRE, so they aren't shown as drag.`:"")+`</span>`;

  // ── 2) expense-trim explorer: sweep cuts, plot months-to-FIRE / months-to-Coast ──
  const guilt=state.expenses.filter(e=>e.cat==="guilt").reduce((a,e)=>a+(+e.amount||0),0);
  const maxCut=Math.max(250, Math.min(totalExpenses(), Math.ceil(Math.max(guilt*1.5,1000)/250)*250));
  const N=20;
  const series=[];
  for(let i=0;i<=N;i++){
    const cut=Math.round((maxCut*i/N)/50)*50;
    const p=cut===0?base:projWithCut(cut);
    series.push({cut, fire:(p.fireMonth ?? H), coast:(p.coastMonth ?? H)});
  }
  const W=920,Hc=300,pL=58,pR=124,pT=16,pB=30;
  const maxY=Math.max(1, series[0].fire, series[0].coast);
  const X=c=>pL+(Math.min(c,maxCut)/maxCut)*(W-pL-pR);
  const Y=m=>Hc-pB-(Math.min(m,maxY)/maxY)*(Hc-pT-pB);
  let s="";
  for(let i=0;i<=4;i++){ const v=maxY*i/4, y=Y(v);
    s+=`<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="var(--line)"/>`;
    s+=`<text x="${pL-8}" y="${y+4}" text-anchor="end" fill="var(--faint)" font-size="11">${(v/12).toFixed(v/12>=10?0:1)}y</text>`; }
  for(let i=0;i<=4;i++){ const c=maxCut*i/4;
    s+=`<text x="${X(c)}" y="${Hc-9}" text-anchor="middle" fill="var(--faint)" font-size="11">$${Math.round(c).toLocaleString()}</text>`; }
  const linePath = key => `M${series.map(p=>`${X(p.cut).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" L")}`;
  s+=`<path d="${linePath("coast")}" fill="none" stroke="${cssVar('var(--blue)')}" stroke-width="2" stroke-dasharray="6 4"/>`;
  s+=`<path d="${linePath("fire")}" fill="none" stroke="${cssVar('var(--green)')}" stroke-width="2.5"/>`;
  // movable marker (updated live by the slider)
  s+=`<line id="expMark" x1="${X(0)}" y1="${pT}" x2="${X(0)}" y2="${Hc-pB}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  s+=`<circle id="expFireDot" cx="${X(0)}" cy="${Y(series[0].fire)}" r="5" fill="${cssVar('var(--green)')}"/>`;
  s+=`<circle id="expCoastDot" cx="${X(0)}" cy="${Y(series[0].coast)}" r="4.5" fill="${cssVar('var(--blue)')}"/>`;
  document.getElementById("expFireChart").innerHTML=s;
  document.getElementById("expFireLegend").innerHTML=
    `<span><i style="background:var(--green)"></i> Years to Full FIRE</span>
     <span><i style="background:var(--blue)"></i> Years to Coast FIRE</span>
     <span style="color:var(--faint)">X axis = $/mo trimmed from spending</span>`;

  const slider=document.getElementById("expCutSlider");
  slider.max=maxCut; slider.step=50; slider.value=0;
  function updateExp(cut){
    cut=Math.max(0,Math.min(maxCut,Math.round(cut/50)*50));
    document.getElementById("expCutLbl").textContent=`$${cut.toLocaleString()}/mo`;
    const p=cut===0?base:projWithCut(cut);
    const f=p.fireMonth ?? H, c=p.coastMonth ?? H;
    const fSooner=Math.max(0,baseFire-f), cSooner=Math.max(0,baseCoast-c);
    const fireV = base.fireMonth==null && cut===0 ? `>${(H/12).toFixed(0)} yrs` : fmtDate(f);
    const coastShown = p.coastOKToday ? "already coasting" : fmtDate(c);
    document.getElementById("expReadout").innerHTML=`
      <div class="blk"><div class="k">Trimming</div><div class="v">$${cut.toLocaleString()}/mo</div>
        <div class="s">${fmt(cut*12)}/yr redirected to investing</div></div>
      <div class="blk"><div class="k">Full FIRE</div><div class="v" style="color:var(--green)">${fireV}</div>
        <div class="s">${cut===0?`baseline (${(f/12).toFixed(1)} yrs)`:(fSooner>=0.5?`▲ ${moDays(fSooner)} days sooner (${moDur(fSooner)})`:"no change")}</div></div>
      <div class="blk"><div class="k">Coast FIRE</div><div class="v" style="color:var(--blue)">${coastShown}</div>
        <div class="s">${p.coastOKToday?"today's assets already coast":(cut===0?`baseline (${(c/12).toFixed(1)} yrs)`:(cSooner>=0.5?`▲ ${moDays(cSooner)} days sooner (${moDur(cSooner)})`:"no change"))}</div></div>`;
    const mk=document.getElementById("expMark"), fd=document.getElementById("expFireDot"), cd=document.getElementById("expCoastDot");
    if(mk){ mk.setAttribute("x1",X(cut)); mk.setAttribute("x2",X(cut)); }
    if(fd){ fd.setAttribute("cx",X(cut)); fd.setAttribute("cy",Y(f)); }
    if(cd){ cd.setAttribute("cx",X(cut)); cd.setAttribute("cy",Y(c)); }
  }
  slider.oninput=e=>updateExp(+e.target.value||0);
  updateExp(0);

  document.getElementById("fireImpactNote").innerHTML=
    `<b>How this works:</b> each scenario re-runs the full net-worth projection — today's ${fmt(netWorthToday())} compounding at ${state.fire.returnPct}%/yr plus your monthly contributions. <b>Goal drag</b> is the FIRE date with a goal funded minus the date if you skipped it. <b>Expense trim</b> assumes every dollar you stop spending goes straight to investing (and fills active goals faster along the way). <b>Coast FIRE</b> = the month your invested assets get large enough to drift to ${fmt(state.fire.target)} by age ${state.fire.retireAge} with zero further contributions. Estimates ignore taxes and assume a steady return — directional, not a guarantee.`;
}

