//============ RENDER ALL ============
function renderAll(){
  const sim=simulate();
  renderSankey(sim.alloc[sankeyMonth]||{}, sankeyMonth);
  renderGantt(sim);
  renderHeaderStats();
  renderBudgetWidget();
  renderSankeyNote();
  renderFire();
  persist();
}

//============ APPLY AND RENDER ============
function applyAndRender(){
  renderHeaderStats();
  renderSankeyNote();
  renderAll();
  renderNW();
  renderDebts();
  renderAssets();
  renderInputs();
  renderFireImpact();
  renderFreedom();
}

