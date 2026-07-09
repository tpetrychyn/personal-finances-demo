//============ GANTT ============
function labelFor(mode){
  if(mode==="waterfall") return "One goal at a time, in priority order (amounts fixed)";
  if(mode==="custom") return "Monthly $ &amp; start month per lifestyle goal · accounts absorb the rest, in cascade order below";
  const cascade=INVEST_ORDER().map(k=>goalBy(k)?.name).filter(Boolean).join(" → ");
  return "Monthly $ per lifestyle goal · accounts absorb the rest"+(cascade?` (${cascade})`:"");
}

function renderInputs(){
  const box=document.getElementById("inputs"); box.innerHTML="";
  document.getElementById("inputsLabel").innerHTML = labelFor(state.mode);
  const netSurplus=Math.max(0,baseIncome()-totalExpenses()-totalDebtMinimums());
  if(state.mode==="custom"){
    let budgetLeft=netSurplus;
    LIFESTYLE().forEach(id=>{
      const g=goalBy(id); if(!g) return;
      const maxMo=budgetLeft;
      const actualStart=lastSim&&lastSim.start[id]!=null?lastSim.start[id]:null;
      const displayMo=Math.max(g.startMo||0, actualStart??0);
      const hintTxt=monthLabel(displayMo);
      const d=document.createElement("div"); d.className="inp";
      d.innerHTML=`<label><span class="dot" style="background:${cssVar(g.color)}"></span>${esc(g.name)}</label>
        <div class="inrow">
          <input type="number" step="1" min="0" max="${maxMo}" value="${g.monthly||0}" data-key="${id}" data-f="m" title="monthly $ (max ${fmt(maxMo)} after higher-priority goals)">
          <span class="x">@</span>
          <input class="mo" type="month" min="${monthInputValue(actualStart??0)}" max="${monthInputValue(VIEW_MONTHS)}" value="${monthInputValue(displayMo)}" data-key="${id}" data-f="s" title="start month">
          <span class="hint">${hintTxt}</span>
        </div>`;
      budgetLeft=Math.max(0,budgetLeft-(g.monthly||0));
      box.appendChild(d);
    });
    const casc=document.createElement("div"); casc.className="inp cascade";
    casc.innerHTML=`<label>Then leftover cascades →</label>
      <div class="cascrow">${INVEST_ORDER().map((k,i)=>{const g=goalBy(k);if(!g)return""; return `<span class="chip"><span class="dot" style="background:${cssVar(g.color)}"></span>${esc(g.name)}</span>${i<INVEST_ORDER().length-1?'<span class="arr">→</span>':''}`}).join("")}</div>`;
    box.appendChild(casc);
    box.querySelectorAll("input").forEach(inp=>{
      inp.addEventListener("focus", ()=>snapState());
      inp.addEventListener(inp.dataset.f==="s" ? "change" : "input", e=>{
        const id=e.target.dataset.key, g=goalBy(id); if(!g) return;
        if(e.target.dataset.f==="m"){
          const v=Math.round(+e.target.value||0), max=+e.target.max||0;
          g.monthly=Math.min(v,max); e.target.value=g.monthly;
        } else {
          const minMo=offsetFromMonthInput(e.target.min);
          g.startMo=Math.max(minMo,Math.min(offsetFromMonthInput(e.target.value),VIEW_MONTHS));
          e.target.value=monthInputValue(g.startMo);
          e.target.parentElement.querySelector(".hint").textContent=monthLabel(g.startMo);
        }
        renderAll();
      });
    });
  } else {
    let budgetLeft=netSurplus;
    LIFESTYLE().forEach(id=>{
      const g=goalBy(id); if(!g) return;
      const maxMo=budgetLeft;
      const d=document.createElement("div"); d.className="inp";
      d.innerHTML=`<label><span class="dot" style="background:${cssVar(g.color)}"></span>${esc(g.name)}</label>
        <input type="number" step="1" min="0" max="${maxMo}" value="${g.monthly||0}" data-key="${id}" ${state.mode==="waterfall"?"disabled":""}>`;
      budgetLeft=Math.max(0,budgetLeft-(g.monthly||0));
      box.appendChild(d);
    });
    box.querySelectorAll("input").forEach(inp=>{
      inp.addEventListener("focus",()=>snapState());
      inp.addEventListener("input",e=>{
        const g=goalBy(e.target.dataset.key); if(!g) return;
        const v=Math.round(+e.target.value||0), max=+e.target.max||0;
        g.monthly=Math.min(v,max); e.target.value=g.monthly; renderAll();
      });
    });
  }
}

