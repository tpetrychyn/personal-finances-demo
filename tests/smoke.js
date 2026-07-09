// Smoke tests for index.html — loads the real page in jsdom and exercises the model + UI wiring.
// Run:  cd tests && npm install && npm test     (or: node smoke.js)
// These are headless checks (no browser); they cover the pure model, persistence, and that the
// editor/gantt wiring renders without errors. They cannot test real mouse drag — verify that in a browser.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "index.html");
// The app is split into an external stylesheet + classic <script src> modules (loads over
// file:// and GitHub Pages, shares one global scope). jsdom here isn't given resources:"usable",
// so we inline those files back into the HTML — the combined document is byte-equivalent to the
// old single-file index.html, keeping these tests synchronous while exercising the real shipped code.
const html = fs.readFileSync(htmlPath, "utf8")
  .replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g,
    (_, href) => "<style>\n" + fs.readFileSync(path.join(root, href), "utf8") + "\n</style>")
  .replace(/<script\s+src="([^"]+)"><\/script>/g,
    (_, src) => "<script>\n" + fs.readFileSync(path.join(root, src), "utf8") + "\n</script>");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "✅" : "❌") + " " + name + (extra ? "  (" + extra + ")" : "")); };

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://localhost/",                       // gives an origin so localStorage works
  beforeParse(w) { if (typeof w.structuredClone !== "function") w.structuredClone = o => JSON.parse(JSON.stringify(o)); }, // old jsdom polyfill
});
const { window } = dom;
const { document } = window;
const ev = s => window.eval(s);
const fresh = () => ev("state = structuredClone(DEFAULT_STATE); normalize(); applyAndRender();");

