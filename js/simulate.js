//============ SIMULATION ============
const SIM_MONTHS = 600;   // long horizon so even low-priority debts reach payoff in the projection

function simulate(){
  const bal={}, start={}, end={}, alloc0={}, alloc=[], deadlineBal={};
  state.goals.forEach(g=>bal[g.id]=0);
  // per-debt running state: balance accrues interest + minimum payment each month,
  // then absorbs priority-ordered surplus (extra principal) and any scheduled dumps.
  const debtState={};
  (state.debts||[]).forEach(d=>{
    debtState[d.id] = { bal:+d.balance||0, interest:0, payoff:null,
      rm:(+d.rate||0)/12, pm:debtMonthly(d), curve:[{m:0,bal:+d.balance||0}] };
  });
  // priority order, every mode. Waterfall = no caps. Otherwise lifestyle goals capped at
  // their monthly $, accounts + debts absorb whatever's left — strictly in priority order.
  const order = orderedItems().map(it=>{
    if(it.type==="goal"){
      const g=it.obj, wf=state.mode==="waterfall";
      // every goal can be paced by a monthly cap: lifestyle uses its `monthly`; an account
      // uses `monthly` too when set (>0), otherwise it absorbs whatever's left.
      const cap = wf ? Infinity : (g.monthly>0 ? g.monthly : Infinity);
      const start = g.startMo||0;
      return {type:"goal", g, cap, start};
    }
    // debts absorb surplus up to their optional monthly extra-payment cap (default: unlimited)
    return {type:"debt", id:it.id, cap:(it.obj.extra==null?Infinity:Math.max(0,+it.obj.extra||0))};
  });

  for(let mi=0; mi<SIM_MONTHS; mi++){
    let avail = Math.max(0, surplusAt(mi));
    const a = {}; alloc[mi] = a;
    // 1) advance every debt: interest + minimum payment, then one-time scheduled dumps.
    //    The minimum payment is funded from expenses (e.g. "Car Payment") which already reduced
    //    surplusAt() — it does NOT come out of avail here a second time.
    (state.debts||[]).forEach(d=>{
      const ds=debtState[d.id]; if(ds.bal<=0.01) return;
      const intr=ds.bal*ds.rm; ds.interest+=intr; ds.bal=Math.max(0, ds.bal+intr-ds.pm);
      (d.dumps||[]).forEach(x=>{
        if(+x.month!==mi) return;
        const amt=+x.amount||0;
        if(x.fromSavings){ ds.bal=Math.max(0, ds.bal-amt); }                 // from existing cash — no surplus draw
        else { const c=Math.min(amt, avail, ds.bal); ds.bal-=c; avail-=c;     // surplus-funded one-time dump
          a[d.id]=(a[d.id]||0)+c; if(mi===0) alloc0[d.id]=(alloc0[d.id]||0)+c; }
      });
    });
    // 2) route remaining surplus across goals + debts in priority order
    for(const it of order){
      if(avail<=0) break;
      if(it.type==="goal"){
        const g=it.g;
        if(mi < (it.start||0)) continue;
        const tgt=targetAt(g, mi);
        if(bal[g.id] >= tgt-0.01) continue;
        const c=Math.min(it.cap, tgt-bal[g.id], avail); if(c<=0) continue;
        if(start[g.id]===undefined) start[g.id]=mi;
        if(mi===0) alloc0[g.id]=(alloc0[g.id]||0)+c;
        a[g.id]=(a[g.id]||0)+c; bal[g.id]+=c; avail-=c;
      } else {
        const ds=debtState[it.id]; if(!ds || ds.bal<=0.01) continue;
        const c=Math.min(avail, it.cap, ds.bal); if(c<=0) continue;   // it.cap = monthly extra-payment cap
        ds.bal-=c; avail-=c;
        a[it.id]=(a[it.id]||0)+c; if(mi===0) alloc0[it.id]=(alloc0[it.id]||0)+c;
      }
    }
    // 3) record debt curve + payoff month
    (state.debts||[]).forEach(d=>{ const ds=debtState[d.id];
      ds.curve.push({m:mi+1, bal:ds.bal}); if(ds.bal<=0.01 && ds.payoff===null) ds.payoff=mi+1; });
    // 4) record goal completion against this month's (possibly grown) target
    for(const g of state.goals){
      const tgt=targetAt(g,mi);
      if(bal[g.id]>=tgt-0.01){ if(end[g.id]===undefined) end[g.id]=mi; }
      else { end[g.id]=undefined; }
      if(g.deadline!=null && mi===g.deadline-1) deadlineBal[g.id]=bal[g.id]||0;
    }
  }
  return {start, end, alloc0, bal, alloc, debtState, deadlineBal};
}
let lastSim = null;
let dragging = false;
let sankeyMonth = 0;