// shared bar drag for EVERY funding item: move = shift start month (goals);
// resize = change pace (lifestyle/account monthly $, or a debt's monthly extra payment).
function startBarDrag(e, key, kind){
  e.preventDefault();
  const track=e.target.closest(".track");
  const pxPerMonth=track.getBoundingClientRect().width/VIEW_MONTHS;
  const g=goalBy(key), d=debtBy(key);
  if(!g && !d) return;
  const startX=e.clientX;
  snapState();
  dragging=true;
  document.body.style.userSelect="none";
  document.body.style.cursor=kind==="resize"?"ew-resize":"grabbing";
  let changed=false;
  const liveUpdate=()=>{ changed=true; renderGantt(simulate()); renderInputs(); };
  // current bar width (months) as the resize baseline — taken from the last simulation so it
  // matches what's drawn, whatever the item type.
  const origStart = g ? (g.startMo||0) : 0;
  let origDur;
  if(g){
    const tgt=Math.max(1, targetAt(g, VIEW_MONTHS));
    origDur = (g.monthly>0) ? Math.max(1, Math.round(tgt/g.monthly))
      : (lastSim && lastSim.start[key]!=null && lastSim.end[key]!=null ? Math.max(1, lastSim.end[key]-lastSim.start[key]+1) : VIEW_MONTHS);
  } else {
    origDur = Math.max(1, (lastSim && lastSim.debtState && lastSim.debtState[key] && lastSim.debtState[key].payoff) || VIEW_MONTHS);
  }
  function move(ev){
    const dM=Math.round((ev.clientX-startX)/pxPerMonth);
    if(kind==="move" && g){
      const ns=Math.max(0,Math.min(VIEW_MONTHS-1,origStart+dM));
      if(ns!==g.startMo){ g.startMo=ns; liveUpdate(); }
    } else if(kind==="resize"){
      const newDur=Math.max(1, origDur+dM);
      if(g){
        const tgt=Math.max(1, targetAt(g, VIEW_MONTHS));
        const nm=Math.min(Math.round(tgt/newDur), Math.max(0,baseIncome()-totalExpenses()-totalDebtMinimums()));
        if(nm!==g.monthly){ g.monthly=nm; liveUpdate(); }
      } else {
        const ex=Math.min(extraForDuration(d, newDur), Math.max(0,baseIncome()-totalExpenses()-totalDebtMinimums()));
        if(ex!==d.extra){ d.extra=ex; liveUpdate(); }
      }
    }
  }
  function up(){
    document.removeEventListener("mousemove",move);
    document.removeEventListener("mouseup",up);
    document.body.style.userSelect=""; document.body.style.cursor="";
    dragging=false;
    if(changed){ renderAll(); renderNW(); renderDebts(); renderFireImpact(); }
  }
  document.addEventListener("mousemove",move);
  document.addEventListener("mouseup",up);
}