try {
  // ---- load & header ----
  ok("page loads, header income computed", document.getElementById("statIncome").textContent.includes("$"), document.getElementById("statIncome").textContent);
  ok("header shows names", /Bob & Sally/.test(document.querySelector("header .sub").textContent));
  ok("setup defaults CLOSED", document.getElementById("setupBody").style.display === "none");

  // ---- state shape ----
  const st = ev("state");
  ok("debts is array (≥2 default, generic kinds)", Array.isArray(st.debts) && st.debts.length >= 2 && st.debts.some(d => d.kind === "Credit card"));
  ok("priority covers goals AND debts", st.priority.includes("emergency") && st.priority.includes("debt1"));
  ok("no legacy fields (car/fundingOrder/waterfallOrder)", st.car === undefined && st.fundingOrder === undefined && st.waterfallOrder === undefined);
  ok("income bonuses feature seeded", st.income.some(s => (s.bonuses || []).length > 0));

  // ---- pure model ----
  ok("baseIncome=8500", ev("baseIncome()") === 8500);
  ok("totalExpenses=5410", ev("totalExpenses()") === 5410);
  ok("surplusAt(0)=3090", ev("surplusAt(0)") === 3090);
  ok("bonus reflected at its month", ev("bonusAt(6)") > 0, "bonusAt(6)=" + ev("bonusAt(6)"));
  ok("totalDebt sums all debts", ev("totalDebt()") === ev("state.debts.reduce((a,d)=>a+d.balance,0)"));
  const sim = ev("simulate()");
  ok("simulate returns debtState w/ curves", !!sim.debtState && Array.isArray(sim.debtState.debt1.curve));
  ok("no NaN in goal balances", Object.values(sim.bal).every(v => Number.isFinite(v)));

  // ---- CORE: debts are funding items in one priority list ----
  const payLow = ev(`(function(){ state=structuredClone(DEFAULT_STATE); normalize(); return simulate().debtState.debt2.payoff; })()`);
  const payTop = ev(`(function(){ state.priority=["debt2",...state.priority.filter(x=>x!=="debt2")]; return simulate().debtState.debt2.payoff; })()`);
  ok("drag debt to TOP → pays off sooner", payTop < payLow, "top=" + payTop + "mo vs low=" + payLow + "mo");

  // resize/pace: capping a top-priority debt's monthly extra slows it
  const payUncapped = ev(`(function(){ delete state.debts[1].extra; return simulate().debtState.debt2.payoff; })()`);
  const payCapped = ev(`(function(){ state.debts[1].extra=200; return simulate().debtState.debt2.payoff; })()`);
  ok("capping a debt's monthly extra slows payoff", payCapped > payUncapped, "uncapped=" + payUncapped + " capped=" + payCapped);
  ok("extraForDuration: shorter target ⇒ more extra", ev("extraForDuration(state.debts[1],3)") > ev("extraForDuration(state.debts[1],18)"));

  // accounts can be paced too (shared component): a small monthly cap fills slower
  fresh();
  const acctAbsorb = ev(`(function(){ return simulate().end["tfsa_t"]; })()`);
  const acctCapped = ev(`(function(){ state.goals.find(x=>x.id==="tfsa_t").monthly=200; return simulate().end["tfsa_t"]; })()`);
  ok("account monthly cap paces its fill", acctCapped == null || acctCapped > acctAbsorb, "absorb=" + acctAbsorb + " capped=" + acctCapped);

  // ---- priority reorder helpers ----
  fresh();
  ev(`reprioritize('debt1','emergency',false)`);
  ok("reprioritize moves an item", ev("priorityIds().indexOf('debt1') < priorityIds().indexOf('emergency')"));
  const wi = ev("priorityIds().indexOf('wedding')");
  ev("movePriority('wedding','up')");
  ok("movePriority shifts by one", ev("priorityIds().indexOf('wedding')") === wi - 1);

  // ---- sankey expenses ordered high → low ----
  fresh();
  const order = ev(`(function(){ const m=buildSankeyModel(simulate().alloc0); return m.nodes.filter(n=>n.col===2&&n.id[0]==='e').map(n=>n.value); })()`);
  let desc = order.length > 1; for (let i = 1; i < order.length; i++) if (order[i] > order[i - 1]) desc = false;
  ok("sankey expenses ordered highest→lowest", desc, order.join(","));

  // ---- shared bar component: goals AND debts get resize handles ----
  fresh();
  ev(`state.mode="custom"; renderAll();`);
  const rowsHTML = document.getElementById("rows").innerHTML;
  ok("gantt rows carry drag grips", rowsHTML.includes("gl-grip"));
  ok("multiple resize handles (.rz) across item types", (rowsHTML.match(/class="rz"/g) || []).length >= 3);
  ok("debt rows are reorderable (data-key)", /data-key="debt1"/.test(rowsHTML));

  // ---- UI wiring renders all sections ----
  const body = document.body.innerHTML;
  ["People", "Income", "Expenses", "Goals", "Funding priority", "Debts", "Assets", "Export"].forEach(s =>
    ok("setup section: " + s, new RegExp(s, "i").test(body)));
  ok("debt card renders per-debt blocks", document.querySelectorAll("#debtBlocks .debt-block").length >= 2);
  ok("charts render (sankey/nw/debt)", document.getElementById("sankey").innerHTML.length > 100 &&
    document.getElementById("nwChart").innerHTML.length > 50 &&
    document.querySelector("#debtBlocks .debt-chart").innerHTML.length > 50);

  // ---- color inputs are valid hex ----
  ok("color inputs are #rrggbb", [...document.querySelectorAll('input[type=color]')].every(c => /^#[0-9a-f]{6}$/i.test(c.value)));

  // ---- persistence + migration ----
  ok("persists to finplan_demo_v2", !!window.localStorage.getItem("finplan_demo_v2"));
  const migrated = ev(`(function(){
    // simulate an OLD saved shape (single car + fundingOrder, no debts/priority)
    const oldState={people:["A","B"],goals:state.goals,fundingOrder:["tfsa_t"],car:{name:"Old Car",balance:12000,rate:0.05,biweekly:150,dumps:[]},
      income:state.income,expenses:state.expenses,assets:state.assets,fire:state.fire,mode:"custom",meta:{setupOpen:true}};
    localStorage.setItem("finplan_demo_v2", JSON.stringify(oldState));
    loadState(); normalize();
    return { debts: state.debts.map(d=>d.name), hasPriority: Array.isArray(state.priority) && state.priority.length>0, setupOpen: state.meta.setupOpen, noCar: state.car===undefined };
  })()`);
  ok("migration: old car → debts[]", migrated.debts.includes("Old Car") && migrated.noCar, JSON.stringify(migrated.debts));
  ok("migration: builds priority list", migrated.hasPriority);
  ok("migration: resets setup to closed", migrated.setupOpen === false);

  // ---- empty-state guards ----
  ev(`state.goals=[]; state.debts=[]; state.priority=[];`);
  ok("simulate no-throw with empty goals+debts", (() => { try { ev("simulate()"); return true; } catch (e) { console.log("   " + e.message); return false; } })());
  ok("renderAll no-throw empty", (() => { try { ev("renderAll()"); return true; } catch (e) { console.log("   " + e.message); return false; } })());

  fresh();
  ok("full applyAndRender no-throw after reset", true);

} catch (e) {
  console.log("❌ FATAL: " + e.message + "\n" + e.stack);
  fail++;
}

console.log("\n═══════════════════════════════════════");
console.log(`  ${pass} passed, ${fail} failed`);
console.log("═══════════════════════════════════════");
process.exit(fail ? 1 : 0);
