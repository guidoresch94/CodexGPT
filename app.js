const I18N = {
  es: {
    title: "Planificador 24h · Camiones de Sal",
    lang: "Idioma",
    production: "Producción",
    grams: "Gramos/pastilla",
    initialInv: "Inventario inicial (t)",
    truckCap: "Capacidad camión (t)",
    machines: "Máquinas",
    machineCount: "Máquinas activas (0–10)",
    uniformSpeed: "Velocidad uniforme (u/h)",
    turns: "Turnos y viajes",
    gantt: "Gantt 24h",
    inv: "Inventario 72h",
    kpis: "KPIs",
    pills: "Pastillas",
    fine: "Fina",
    consumption: "Consumo (t/h)",
    pillsHour: "Pastillas/h",
    trucksP: "Camiones pastillas",
    tonsDay: "Ton útiles pastillas",
    downtime: "Downtime (min)",
  },
  en: {
    title: "24h Planner · Salt Trucks",
    lang: "Language",
    production: "Production",
    grams: "Grams/tablet",
    initialInv: "Initial inventory (t)",
    truckCap: "Truck capacity (t)",
    machines: "Machines",
    machineCount: "Active machines (0–10)",
    uniformSpeed: "Uniform speed (u/h)",
    turns: "Shifts and trips",
    gantt: "24h Gantt",
    inv: "72h Inventory",
    kpis: "KPIs",
    pills: "TABLETS",
    fine: "FINE SALT",
    consumption: "Consumption (t/h)",
    pillsHour: "TABLETS/h",
    trucksP: "TABLETS trucks",
    tonsDay: "Useful tons TABLETS",
    downtime: "Downtime (min)",
  },
};
const mm=(h,m=0)=>h*60+m, D=1440;
const fmt=(mins)=>`${String(Math.floor((((mins/60)%24)+24)%24)).padStart(2,'0')}:${String(Math.floor(((mins%60)+60)%60)).padStart(2,'0')}`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const state={
  lang:'es', grams:14.5, initialInv:25, truckCap:25, machineCount:7, uniformSpeed:120000,
  machines:[...Array(7)].map((_,i)=>({id:i===6?'KORSCH':`KILIAN ${i+1}`,speed:i===6?150000:120000})),
  missionDefs:{ pastillas:[30,100,30,45], fina:[30,60,30,30] },
  turns:[
    {truckId:'Camión 1', blocks:[{start:mm(6),duration:480,trips:[{product:'fina'}]},{start:mm(14),duration:480,trips:[]},{start:mm(22),duration:480,trips:[]}]},
    {truckId:'Camión 2', blocks:[{start:mm(7),duration:480,trips:[{product:'pastillas'}]},{start:mm(14),duration:480,trips:[]},{start:mm(22),duration:480,trips:[]}]},
    {truckId:'Camión 3', blocks:[{start:mm(6),duration:480,trips:[]},{start:mm(14),duration:480,trips:[]},{start:mm(22),duration:480,trips:[]}]},
  ]
};
function ensureMachines(){
  state.machines=state.machines.slice(0,state.machineCount);
  while(state.machines.length<state.machineCount){const i=state.machines.length;state.machines.push({id:i===6?'KORSCH':`KILIAN ${i+1}`,speed:120000});}
}
function buildPlan(){
  const tripsByTruck={};
  for(const t of state.turns){
    for(const b of t.blocks){
      let acc=0;
      for(const tr of b.trips){
        const seg=state.missionDefs[tr.product];
        (tripsByTruck[t.truckId]??=[]).push({product:tr.product,d1:seg[0],d2:seg[1],d3:seg[2],d4:seg[3],notBefore:b.start+acc});
        acc+=seg.reduce((a,b)=>a+b,0);
      }
    }
  }
  const trucks=Object.keys(tripsByTruck).map(id=>({id,list:tripsByTruck[id],idx:0,availableAt:0}));
  let loadFreeAt=0, unloadFreeAt=0; const missions=[], unloads=[];
  while(true){
    const cands=trucks.map(tk=>{const tr=tk.list[tk.idx]; if(!tr)return null; const s=Math.max(tk.availableAt,tr.notBefore); return {tk,tr,s,arr:s+tr.d1};}).filter(Boolean);
    if(!cands.length) break;
    cands.sort((a,b)=>a.arr-b.arr); const {tk,tr,s}=cands[0];
    const e1=s+tr.d1, s2=Math.max(e1,loadFreeAt), e2=s2+tr.d2, s3=e2, e3=s3+tr.d3, s4=Math.max(e3,unloadFreeAt), e4=s4+tr.d4;
    loadFreeAt=e2; unloadFreeAt=e4;
    missions.push({truckId:tk.id,product:tr.product,start:s%D,end:e4%D,load:[s2%D,e2%D],unload:[s4%D,e4%D]});
    if(tr.product==='pastillas'){ const dur=Math.max(1,e4-s4),n=Math.max(1,Math.ceil(dur/5)),per=state.truckCap/n; for(let i=1;i<=n;i++) unloads.push({time:(s4+Math.min(i*5,dur))%D,tons:per}); }
    tk.availableAt=e4; tk.idx++;
  }
  const totalU=state.machines.reduce((a,m)=>a+(m.speed||0),0), consTph=(totalU*state.grams)/1_000_000;
  const inv=[]; let cur=state.initialInv; const arr=unloads.slice().sort((a,b)=>a.time-b.time);
  for(let x=0;x<=3*D;x+=5){ const t=x%D; for(const u of arr) if(u.time===t) cur+=u.tons; if(x>0) cur=Math.max(0,cur-(consTph/60)*5); inv.push({x,tons:cur}); }
  return {missions,inv,kpis:{consTph:consTph.toFixed(3),pillsHour:Math.floor((consTph*1_000_000)/state.grams),trucksP:missions.filter(m=>m.product==='pastillas').length,tonsDay:missions.filter(m=>m.product==='pastillas').length*state.truckCap,downtime:inv.filter(p=>p.tons<=0).length*5}};
}
function render(){
  ensureMachines();
  const t=I18N[state.lang];
  title.textContent=t.title;langLabel.textContent=t.lang;productionTitle.textContent=t.production;gramsLabel.textContent=t.grams;initialInvLabel.textContent=t.initialInv;truckCapLabel.textContent=t.truckCap;
  machinesTitle.textContent=t.machines;machineCountLabel.textContent=t.machineCount;uniformSpeedLabel.textContent=t.uniformSpeed;turnsTitle.textContent=t.turns;ganttTitle.textContent=t.gantt;invTitle.textContent=t.inv;kpiTitle.textContent=t.kpis;

  machinesTable.innerHTML=state.machines.map((m,i)=>`<div class='row small'><span style='min-width:90px'>${m.id}</span><input data-mi='${i}' type='number' value='${state.uniformSpeed}'/></div>`).join('');

  turnsTable.innerHTML=state.turns.map((tr,ti)=>`<div class='card'><b>${tr.truckId}</b>${tr.blocks.map((b,bi)=>`<div class='row small'>Shift ${bi+1} ${fmt(b.start)}-${fmt((b.start+b.duration)%D)}: ${b.trips.length} trips <button data-add='${ti}-${bi}'>+${t.pills}</button> <button data-addf='${ti}-${bi}'>+${t.fine}</button></div>`).join('')}</div>`).join('');

  const plan=buildPlan();
  const byTruck={}; for(const m of plan.missions){(byTruck[m.truckId]??=[]).push(m);}  
  gantt.innerHTML=Object.entries(byTruck).map(([id,list])=>`<div class='gantt-row'><div class='small'><b>${id}</b></div><div class='track'>${list.map(m=>{const l=m.start/D*100,w=((m.end-m.start+D)%D)/D*100, ll=m.load[0]/D*100, lw=((m.load[1]-m.load[0]+D)%D)/D*100, ul=m.unload[0]/D*100, uw=((m.unload[1]-m.unload[0]+D)%D)/D*100; return `<div class='seg ${m.product}' style='left:${l}%;width:${w}%' title='${m.product}'></div><div class='seg load' style='left:${ll}%;width:${lw}%'></div><div class='seg unload' style='left:${ul}%;width:${uw}%'></div>`;}).join('')}</div></div>`).join('') || '<div class="small">Sin misiones</div>';

  const c=invChart.getContext('2d'); c.clearRect(0,0,invChart.width,invChart.height); c.strokeStyle='#d0d7e5'; c.strokeRect(40,10,940,240);
  const maxT=Math.max(1,...plan.inv.map(p=>p.tons)); c.strokeStyle='#1976d2'; c.beginPath(); plan.inv.forEach((p,i)=>{const x=40+(p.x/(3*D))*940,y=250-(p.tons/maxT)*220; if(i===0)c.moveTo(x,y); else c.lineTo(x,y);}); c.stroke();

  kpis.innerHTML=[
    [t.consumption,plan.kpis.consTph],
    [t.pillsHour,plan.kpis.pillsHour.toLocaleString()],
    [t.trucksP,plan.kpis.trucksP],
    [t.tonsDay,plan.kpis.tonsDay],
    [t.downtime,plan.kpis.downtime],
  ].map(([k,v])=>`<div class='kpi'><div class='small'>${k}</div><b>${v}</b></div>`).join('');

  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const [ti,bi]=b.dataset.add.split('-').map(Number);state.turns[ti].blocks[bi].trips.push({product:'pastillas'});render();});
  document.querySelectorAll('[data-addf]').forEach(b=>b.onclick=()=>{const [ti,bi]=b.dataset.addf.split('-').map(Number);state.turns[ti].blocks[bi].trips.push({product:'fina'});render();});
  document.querySelectorAll('[data-mi]').forEach(i=>i.onchange=e=>{state.uniformSpeed=Number(e.target.value||0); state.machines.forEach(m=>m.speed=state.uniformSpeed); render();});
}
lang.onchange=e=>{state.lang=e.target.value;render();};
grams.onchange=e=>{state.grams=Number(e.target.value||0);render();};
initialInv.onchange=e=>{state.initialInv=Number(e.target.value||0);render();};
truckCap.onchange=e=>{state.truckCap=Number(e.target.value||0);render();};
machineCount.onchange=e=>{state.machineCount=clamp(Number(e.target.value||0),0,10);render();};
uniformSpeed.onchange=e=>{state.uniformSpeed=Number(e.target.value||0); state.machines.forEach(m=>m.speed=state.uniformSpeed); render();};
render();