function renderGantt(sim){
  lastSim = sim;
  const {start,end,bal}=sim;
  const total=VIEW_MONTHS;
  const pct=i=>Math.min(100,(i/total)*100);
  const axis=document.getElementById("axis"); axis.innerHTML="";
  for(let i=0;i<=total;i+=2){
    const sp=document.createElement("span"); sp.style.left=pct(i)+"%"; sp.textContent=monthLabel(i); axis.appendChild(sp);
  }
  const gl=document.getElementById("gridlines"); gl.innerHTML="";
  for(let i=0;i<=total;i++){
    const ln=document.createElement("i"); ln.style.left=pct(i)+"%"; if(i%6===0)ln.className="q"; gl.appendChild(ln);
  }
  state.goals.filter(g=>g.deadline!=null).forEach(g=>{
    const d=document.createElement("div"); d.className="deadline";
    d.style.left=pct(g.deadline)+"%"; d.style.background=cssVar(g.color);
    d.title=`${g.name} deadline — ${monthLabel(g.deadline)}`; gl.appendChild(d);
  });

  const rows=document.getElementById("rows"); rows.innerHTML="";
  const custom = state.mode==="custom";
  // ── shared bar-row component used by EVERY funding item (lifestyle, account, debt) ──
  const addRow = o => {
    const row=document.createElement("div"); row.className="row"; row.dataset.key=o.id;
    row.innerHTML=`
      <div class="rl"><span class="gl-grip" draggable="true" title="Drag to reprioritize">⠿</span><span class="dot" style="background:${cssVar(o.color)}"></span>
        <div>${esc(o.name)}<br><small>${o.sub}</small></div></div>
      <div class="track">
        <div class="bar ${o.arrow?'arrow':''} ${o.canMove?'draggable':''} ${(o.canResize&&!o.canMove)?'resizebody':''}" data-key="${o.id}" style="left:${o.left}%;width:${o.width}%;background:${o.barColor};${o.barTextColor?'color:'+o.barTextColor:''}">
          ${o.barText||""}${o.canResize?'<div class="rz" data-key="'+o.id+'"></div>':''}
        </div>
      </div>
      <div class="rr">${o.right}</div>`;
    rows.appendChild(row);
  };
  // goals AND debts, interleaved in priority order (top = funded first)
  orderedItems().forEach(it=>{
    if(it.type==="goal"){
      const g=it.obj;
      const s=start[g.id], e=end[g.id];
      if(s===undefined) return;
      const eShown=e===undefined?total:e, clamped=eShown>=total;
      const totalSaved=targetAt(g,VIEW_MONTHS), newRoom=g.roomBump?g.roomBump.amount:0;
      const funded=(e!==undefined)?totalSaved:(bal[g.id]||0);
      const avgMo=funded/Math.max(1,eShown-s+1);
      const paced=(g.kind==="lifestyle")||(g.monthly>0);   // shows a fixed $/mo vs an absorbed ~avg
      const moTxt=paced?`${fmt(g.monthly||0)}/mo`:`~${fmt(avgMo)}/mo`;
      const isLeftover=g.kind==="account";
      const mlabel=isLeftover?"":moTxt;
      const finishTxt=e===undefined?"after "+monthLabel(total):monthLabel(e);
      const width=Math.max(2.2, pct(eShown+1)-pct(s));
      const dlMiss=g.deadline!=null && ((sim.deadlineBal&&sim.deadlineBal[g.id])||0)<targetAt(g,g.deadline)-0.01;
      const dlShortAmt=dlMiss?Math.ceil(targetAt(g,g.deadline)-((sim.deadlineBal&&sim.deadlineBal[g.id])||0)):0;
      const warnBadge=dlMiss?`<span class="bar-warn" title="⚠ ${fmt(dlShortAmt)} short by ${monthLabel(g.deadline)}">⚠</span>`:"";
      const barText=(width>26?`<span class="dt" style="opacity:.6">Funded ${finishTxt}</span>`:"")+warnBadge;
      addRow({ id:g.id, color:g.color, barColor:cssVar(g.color), name:g.name,
        sub:`${fmt(totalSaved)} · ${mlabel}`, left:pct(s), width, arrow:clamped&&e===undefined,
        barText, canMove:custom, canResize:custom, right:`done <b>${finishTxt}</b>` });
    } else {
      // debt — payoff comes from the priority simulation (accelerates when dragged up; resize to pace)
      const d=it.obj, ds=sim.debtState && sim.debtState[d.id];
      const cmo=(ds && ds.payoff!=null)?ds.payoff:Infinity, beyond=!(cmo<=total);
      const width=beyond?100:Math.max(4,pct(cmo+1));
      const dueTxt=cmo===Infinity?"not cleared in view":"~"+new Date(2026,6+Math.round(Math.min(cmo,600)),1).toLocaleString("en-US",{month:"short",year:"numeric"});
      const yrs=cmo===Infinity?"—":(cmo/12).toFixed(1)+"y";
      const extraTxt = d.extra!=null ? ` · +${fmt(d.extra)}/mo extra` : (sim.alloc0&&sim.alloc0[d.id]>0?" · +surplus":"");
      addRow({ id:d.id, color:"var(--faint)", barColor:"#3a4150", barTextColor:"var(--txt)", name:d.name,
        sub:`${(d.rate*100).toFixed(1)}% debt · ${fmt(d.balance)} · ${fmt(debtMonthly(d))}/mo min${extraTxt}`,
        left:0, width, arrow:beyond, barText:`<span class="dt" style="opacity:.6">Payoff ${dueTxt}</span>`,
        canMove:false, canResize:custom, right:`~<b>${yrs}</b>` });
    }
  });

  rows.querySelectorAll(".bar.draggable").forEach(bar=>{
    bar.addEventListener("mousedown",e=>{ if(e.target.classList.contains("rz")) return; startBarDrag(e, bar.dataset.key, "move"); });
  });
  rows.querySelectorAll(".bar.resizebody").forEach(bar=>{   // debts: drag the bar itself to pace payoff
    bar.addEventListener("mousedown",e=>{ if(e.target.classList.contains("rz")) return; startBarDrag(e, bar.dataset.key, "resize"); });
  });
  rows.querySelectorAll(".rz").forEach(h=>{
    h.addEventListener("mousedown",e=>{ e.stopPropagation(); startBarDrag(e, h.dataset.key, "resize"); });
  });
  wireRowReorder(rows);   // vertical drag-to-reprioritize via the ⠿ grip (goals AND debts)

  // Build gantt legend dynamically
  document.getElementById("ganttLegend").innerHTML =
    state.goals.filter(g=>g.deadline!=null).map(g=>{
      const tgtAtDl=targetAt(g,g.deadline), balAtDl=(sim.deadlineBal&&sim.deadlineBal[g.id])||0;
      const dlMiss=balAtDl<tgtAtDl-0.01;
      const shortTxt=dlMiss?` <span style="color:#fbbf24;font-weight:600">⚠ ${fmt(tgtAtDl-balAtDl)} short</span>`:"";
      return `<span><i style="background:${cssVar(g.color)}"></i> ${esc(g.name)} — ${monthLabel(g.deadline)}${shortTxt}</span>`;
    }).join("");
  // Build dynamic cascade-order sentence in the note
  const co=document.getElementById("cascadeOrderText");
  if(co){ const names=INVEST_ORDER().map(k=>goalBy(k)?.name).filter(Boolean);
    co.textContent = names.length? names.join(" → ") : "(no accounts)"; }
}

