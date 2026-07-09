//============ DEFAULT STATE & STATE ============
// The generic public demo seed. A personal launcher (e.g. index-taylor.html) can
// override it by defining `SEED_STATE` / `SEED_KEY` globals BEFORE this file loads —
// see js/seed-taylor.js. That keeps real numbers hardcoded (survive a cache clear)
// and resettable (Reset clears localStorage → reloads → falls back to the seed),
// without maintaining a second copy of the app.
const GENERIC_STATE = {
  meta: { asOf: "June 2026", startYear: 2026, startMonth: 6, viewMonths: 24, setupOpen: false },
  people: ["Bob", "Sally"],
  income: [
    { id:"inc1", name:"Bob — salary",    person:"Bob",   monthly:4800, color:"var(--blue)",   bonuses:[] },
    { id:"inc2", name:"Sally — salary",  person:"Sally", monthly:3400, color:"var(--indigo)", bonuses:[] },
    { id:"inc3", name:"Sally — side gig",person:"Sally", monthly:300,  color:"var(--violet)", bonuses:[] },
  ],
  expenses: [
    { id:"ex1",  name:"Mortgage",       amount:2100, cat:"fixed" },
    { id:"ex2",  name:"Groceries",      amount:850,  cat:"fixed" },
    { id:"ex3",  name:"Discretionary",  amount:500,  cat:"guilt" },
    { id:"ex5",  name:"Utilities",      amount:300,  cat:"fixed" },
    { id:"ex6",  name:"Property Tax",   amount:300,  cat:"fixed" },
    { id:"ex8",  name:"Gas",            amount:220,  cat:"fixed" },
    { id:"ex9",  name:"Car Insurance",  amount:160,  cat:"fixed" },
    { id:"ex10", name:"Home Insurance", amount:130,  cat:"fixed" },
    { id:"ex11", name:"Phone & Internet", amount:190,  cat:"fixed" },
    { id:"ex12", name:"Eating out",      amount:200,  cat:"guilt" },
  ],
  goals: [
    { id:"emergency", kind:"account",   name:"Emergency fund", target:15000, monthly:1000, startMo:0,  color:"var(--orange)", deadline:null, person:"Bob",  roomBump:null },
    { id:"wedding",   kind:"lifestyle", name:"Wedding",        target:20000, monthly:2000, startMo:0,  color:"var(--pink)",   deadline:10,   person:null, roomBump:null },
    { id:"vacation",  kind:"lifestyle", name:"Vacation",       target:6000,  monthly:800,  startMo:11, color:"var(--sky)",    deadline:24,   person:null, roomBump:null },
    { id:"carfund",   kind:"lifestyle", name:"Next-car fund",  target:10000, monthly:800,  startMo:16, color:"#eab308",       deadline:null, person:null, roomBump:null },
    { id:"rrsp_t26",  kind:"account",  name:"Bob RRSP '26",   target:8000,  monthly:0,    startMo:0,  color:"var(--green)",  deadline:8,    person:"Bob",   roomBump:null },
    { id:"tfsa_t",    kind:"account",  name:"Bob TFSA",        target:22000, monthly:0,    startMo:0,  color:"#34d399",       deadline:null, person:"Bob",   roomBump:null },
    { id:"tfsa_e",    kind:"account",  name:"Sally TFSA",      target:15000, monthly:0,    startMo:0,  color:"#2dd4bf",       deadline:null, person:"Sally", roomBump:null },
  ],
  // single priority list across ALL goals — top = funded first; raising a goal's
  // monthly amount eats into the surplus left for everything below it.
  priority: ["wedding","rrsp_t26","emergency","vacation","carfund","tfsa_t","tfsa_e"],
  // any kind of debt: car loan, credit card, student loan, line of credit, …
  debts: [
    { id:"debt1", name:"Honda Civic", kind:"Car loan", balance:18000, rate:0.07, payment:189, freq:"biweekly",
      dumps:[ {month:0, amount:4000, fromSavings:true}, {month:12, amount:5000, fromSavings:false} ] },
  ],
  assets: {
    Bob:   [["Chequing",3000],["Bank Savings",8000],["TFSA",24000],["RRSP",41000]],
    Sally: [["Chequing",2500],["Savings",6000],["TFSA",16000],["RRSP (work pension)",22000]],
  },
  fire: { target:1250000, returnPct:6, age:34, retireAge:60 },
  mode: "custom",
};
// Active seed: a personal launcher's SEED_STATE wins, else the generic demo.
const DEFAULT_STATE = (typeof SEED_STATE !== "undefined" && SEED_STATE) ? SEED_STATE : GENERIC_STATE;
let state = structuredClone(DEFAULT_STATE);
// collision-free id generator (counter guarantees uniqueness even on same-ms rapid adds)
let _uid = 0;
const uid = p => p + "_" + (++_uid) + "_" + Date.now();

