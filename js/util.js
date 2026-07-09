//============ HELPERS ============
const fmt = n => "$"+Math.round(n).toLocaleString();
const cssVar = v => v.startsWith("var(") ? getComputedStyle(document.documentElement).getPropertyValue(v.slice(4,-1)).trim() : v;
// normalize any color (css var / rgb()) to a #rrggbb hex string a <input type=color> accepts
const toHex = c => {
  let v = cssVar(c).trim();
  if(/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if(/^#[0-9a-f]{3}$/i.test(v)) return ("#"+v.slice(1).split("").map(x=>x+x).join("")).toLowerCase();
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if(m) return "#"+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,"0")).join("");
  return "#60a5fa"; // fallback
};
const START = {y:2026, m:6};
function monthLabel(i){
  const d = new Date(START.y, START.m+i, 1);
  return d.toLocaleString("en-US",{month:"short"})+" '"+String(d.getFullYear()).slice(2);
}
const VIEW_MONTHS = 24;

// DOM helper functions used in renderSetup
function el(tag,cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function sec(title){
  const d=document.createElement("div"); d.className="setup-section";
  const h=document.createElement("h3"); h.textContent=title; d.appendChild(h); return d;
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

