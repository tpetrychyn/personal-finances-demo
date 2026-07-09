//============ SANKEY ============
function buildSankeyModel(alloc0, mi=0){
  const nodes=[],links=[];
  // col 0 + col 1: income sources → income pool
  const bonusMi=bonusAt(mi);
  state.income.filter(s=>s.monthly>0).forEach(s=>nodes.push({id:s.id,name:s.name,value:+s.monthly||0,col:0,color:s.color}));
  if(bonusMi>0){
    const bonusSrcs=state.income.filter(s=>s.monthly===0&&(s.bonuses||[]).some(x=>{const st=+x.month,r=+x.repeat||0;return mi===st||(r>0&&mi>st&&(mi-st)%r===0);}));
    bonusSrcs.forEach(s=>nodes.push({id:s.id+"_b",name:s.name,value:bonusMi/Math.max(1,bonusSrcs.length),col:0,color:s.color}));
  }
  const incTotal=baseIncome()+bonusMi;
  nodes.push({id:"income",name:"Income",value:incTotal,col:1,color:"#c5cbd8"});
  state.income.filter(s=>s.monthly>0).forEach(s=>links.push({source:s.id,target:"income",value:+s.monthly||0,color:s.color}));
  if(bonusMi>0){ const bonusSrcs=nodes.filter(n=>n.col===0&&n.id.endsWith("_b")); bonusSrcs.forEach(n=>links.push({source:n.id,target:"income",value:n.value,color:n.color})); }

  // col 2 → col 3: Savings (goals)
  const goalBuckets=state.goals.filter(g=>alloc0[g.id]>0)
    .map(g=>({id:g.id,name:g.name,value:alloc0[g.id],color:g.color}))
    .sort((a,b)=>b.value-a.value);
  const savingsTotal=goalBuckets.reduce((a,b)=>a+b.value,0);
  if(savingsTotal>0){
    nodes.push({id:"savings",name:"Savings",value:savingsTotal,col:2,color:"var(--green)"});
    links.push({source:"income",target:"savings",value:savingsTotal,color:"var(--green)"});
    goalBuckets.forEach(b=>{
      nodes.push({id:"b_"+b.id,name:b.name,value:b.value,col:3,color:b.color});
      links.push({source:"savings",target:"b_"+b.id,value:b.value,color:b.color});
    });
  }

  // col 2 → col 3: Debt payoff (minimum payments derived from debt items + any extra surplus)
  const activeDebts=(state.debts||[]).filter(d=>(+d.balance||0)>0.01);
  if(activeDebts.length>0){
    const debtNodeTotal=activeDebts.reduce((a,d)=>a+debtMonthly(d)+(alloc0[d.id]||0),0);
    nodes.push({id:"debtnode",name:"Debt payoff",value:debtNodeTotal,col:2,color:"#5c6373"});
    links.push({source:"income",target:"debtnode",value:debtNodeTotal,color:"#5c6373"});
    activeDebts.forEach(d=>{
      const dv=debtMonthly(d)+(alloc0[d.id]||0); if(dv<=0) return;
      nodes.push({id:"d_"+d.id,name:d.name,value:dv,col:3,color:"#5c6373"});
      links.push({source:"debtnode",target:"d_"+d.id,value:dv,color:"#5c6373"});
    });
  }

  // col 2: individual expense nodes (all expenses — car payment is $0 so won't show)
  state.expenses.map((e,idx)=>({e,idx})).sort((a,b)=>(+b.e.amount||0)-(+a.e.amount||0))
    .forEach(({e,idx},i)=>{
      if(!(+e.amount>0)) return;
      const c=i%2?"var(--orange)":"var(--red)";
      nodes.push({id:"e"+idx,name:e.name,value:+e.amount||0,col:2,color:c});
      links.push({source:"income",target:"e"+idx,value:+e.amount||0,color:c});
    });

  return {nodes,links};
}

function renderSankey(alloc0, mi=0){
  const lbl=document.getElementById("sankeyMonthLbl"); if(lbl) lbl.textContent=monthLabel(mi);
  const {nodes,links} = buildSankeyModel(alloc0, mi);
  const W=1300,H=780, mL=150, mR=255, mT=22, mB=22, nodeW=18, pad=9;
  const cols=[0,1,2,3];
  const colNodes = cols.map(c=>nodes.filter(n=>n.col===c));
  const usableH=H-mT-mB;
  let scale=Infinity;
  colNodes.forEach(cn=>{
    if(!cn.length) return;
    const tot=cn.reduce((a,n)=>a+n.value,0);
    if(tot===0) return;
    const s=(usableH-(cn.length-1)*pad)/tot;
    scale=Math.min(scale,s);
  });
  if(!isFinite(scale)) scale=1;
  const step=(W-mL-mR-nodeW)/(cols.length-1);
  const colX=cols.map(c=>mL+c*step);
  const byId={};
  colNodes.forEach((cn,ci)=>{
    const tot=cn.reduce((a,n)=>a+n.value,0);
    const blockH=tot*scale+(cn.length-1)*pad;
    let y=mT+(usableH-blockH)/2;
    cn.forEach(n=>{
      n.x0=colX[ci]; n.x1=colX[ci]+nodeW; n.y0=y; n.y1=y+n.value*scale;
      n.out=[]; n.in=[]; byId[n.id]=n; y=n.y1+pad;
    });
  });
  links.forEach(l=>{ l.s=byId[l.source]; l.t=byId[l.target]; if(l.s) l.s.out.push(l); if(l.t) l.t.in.push(l); });
  Object.values(byId).forEach(n=>{
    n.out.sort((a,b)=>a.t.y0-b.t.y0); let o=n.y0;
    n.out.forEach(l=>{ l.sy=o; o+=l.value*scale; });
    n.in.sort((a,b)=>a.s.y0-b.s.y0); let i=n.y0;
    n.in.forEach(l=>{ l.ty=i; i+=l.value*scale; });
  });
  let s='';
  links.forEach(l=>{
    if(!l.s||!l.t) return;
    const w=Math.max(1,l.value*scale);
    const x0=l.s.x1, x1=l.t.x0, y0=l.sy+w/2, y1=l.ty+w/2, xm=(x0+x1)/2;
    s+=`<path d="M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1}" fill="none" stroke="${cssVar(l.color)}" stroke-width="${w}" opacity="0.34"/>`;
  });
  nodes.forEach(n=>{
    s+=`<rect x="${n.x0}" y="${n.y0}" width="${nodeW}" height="${Math.max(1,n.y1-n.y0)}" rx="2" fill="${cssVar(n.color)}"/>`;
    const cy=(n.y0+n.y1)/2;
    if(n.col===0){
      s+=`<text x="${n.x0-8}" y="${cy-1}" text-anchor="end" dominant-baseline="middle">${n.name}</text>`;
      s+=`<text x="${n.x0-8}" y="${cy+13}" text-anchor="end" dominant-baseline="middle" class="val">${fmt(n.value)}</text>`;
    } else if(n.col===1){
      s+=`<text x="${(n.x0+n.x1)/2}" y="${n.y0-10}" text-anchor="middle" font-weight="600">${n.name}</text>`;
      s+=`<text x="${(n.x0+n.x1)/2}" y="${n.y0-26}" text-anchor="middle" class="val" font-size="13">${fmt(n.value)}</text>`;
    } else {
      const bold = n.id==="savings"?' font-weight="600"':'';
      s+=`<text x="${n.x1+8}" y="${cy}" dominant-baseline="middle"${bold}>${n.name} <tspan class="val">${fmt(n.value)}</tspan></text>`;
    }
  });
  document.getElementById("sankey").innerHTML=s;
}