//============ DERIVED HELPERS ============
const goalBy = k => state.goals.find(g=>g.id===k);
const debtBy = k => (state.debts||[]).find(d=>d.id===k);
// ONE priority-ordered list of fundable items — goals AND debts. Top = funded first.
// A debt placed high absorbs surplus as extra principal (aggressive payoff); placed low,
// it just gets minimum payments + any scheduled dumps. Robust to ids missing/stale in state.priority.
function orderedItems(){
  const gm=new Map(state.goals.map(g=>[g.id,{type:"goal",id:g.id,obj:g}]));
  const dm=new Map((state.debts||[]).map(d=>[d.id,{type:"debt",id:d.id,obj:d}]));
  const seen=new Set(), out=[];
  (state.priority||[]).forEach(id=>{
    if(seen.has(id)) return;
    if(gm.has(id)){ seen.add(id); out.push(gm.get(id)); }
    else if(dm.has(id)){ seen.add(id); out.push(dm.get(id)); }
  });
  state.goals.forEach(g=>{ if(!seen.has(g.id)){ seen.add(g.id); out.push(gm.get(g.id)); } });
  (state.debts||[]).forEach(d=>{ if(!seen.has(d.id)){ seen.add(d.id); out.push(dm.get(d.id)); } });
  return out;
}
const orderedGoals = () => orderedItems().filter(it=>it.type==="goal").map(it=>it.obj);
const priorityIds = () => orderedItems().map(it=>it.id);
const LIFESTYLE = () => orderedGoals().filter(g=>g.kind==="lifestyle").map(g=>g.id);
const INVEST_ORDER = () => orderedGoals().filter(g=>g.kind==="account").map(g=>g.id);
const targetAt = (g, mi) => (+g.target||0) + (g.roomBump && mi>=(+g.roomBump.month||0) ? (+g.roomBump.amount||0) : 0);
const sumAssets = who => (state.assets[who]||[]).reduce((a,[,v])=>a+(+v||0),0);
const totalDebt = () => (state.debts||[]).reduce((a,d)=>a+(+d.balance||0),0);
// equivalent monthly payment for a debt regardless of its payment frequency
const debtMonthly = d => (d.freq==="biweekly" ? (+d.payment||0)*26/12 : (+d.payment||0));
const periodsPerYear = d => (d.freq==="biweekly" ? 26 : 12);
const netWorthToday = () => Object.keys(state.assets).reduce((a,w)=>a+sumAssets(w),0) - totalDebt();
const baseIncome = () => state.income.reduce((a,s)=>a+(+s.monthly||0),0);
const bonusAt = mi => state.income.reduce((a,s)=>a+(s.bonuses||[]).reduce((b,x)=>{
  const start=+x.month, rep=+x.repeat||0;
  const hits = mi===start || (rep>0 && mi>start && (mi-start)%rep===0);
  return b+(hits?+x.amount||0:0);
},0),0);
const totalExpenses = () => state.expenses.reduce((a,e)=>a+(+e.amount||0),0);
const totalDebtMinimums = () => (state.debts||[]).reduce((a,d)=>a+debtMonthly(d),0);
const surplusAt = mi => Math.max(0, baseIncome() + bonusAt(mi) - totalExpenses() - totalDebtMinimums());

//============ UNDO ============
let undoStack = [];
function snapState(){ undoStack.push(structuredClone(state)); if(undoStack.length>100) undoStack.shift(); updateUndoBtn(); }
function undoGoals(){
  if(!undoStack.length) return;
  state = undoStack.pop(); updateUndoBtn();
  syncNWInputs();
  renderSetup(); renderInputs(); renderAll(); renderNW(); renderDebts(); renderAssets(); renderFireImpact(); renderFreedom();
}
function updateUndoBtn(){ const b=document.getElementById("undoBtn"); if(b) b.disabled=undoStack.length===0; }