//============ FUNDING PRIORITY (drag to reorder) ============
let _dragGoalId = null;
function reprioritize(dragId, dropId, below){
  if(!dragId || dragId===dropId) return;
  const p = priorityIds();
  const from = p.indexOf(dragId); if(from<0) return;
  p.splice(from,1);
  const to = p.indexOf(dropId);
  if(to<0) p.push(dragId); else p.splice(below ? to+1 : to, 0, dragId);
  snapState(); state.priority = p; renderSetup(); applyAndRender();
}
function movePriority(id, dir){
  const p = priorityIds();
  const i = p.indexOf(id); if(i<0) return;
  const j = dir==="up" ? i-1 : i+1; if(j<0 || j>=p.length) return;
  [p[i],p[j]] = [p[j],p[i]];
  snapState(); state.priority = p; renderSetup(); applyAndRender();
}
// vertical drag-to-reprioritize on gantt goal rows (via the ⠿ grip)
function wireRowReorder(rows){
  rows.querySelectorAll(".row[data-key]").forEach(row=>{
    const grip = row.querySelector(".gl-grip");
    if(grip){
      grip.addEventListener("dragstart",e=>{
        _dragGoalId = row.dataset.key;
        e.dataTransfer.effectAllowed = "move";
        try{ e.dataTransfer.setData("text/plain", row.dataset.key); }catch(_){}
        row.classList.add("dragging");
      });
      grip.addEventListener("dragend",()=>{
        row.classList.remove("dragging");
        rows.querySelectorAll(".row").forEach(r=>r.classList.remove("drop-above","drop-below"));
        _dragGoalId = null;
      });
    }
    row.addEventListener("dragover",e=>{
      if(!_dragGoalId || _dragGoalId===row.dataset.key) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const below = (e.clientY-rect.top) > rect.height/2;
      row.classList.toggle("drop-below", below);
      row.classList.toggle("drop-above", !below);
    });
    row.addEventListener("dragleave",()=>row.classList.remove("drop-above","drop-below"));
    row.addEventListener("drop",e=>{
      if(!_dragGoalId) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const below = (e.clientY-rect.top) > rect.height/2;
      const dragId = _dragGoalId;
      row.classList.remove("drop-above","drop-below");
      reprioritize(dragId, row.dataset.key, below);
    });
  });
}

