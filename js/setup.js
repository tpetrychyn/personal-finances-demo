//============ SETUP PANEL ============
function renderSetup(){
  const body = document.getElementById("setupBody");
  if(!body) return;
  body.innerHTML = "";
  const personColors = ["var(--blue)","var(--indigo)","var(--violet)","var(--pink)","var(--sky)","var(--amber)"];
  const personColor = i => personColors[Math.min(i,personColors.length-1)];

  // ── PEOPLE ──
  const sec1 = sec("People");
  state.people.forEach((p,pi)=>{
    const row = el("div","person-row");
    row.innerHTML = `<span class="dot" style="background:${cssVar(personColor(pi))}"></span>
      <input type="text" value="${esc(p)}" data-pi="${pi}" placeholder="Name">
      <button class="del" data-pi="${pi}" title="Remove">×</button>`;
    row.querySelector("input").addEventListener("change", e=>{
      const oldName = state.people[pi];
      const newName = e.target.value.trim() || oldName;
      if(newName === oldName) return;
      snapState();
      if(state.assets[oldName]){ state.assets[newName]=state.assets[oldName]; delete state.assets[oldName]; }
      state.income.forEach(s=>{ if(s.person===oldName) s.person=newName; });
      state.goals.forEach(g=>{ if(g.person===oldName) g.person=newName; });
      state.people[pi]=newName;
      renderSetup(); applyAndRender();
    });
    row.querySelector(".del").addEventListener("click",()=>{
      if(state.people.length<=1){ alert("Need at least one person."); return; }
      snapState();
      const name=state.people[pi];
      state.people.splice(pi,1);
      delete state.assets[name];
      renderSetup(); applyAndRender();
    });
    sec1.appendChild(row);
  });
  const addPBtn = el("button","addbtn"); addPBtn.textContent="+ Add person";
  addPBtn.addEventListener("click",()=>{
    snapState(); const nm="Person "+(state.people.length+1);
    state.people.push(nm); state.assets[nm]=[];
    renderSetup(); applyAndRender();
  });
  sec1.appendChild(addPBtn);
  body.appendChild(sec1);

  // ── INCOME ──
  const sec2 = sec("Income sources");
  state.income.forEach((src,si)=>{
    const isBonus = src.monthly===0 && (src.bonuses||[]).length>0;
    const row = el("div","src-row");
    if(isBonus){
      const bon=src.bonuses[0];
      const rep=+bon.repeat||0;
      row.innerHTML=`<input type="text" class="nm" value="${esc(src.name)}" placeholder="Bonus name" data-si="${si}" data-f="name">
        <select data-si="${si}" data-f="person">${state.people.map(p=>`<option value="${esc(p)}" ${p===src.person?"selected":""}>${esc(p)}</option>`).join("")}</select>
        $<input type="number" class="bamount" step="500" min="0" value="${bon.amount}" data-si="${si}" data-f="bamount">
        in mo<input type="number" class="bmo" step="1" min="0" max="72" value="${bon.month}" data-si="${si}" data-f="bmonth">
        <span class="hint" style="color:var(--faint);font-size:10px">(${monthLabel(bon.month)})</span>
        <label style="font-size:11px;color:var(--muted)">repeats every</label>
        <input type="number" class="bmo" step="1" min="0" placeholder="—" value="${rep||""}" data-si="${si}" data-f="brepeat" title="Repeat interval in months (blank = one-time)">
        <label style="font-size:11px;color:var(--muted)">mo</label>
        <button class="del" data-si="${si}" title="Remove">×</button>`;
    } else {
      row.innerHTML=`<input type="text" class="nm" value="${esc(src.name)}" placeholder="Source name" data-si="${si}" data-f="name">
        <select data-si="${si}" data-f="person">${state.people.map(p=>`<option value="${esc(p)}" ${p===src.person?"selected":""}>${esc(p)}</option>`).join("")}</select>
        $<input type="number" class="amt" step="100" min="0" value="${src.monthly}" data-si="${si}" data-f="monthly">
        /mo
        <button class="del" data-si="${si}" title="Remove">×</button>`;
    }
    row.querySelectorAll("input,select").forEach(inp=>{
      const ev=inp.type==="number"?"input":"change";
      inp.addEventListener(ev,e=>{
        const s=state.income[+e.target.dataset.si]; if(!s) return;
        const f=e.target.dataset.f;
        if(f==="name") s.name=e.target.value;
        else if(f==="person") s.person=e.target.value;
        else if(f==="monthly") s.monthly=Math.round(+e.target.value||0);
        else if(f==="bamount"){ if(s.bonuses[0]) s.bonuses[0].amount=Math.round(+e.target.value||0); }
        else if(f==="bmonth"){
          if(s.bonuses[0]) s.bonuses[0].month=Math.round(+e.target.value||0);
          const hint=e.target.parentElement.querySelector(".hint"); if(hint) hint.textContent=`(${monthLabel(+e.target.value||0)})`;
        }
        else if(f==="brepeat"){ if(s.bonuses[0]) s.bonuses[0].repeat=+e.target.value>0?+e.target.value:0; }
        applyAndRender();
      });
    });
    row.querySelector(".del").addEventListener("click",()=>{
      snapState(); state.income.splice(si,1); renderSetup(); applyAndRender();
    });
    sec2.appendChild(row);
  });
  const addBtns=el("div",""); addBtns.style="display:flex;gap:8px;margin-top:4px";
  const addSrc=el("button","addbtn"); addSrc.textContent="+ Add income source";
  addSrc.addEventListener("click",()=>{ snapState(); state.income.push({id:uid("inc"),name:"New income",person:state.people[0],monthly:0,color:"var(--amber)",bonuses:[]}); renderSetup(); applyAndRender(); });
  const addBon=el("button","addbtn"); addBon.textContent="+ Add one-time bonus";
  addBon.addEventListener("click",()=>{ snapState(); state.income.push({id:uid("inc"),name:state.people[0]+" — bonus",person:state.people[0],monthly:0,color:"var(--amber)",bonuses:[{month:6,amount:1000}]}); renderSetup(); applyAndRender(); });
  addBtns.appendChild(addSrc); addBtns.appendChild(addBon);
  sec2.appendChild(addBtns);
  body.appendChild(sec2);

  // ── EXPENSES ──
  const sec3=sec("Expenses");
  state.expenses.forEach((ex,ei)=>{
    const row=el("div","exp-row");
    row.innerHTML=`<input type="text" class="nm" value="${esc(ex.name)}" placeholder="Expense name" data-ei="${ei}" data-f="name">
      $<input type="number" class="amt" step="50" min="0" value="${ex.amount}" data-ei="${ei}" data-f="amount">
      <select data-ei="${ei}" data-f="cat">
        <option value="fixed" ${ex.cat==="fixed"?"selected":""}>Fixed cost</option>
        <option value="guilt" ${ex.cat==="guilt"?"selected":""}>Guilt-free</option>
      </select>
      <button class="del" data-ei="${ei}" title="Remove">×</button>`;
    row.querySelector("input[data-f='name']").addEventListener("change",e=>{ state.expenses[+e.target.dataset.ei].name=e.target.value; applyAndRender(); });
    row.querySelector("input[data-f='amount']").addEventListener("input",e=>{ state.expenses[+e.target.dataset.ei].amount=Math.round(+e.target.value||0); applyAndRender(); });
    row.querySelector("select[data-f='cat']").addEventListener("change",e=>{ state.expenses[+e.target.dataset.ei].cat=e.target.value; applyAndRender(); });
    row.querySelector(".del").addEventListener("click",()=>{ snapState(); state.expenses.splice(ei,1); renderSetup(); applyAndRender(); });
    sec3.appendChild(row);
  });
  const addEx=el("button","addbtn"); addEx.textContent="+ Add expense";
  addEx.addEventListener("click",()=>{ snapState(); state.expenses.push({id:uid("ex"),name:"New expense",amount:0}); renderSetup(); applyAndRender(); });
  sec3.appendChild(addEx);
  body.appendChild(sec3);

  // ── GOALS ──
  const sec4=sec("Goals (lifestyle & savings accounts)");
  state.goals.forEach((g,gi)=>{
    const row=el("div","goal-row");
    const resolvedColor = toHex(g.color);
    row.innerHTML=`
      <input type="text" class="nm" value="${esc(g.name)}" placeholder="Name" data-gi="${gi}" data-f="name" title="Goal name">
      <select data-gi="${gi}" data-f="kind">
        <option value="lifestyle" ${g.kind==="lifestyle"?"selected":""}>Lifestyle</option>
        <option value="account"   ${g.kind==="account"?"selected":""}>Account</option>
      </select>
      <label style="font-size:11px;color:var(--muted)">Target:$</label>
      <input type="number" class="tgt" step="1000" min="0" value="${g.target}" data-gi="${gi}" data-f="target">
      ${g.kind==="lifestyle"?`<label style="font-size:11px;color:var(--muted)">$/mo:</label>
        <input type="number" class="mo" step="100" min="0" max="${Math.max(0,baseIncome()-totalExpenses()-totalDebtMinimums())}" value="${g.monthly}" data-gi="${gi}" data-f="monthly">`:""}
      <label style="font-size:11px;color:var(--muted)">Start mo:</label>
      <input type="number" class="mo" step="1" min="0" max="60" value="${g.startMo||0}" data-gi="${gi}" data-f="startMo">
      <label style="font-size:11px;color:var(--muted)">Deadline:</label>
      <input type="number" class="dl" step="1" min="0" max="60" value="${g.deadline!=null?g.deadline:""}" placeholder="—" data-gi="${gi}" data-f="deadline" title="Deadline month (blank=none)">
      ${g.kind==="account"?`<select data-gi="${gi}" data-f="person">${state.people.map(p=>`<option value="${esc(p)}" ${p===g.person?"selected":""}>${esc(p)}</option>`).join("")}</select>`:""}
      <input type="color" value="${resolvedColor}" data-gi="${gi}" data-f="color" title="Color" style="width:32px;height:28px;padding:2px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid var(--line)">
      <button class="del" data-gi="${gi}" title="Remove goal">×</button>`;
    row.querySelectorAll("input[data-f],select[data-f]").forEach(inp=>{
      const ev=(inp.type==="number"||inp.type==="color")?"input":"change";
      inp.addEventListener(ev,e=>{
        const gi2=+e.target.dataset.gi, f=e.target.dataset.f;
        const g2=state.goals[gi2]; if(!g2) return;
        if(f==="name") g2.name=e.target.value;
        else if(f==="kind"){
          g2.kind=e.target.value;
          if(e.target.value==="account" && !g2.person) g2.person=state.people[0];
          renderSetup(); applyAndRender(); return;   // all goals already live in state.priority
        }
        else if(f==="monthly"){ const max=Math.max(0,baseIncome()-totalExpenses()-totalDebtMinimums()); g2.monthly=Math.min(+e.target.value||0,max); e.target.value=g2.monthly; }
        else if(f==="target"||f==="startMo") g2[f]=Math.round(+e.target.value||0);
        else if(f==="deadline") g2.deadline=e.target.value===""?null:(+e.target.value||0);
        else if(f==="color") g2.color=e.target.value;
        else if(f==="person") g2.person=e.target.value;
        applyAndRender();
      });
    });
    row.querySelector(".del").addEventListener("click",()=>{
      snapState();
      const id=state.goals[gi].id;
      state.goals.splice(gi,1);
      state.priority=(state.priority||[]).filter(x=>x!==id);
      renderSetup(); applyAndRender();
    });
    sec4.appendChild(row);
  });
  const addG=el("button","addbtn"); addG.textContent="+ Add goal";
  addG.addEventListener("click",()=>{
    snapState();
    const newId=uid("goal");
    state.goals.push({id:newId,kind:"lifestyle",name:"New goal",target:5000,monthly:500,startMo:0,color:"#60a5fa",deadline:null,person:state.people[0],roomBump:null});
    // insert above the debts (so a new goal outranks debt payoff by default; drag to taste)
    const firstDebt=(state.priority||[]).findIndex(id=>debtBy(id));
    if(firstDebt<0) state.priority.push(newId); else state.priority.splice(firstDebt,0,newId);
    renderSetup(); applyAndRender();
  });
  sec4.appendChild(addG);
  body.appendChild(sec4);

  // ── FUNDING PRIORITY (drag to reorder; goals AND debts) ──
  const sec5=sec("Funding priority — drag to reorder");
  const foNote=el("div",""); foNote.style="font-size:11.5px;color:var(--muted);margin-bottom:8px";
  foNote.innerHTML="Top = funded first. Each month's surplus flows down this list: lifestyle goals take their monthly $, accounts &amp; debts absorb the rest. Drag a <b>debt</b> up to pay it off aggressively.";
  sec5.appendChild(foNote);
  orderedItems().forEach((it,pi,arr)=>{
    const o=it.obj, isDebt=it.type==="debt";
    const color=isDebt?"var(--faint)":o.color;
    const row=el("div","prio-row"); row.draggable=true; row.dataset.id=it.id;
    row.innerHTML=`<span class="grip">⠿</span><span class="dot" style="background:${cssVar(color)}"></span>
      <span class="prio-name">${esc(o.name)}</span>
      <span class="prio-kind">${isDebt?"debt":(o.kind==="account"?"account":"goal")}</span>
      ${pi>0?`<button class="fo-btn" data-dir="up" title="Move up">↑</button>`:""}
      ${pi<arr.length-1?`<button class="fo-btn" data-dir="down" title="Move down">↓</button>`:""}`;
    row.addEventListener("dragstart",e=>{ _dragGoalId=it.id; e.dataTransfer.effectAllowed="move"; try{e.dataTransfer.setData("text/plain",it.id);}catch(_){} row.classList.add("dragging"); });
    row.addEventListener("dragend",()=>{ row.classList.remove("dragging"); sec5.querySelectorAll(".prio-row").forEach(r=>r.classList.remove("drop-above","drop-below")); _dragGoalId=null; });
    row.addEventListener("dragover",e=>{ if(!_dragGoalId||_dragGoalId===it.id) return; e.preventDefault(); e.dataTransfer.dropEffect="move";
      const rect=row.getBoundingClientRect(); const below=(e.clientY-rect.top)>rect.height/2;
      row.classList.toggle("drop-below",below); row.classList.toggle("drop-above",!below); });
    row.addEventListener("dragleave",()=>row.classList.remove("drop-above","drop-below"));
    row.addEventListener("drop",e=>{ if(!_dragGoalId) return; e.preventDefault();
      const rect=row.getBoundingClientRect(); const below=(e.clientY-rect.top)>rect.height/2; const dragId=_dragGoalId;
      row.classList.remove("drop-above","drop-below"); reprioritize(dragId, it.id, below); });
    row.querySelectorAll(".fo-btn").forEach(b=>b.addEventListener("click",e=>movePriority(it.id, e.target.dataset.dir)));
    sec5.appendChild(row);
  });
  // ── DEBTS (any kind: car loan, credit card, …) ──
  const sec6=sec("Debts");
  (state.debts||[]).forEach((d,di)=>{
    const row=el("div","debt-row");
    row.innerHTML=`
      <input type="text" class="nm" value="${esc(d.name)}" placeholder="Name" data-di="${di}" data-f="name" title="Debt name">
      <select data-di="${di}" data-f="kind" title="Type">
        ${["Car loan","Credit card","Student loan","Line of credit","Mortgage","Personal loan","Other"].map(k=>`<option ${k===d.kind?"selected":""}>${k}</option>`).join("")}
      </select>
      <label style="font-size:11px;color:var(--muted)">Bal $</label><input type="number" class="num" step="500" min="0" value="${d.balance}" data-di="${di}" data-f="balance">
      <label style="font-size:11px;color:var(--muted)">Rate %</label><input type="number" class="num" step="0.1" min="0" value="${(d.rate*100).toFixed(2)}" data-di="${di}" data-f="rate">
      <label style="font-size:11px;color:var(--muted)">Pmt $</label><input type="number" class="num" step="10" min="0" value="${d.payment}" data-di="${di}" data-f="payment">
      <select data-di="${di}" data-f="freq" title="Payment frequency">
        <option value="monthly" ${d.freq!=="biweekly"?"selected":""}>monthly</option>
        <option value="biweekly" ${d.freq==="biweekly"?"selected":""}>biweekly</option>
      </select>
      <button class="del" data-di="${di}" title="Remove debt">×</button>`;
    row.querySelectorAll("input[data-f],select[data-f]").forEach(inp=>{
      const ev=(inp.tagName==="SELECT")?"change":(inp.type==="number"?"input":"change");
      inp.addEventListener(ev,e=>{
        const i=+e.target.dataset.di, f=e.target.dataset.f, d2=state.debts[i]; if(!d2) return;
        if(f==="name"||f==="kind"||f==="freq") d2[f]=e.target.value;
        else if(f==="rate") d2.rate=(+e.target.value||0)/100;
        else d2[f]=Math.round(+e.target.value||0);
        if(f==="freq"||f==="kind"){ renderSetup(); }
        applyAndRender();
      });
    });
    row.querySelector(".del").addEventListener("click",()=>{
      snapState();
      const id=state.debts[di].id;
      state.debts.splice(di,1);
      state.priority=(state.priority||[]).filter(x=>x!==id);
      renderSetup(); applyAndRender();
    });
    sec6.appendChild(row);
  });
  const addD=el("button","addbtn"); addD.textContent="+ Add debt";
  addD.addEventListener("click",()=>{
    snapState();
    const id=uid("debt");
    state.debts.push({id,name:"New debt",kind:"Credit card",balance:2000,rate:0.1999,payment:100,freq:"monthly",dumps:[]});
    state.priority.push(id);   // new debts start at lowest priority (min payments only)
    renderSetup(); applyAndRender();
  });
  sec6.appendChild(addD);
  body.appendChild(sec6);
  body.appendChild(sec5);

  // ── ASSETS ──
  const sec7=sec("Assets");
  state.people.forEach((who,wi)=>{
    const personSec=el("div","");
    const h=el("div",""); h.style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:6px";
    h.innerHTML=`<span class="dot" style="background:${cssVar(personColor(wi))}"></span>${esc(who)}`;
    personSec.appendChild(h);
    (state.assets[who]||[]).forEach(([nm,val],ai)=>{
      const row=el("div","asset-edit-row");
      row.innerHTML=`<input type="text" class="nm" value="${esc(nm)}" placeholder="Account name" data-who="${wi}" data-ai="${ai}" data-f="name">
        $<input type="number" class="amt" step="1000" min="0" value="${val}" data-who="${wi}" data-ai="${ai}" data-f="val">
        <button class="del" data-who="${wi}" data-ai="${ai}" title="Remove">×</button>`;
      row.querySelector("input[data-f='name']").addEventListener("change",e=>{
        state.assets[state.people[+e.target.dataset.who]][+e.target.dataset.ai][0]=e.target.value; applyAndRender();
      });
      row.querySelector("input[data-f='val']").addEventListener("input",e=>{
        state.assets[state.people[+e.target.dataset.who]][+e.target.dataset.ai][1]=Math.round(+e.target.value||0); applyAndRender();
      });
      row.querySelector(".del").addEventListener("click",e=>{
        snapState(); state.assets[who].splice(+e.target.dataset.ai,1); renderSetup(); applyAndRender();
      });
      personSec.appendChild(row);
    });
    const addA=el("button","addbtn"); addA.style="margin-top:4px"; addA.textContent=`+ Add ${who} account`;
    addA.addEventListener("click",()=>{ snapState(); if(!state.assets[who]) state.assets[who]=[]; state.assets[who].push(["New account",0]); renderSetup(); applyAndRender(); });
    personSec.appendChild(addA);
    sec7.appendChild(personSec);
  });
  body.appendChild(sec7);

  // ── EXPORT / IMPORT ──
  const sec8=sec("Export / Import");
  const ioDiv=el("div","setup-io");
  const expBtn=el("button","btn"); expBtn.textContent="Export JSON";
  expBtn.addEventListener("click",()=>{
    const txt=JSON.stringify(state,null,2);
    const ta=sec8.querySelector("textarea");
    if(ta){ ta.value=txt; ta.select(); try{document.execCommand("copy");}catch(e){} }
  });
  const impBtn=el("button","btn"); impBtn.textContent="Import JSON";
  impBtn.addEventListener("click",()=>{
    const ta=sec8.querySelector("textarea");
    if(!ta||!ta.value.trim()) return;
    try{
      const s=JSON.parse(ta.value);
      snapState(); state=deepMerge(structuredClone(DEFAULT_STATE), s); normalize(); syncNWInputs(); renderSetup(); applyAndRender();
    }catch(e){ alert("Invalid JSON: "+e.message); }
  });
  const resetBtn=el("button","btn"); resetBtn.textContent="Reset all data"; resetBtn.style="background:#3a1a1a;color:var(--red);border-color:var(--red)";
  resetBtn.addEventListener("click",()=>{
    if(!confirm("Reset everything to the demo defaults? This cannot be undone.")) return;
    snapState(); state=structuredClone(DEFAULT_STATE); normalize(); syncNWInputs(); renderSetup(); applyAndRender();
  });
  ioDiv.appendChild(expBtn); ioDiv.appendChild(impBtn); ioDiv.appendChild(resetBtn);
  sec8.appendChild(ioDiv);
  const ta=el("textarea",""); ta.placeholder="Paste JSON here to import, or click Export to see current state";
  sec8.appendChild(ta);
  body.appendChild(sec8);
}

//============ SETUP TOGGLE ============
function initSetupToggle(){
  const btn=document.getElementById("setupToggle");
  const body=document.getElementById("setupBody");
  const chev=document.getElementById("setupChevron");
  if(!btn||!body) return;
  const open=state.meta.setupOpen!==false;
  body.style.display=open?"":"none";
  if(chev) chev.textContent=open?"▴":"▾";
  btn.addEventListener("click",()=>{
    const isOpen=body.style.display!=="none";
    body.style.display=isOpen?"none":"";
    if(chev) chev.textContent=isOpen?"▾":"▴";
    state.meta.setupOpen=!isOpen; persist();
  });
}