//============ PERSISTENCE ============
const STORAGE_KEY = (typeof SEED_KEY !== "undefined" && SEED_KEY) ? SEED_KEY : "finplan_demo_v2";
function persist(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
// deep-merge saved over defaults (arrays replaced wholesale, objects merged) — so new
// fields keep their defaults while the user's edits win.
function deepMerge(def, saved){
  if(typeof def !== "object" || def===null || Array.isArray(def)) return saved !== undefined ? saved : def;
  const r = structuredClone(def);
  for(const k of Object.keys(saved||{})){ r[k] = deepMerge(def[k], saved[k]); }
  return r;
}
function loadState(){
  let s; try{ s=JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ return; }
  if(!s) return;
  state = deepMerge(structuredClone(DEFAULT_STATE), s);
  // migrate older saved shapes (single `car` + `fundingOrder`/`waterfallOrder`)
  if(s.car && !s.debts){
    state.debts = [{ id:uid("debt"), name:s.car.name||"Loan", kind:"Car loan",
      balance:+s.car.balance||0, rate:+s.car.rate||0, payment:+s.car.biweekly||0, freq:"biweekly",
      dumps:Array.isArray(s.car.dumps)?s.car.dumps:[] }];
  }
  if(!s.priority){
    // rebuild a single priority list: lifestyle goals (in goal order) → accounts (old fundingOrder) → debts
    const ids=state.goals.map(g=>g.id);
    const life=state.goals.filter(g=>g.kind==="lifestyle").map(g=>g.id);
    const accts=Array.isArray(s.fundingOrder)?s.fundingOrder.filter(id=>ids.includes(id)):state.goals.filter(g=>g.kind==="account").map(g=>g.id);
    state.priority=[...life, ...accts, ...(state.debts||[]).map(d=>d.id)];
  }
  // old schema (pre-debts/priority) detected → adopt the new default for the setup panel
  if(s.car || s.fundingOrder || !s.priority) state.meta.setupOpen = false;
  delete state.car; delete state.fundingOrder; delete state.waterfallOrder;
}
// keep state self-consistent: debt defaults, and a priority list covering every goal+debt id exactly once
function normalize(){
  // migrate inline bonuses → standalone income sources (only from regular monthly sources)
  const toAdd=[];
  (state.income||[]).forEach(src=>{
    if((src.monthly||0)===0) return;   // already a standalone bonus source — skip
    (src.bonuses||[]).forEach(bon=>{
      toAdd.push({id:uid("inc"),name:src.name.replace(/\s*—\s*salary$/i,"").trim()+" — bonus",
        person:src.person,monthly:0,color:src.color,bonuses:[{month:+bon.month,amount:+bon.amount,repeat:+bon.repeat||0}]});
    });
    src.bonuses=[];
  });
  state.income.push(...toAdd);
  (state.expenses||[]).forEach(ex=>{ if(!ex.cat) ex.cat="fixed"; });
  // sync roomBump to null for goals whose default no longer has one
  const _dgMap=new Map(DEFAULT_STATE.goals.map(g=>[g.id,g]));
  (state.goals||[]).forEach(g=>{ const dg=_dgMap.get(g.id); if(dg&&dg.roomBump===null) g.roomBump=null; });
  if(!Array.isArray(state.debts)) state.debts = structuredClone(DEFAULT_STATE.debts);
  state.debts.forEach(d=>{
    if(d.id==null) d.id=uid("debt");
    if(d.payment==null && d.biweekly!=null){ d.payment=d.biweekly; d.freq=d.freq||"biweekly"; }
    if(!d.freq) d.freq="monthly";
    if(!d.kind) d.kind="Loan";
    if(!Array.isArray(d.dumps)) d.dumps=[];
  });
  const validIds = new Set([...state.goals.map(g=>g.id), ...state.debts.map(d=>d.id)]);
  const seen=new Set();
  let p=(Array.isArray(state.priority)?state.priority:[]).filter(id=> validIds.has(id) && !seen.has(id) && seen.add(id));
  state.goals.forEach(g=>{ if(!seen.has(g.id)){ seen.add(g.id); p.push(g.id); } });
  state.debts.forEach(d=>{ if(!seen.has(d.id)){ seen.add(d.id); p.push(d.id); } });
  state.priority = p;
}

