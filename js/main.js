//============ TOOLTIP ============
(function(){
  const rowsEl=document.getElementById("rows"), tip=document.getElementById("barTip");
  if(rowsEl){
    rowsEl.addEventListener("mousemove",e=>{
      const bar=!dragging&&e.target.closest(".bar[data-key]");
      if(!bar){ tip.style.display="none"; return; }
      const key=bar.dataset.key, g=goalBy(key), track=bar.closest(".track");
      const isDebt=!g&&(state.debts||[]).some(d=>d.id===key);
      if(!g&&!isDebt){ tip.style.display="none"; return; }
      const rect=track.getBoundingClientRect();
      let mi=Math.floor((e.clientX-rect.left)/(rect.width/VIEW_MONTHS));
      mi=Math.max(0,Math.min(VIEW_MONTHS-1,mi));
      const amt=(lastSim&&lastSim.alloc[mi])?(lastSim.alloc[mi][key]||0):0;
      const debt=(state.debts||[]).find(d=>d.id===key);
      const label=g?esc(g.name):debt?esc(debt.name):key;
      const bonusThisMo=bonusAt(mi);
      let body;
      if(debt){
        const ds=lastSim&&lastSim.debtState&&lastSim.debtState[key];
        const curve=ds&&ds.curve;
        const balEntry=curve&&curve.find(p=>p.m===mi+1);
        const balAfter=balEntry?balEntry.bal:(ds?ds.bal:null);
        const minPmt=debt?debtMonthly(debt):0;
        const extra=amt>0?amt:0;
        body=`<b>${fmt(minPmt)}</b>/mo minimum <span class="sub2">(paid via expenses — already out of your surplus)</span>`
          +(extra>0?`<br><b>${fmt(extra)}</b> extra paydown from surplus`:"")
          +(balAfter!=null?`<br><span class="sub2">balance after: ${fmt(balAfter)}</span>`:"");
      } else {
        const dlMissTip=g&&g.deadline!=null&&((lastSim.deadlineBal&&lastSim.deadlineBal[key])||0)<targetAt(g,g.deadline)-0.01;
        const dlShortTip=dlMissTip?Math.ceil(targetAt(g,g.deadline)-((lastSim.deadlineBal&&lastSim.deadlineBal[key])||0)):0;
        const totalAvail=surplusAt(mi);
        const bonusSrcs=bonusThisMo>0?state.income.filter(s=>(s.bonuses||[]).some(x=>{const start=+x.month,rep=+x.repeat||0;return mi===start||(rep>0&&mi>start&&(mi-start)%rep===0);})):[];
        const bonusDesc=bonusSrcs.map(s=>s.name+(+s.bonuses[0].repeat>0?" (recurring)":"")).join(", ");
        const surplusLine=bonusThisMo>0
          ?`<span class="sub2">${fmt(baseIncome()-totalExpenses())} base + ${fmt(bonusThisMo)} bonus${bonusDesc?` (${bonusDesc})`:""} = <b>${fmt(totalAvail)}</b> available this month</span>`
          :`<span class="sub2">${fmt(totalAvail)} available this month</span>`;
        body=(amt>0?`<b>${fmt(amt)}</b> invested this month`:`<span class="sub2">no contribution this month</span>`)
          +(dlMissTip?`<br><span style="color:#fbbf24;font-weight:600">⚠ ${fmt(dlShortTip)} short by ${monthLabel(g.deadline)}</span>`:"")
          +`<br>${surplusLine}`;
      }
      tip.innerHTML=`<div class="h">${label} · ${monthLabel(mi)}</div>`+body;
      tip.style.display="block";
      const flip=e.clientX>window.innerWidth-200;
      tip.style.left=(flip?e.clientX-tip.offsetWidth-14:e.clientX+14)+"px";
      tip.style.top=(e.clientY+14)+"px";
    });
    rowsEl.addEventListener("mouseleave",()=>{ tip.style.display="none"; });
  }
})();

//============ INIT ============
function syncNWInputs(){
  document.getElementById("nwReturn").value=state.fire.returnPct;
  document.getElementById("nwRetAge").value=state.fire.retireAge;
  document.getElementById("nwFire").value=state.fire.target;
}
loadState();
normalize();
syncNWInputs();

["nwReturn","nwRetAge","nwFire"].forEach(id=>document.getElementById(id).addEventListener("input",e=>{
  const map={nwReturn:"returnPct",nwRetAge:"retireAge",nwFire:"target"};
  state.fire[map[id]]=Math.round(+e.target.value||0);
  renderNW(); renderFireImpact(); renderFreedomOutput();
}));

// ── Freedom explorer controls ──
ensureFreedom();
const fhInput=document.getElementById("freedomHorizon");
if(fhInput){
  fhInput.value=state.freedom.horizonYears;
  fhInput.addEventListener("input",e=>{
    state.freedom.horizonYears=Math.max(5,Math.round(+e.target.value||0));
    renderFreedomOutput();
  });
}
const addScBtn=document.getElementById("addScenarioBtn");
if(addScBtn) addScBtn.addEventListener("click",()=>{
  snapState();
  const f=state.freedom;
  const sc=ffCurrentPlanScenario();
  sc.name="Scenario "+(f.scenarios.length+1);
  sc.color=FF_SC_COLORS[f.scenarios.length % FF_SC_COLORS.length];
  f.scenarios.push(sc);
  renderFreedom();
});

document.querySelectorAll(".btn[data-mode]").forEach(b=>b.classList.toggle("active", b.dataset.mode===state.mode));
document.querySelectorAll(".btn[data-mode]").forEach(b=>{
  b.addEventListener("click",()=>{
    document.querySelectorAll(".btn[data-mode]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); state.mode=b.dataset.mode; renderInputs(); renderAll();
  });
});

document.getElementById("resetBtn").addEventListener("click",()=>{
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} location.reload();
});

document.getElementById("undoBtn").addEventListener("click", undoGoals);
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="z" && !/INPUT|TEXTAREA/.test(e.target.tagName)){
    e.preventDefault(); undoGoals();
  }
});

initSetupToggle();
document.getElementById("sankeyPrev").addEventListener("click",()=>{
  if(sankeyMonth>0){ sankeyMonth--; if(lastSim) renderSankey(lastSim.alloc[sankeyMonth]||{}, sankeyMonth); }
});
document.getElementById("sankeyNext").addEventListener("click",()=>{
  if(sankeyMonth<VIEW_MONTHS-1){ sankeyMonth++; if(lastSim) renderSankey(lastSim.alloc[sankeyMonth]||{}, sankeyMonth); }
});
renderSetup();
renderHeaderStats();
renderSankeyNote();
renderFire();
renderAll();
renderInputs();
renderDebts();
renderAssets();
renderNW();
renderFireImpact();
renderFreedom();
