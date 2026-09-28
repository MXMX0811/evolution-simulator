// A fixed-composition organic pool. N is an abstract conserved nutrient, not real chemistry.
export const N_RATIO=.035;
export function inventory(w){
 let organic=0,redox=0,nutrient=0;for(const f of w.fields){organic+=f.plankton+f.detritus;redox+=f.redox;nutrient+=f.nutrient;}
 for(const a of w.agents)if(a.alive)organic+=a.energy+a.bodyEnergy;
 return {organic,redox,energy:organic+redox,nutrient:nutrient+organic*N_RATIO};
}
export function initializeEcology(w){w.ecology={initial:inventory(w),energyIn:0,nutrientIn:0,heat:0,energyOut:0,nutrientOut:0,photo:0,chemical:0,recycled:0};w.foodWeb={};}
export function balances(w){const now=inventory(w),e=w.ecology;return {...now,energyError:now.energy-e.initial.energy-e.energyIn+e.heat+e.energyOut,nutrientError:now.nutrient-e.initial.nutrient-e.nutrientIn+e.nutrientOut};}
export function recordFlow(w,source,consumer,amount){if(amount<=0)return;const key=source+'>'+consumer;let flow=w.foodWeb[key];if(!flow)flow=w.foodWeb[key]={source:String(source),consumer:String(consumer),amount:0,tick:w.tick};flow.amount*=Math.exp(-(w.tick-flow.tick)/600);flow.amount+=amount;flow.tick=w.tick;}
export function recentFlows(w){return Object.values(w.foodWeb).map(f=>({...f,amount:f.amount*Math.exp(-(w.tick-f.tick)/600)})).filter(f=>f.amount>.015).sort((a,b)=>b.amount-a.amount);}
export function injectLife(w,a){const amount=a.energy+a.bodyEnergy;w.ecology.energyIn+=amount;w.ecology.nutrientIn+=amount*N_RATIO;}
export function dissipate(w,f,amount){w.ecology.heat+=amount;f.nutrient+=amount*N_RATIO;}
export function spend(w,a,amount,category='maintenance'){const paid=Math.min(a.energy,Math.max(0,amount));a.energy-=paid;a.energyLedger[category]+=paid;dissipate(w,w.fieldAt(a.x,a.y),paid);return paid;}
export function synthesize(w,a,f,source,demand,efficiency){
 const room=Math.max(0,42+a.form.storage-a.energy),gain=Math.max(0,Math.min(demand*efficiency,f[source]*efficiency,f.nutrient/N_RATIO,room));
 const absorbed=gain/efficiency;f[source]-=absorbed;f.nutrient-=gain*N_RATIO;a.energy+=gain;a.energyLedger.intake+=gain;
 w.ecology.heat+=absorbed-gain;if(source!=='redox')w.ecology.energyIn+=absorbed;
 w.ecology[source==='redox'?'chemical':'photo']+=gain;recordFlow(w,source,a.species,gain);return gain;
}
export function ingest(w,a,f,source,demand,efficiency){
 const eaten=Math.max(0,Math.min(f[source],demand,Math.max(0,42+a.form.storage-a.energy)/efficiency));
 const gain=eaten*efficiency;f[source]-=eaten;f.detritus+=eaten-gain;a.energy+=gain;a.energyLedger.intake+=gain;recordFlow(w,source,a.species,gain);return gain;
}
export function recycleBody(w,a){const f=w.fieldAt(a.x,a.y);f.detritus+=a.energy+a.bodyEnergy;a.energy=0;a.bodyEnergy=0;}
export function preySuitability(a,b){const ratio=b.development.mass/a.development.mass;return Math.exp(-(Math.log(ratio/.65)**2)/(2*.95**2));}
export function eatPrey(w,a,b){
 const available=b.energy+b.bodyEnergy,efficiency=Math.min(.9,.58+a.form.digest+(a.traits.includes('oxygen')?w.oxygen*.14:0));
 const gain=Math.min(available*efficiency,Math.max(0,42+a.form.storage-a.energy));
 a.energy+=gain;a.energyLedger.intake+=gain;w.fieldAt(b.x,b.y).detritus+=available-gain;b.energy=0;b.bodyEnergy=0;
 recordFlow(w,b.species,a.species,gain);return gain;
}
export function advanceResources(w,cols,rows){
 const ledger=w.ecology;
 for(const f of w.fields){
  // Dissolved nutrient and chemical potential enter from weathering and vents.
  const supply=w.environment.resources,ni=supply*(.00016+f.vent*.0012)*(f.land?.6:1),ri=supply*(.0008+f.vent*.027)*(f.land?.2:1);
  f.nutrient+=ni;f.redox+=ri;ledger.nutrientIn+=ni;ledger.energyIn+=ri;
  // Exchange with the larger ocean is an explicit export, never an unrecorded cap.
  const no=f.nutrient*.0007,ro=f.redox*.0012;f.nutrient-=no;f.redox-=ro;ledger.nutrientOut+=no;ledger.energyOut+=ro;
  f.photons=Math.max(0,f.light*.34);f.radiant=w.environment.radiation*.24;
  const growth=Math.min(f.photons*.075,f.nutrient/N_RATIO,Math.max(0,.7-f.plankton)*.022)*(f.land?.12:1);
  f.photons-=growth;f.nutrient-=growth*N_RATIO;f.plankton+=growth;ledger.energyIn+=growth;ledger.photo+=growth;
  const decay=f.detritus*Math.min(.025,.0028*Math.pow(1.6,(f.temp-20)/20));f.detritus-=decay;dissipate(w,f,decay);ledger.recycled+=decay;
  const mortality=f.plankton*.0015;f.plankton-=mortality;f.detritus+=mortality;
 }
 diffuseResources(w.fields,cols,rows);
}
export function diffuseResources(fields,cols,rows){
 // Pairwise exchange reads the old pools and applies a separate delta buffer.
 const keys=['nutrient','redox','plankton','detritus'],rates=[.035,.025,.012,.004],delta=new Float64Array(fields.length*4);
 for(let i=0;i<fields.length;i++)for(const j of [(i%cols<cols-1)?i+1:-1,(i<cols*(rows-1))?i+cols:-1])if(j>=0){const a=fields[i],b=fields[j],permeability=a.land!==b.land?.12:a.land?.3:1;for(let k=0;k<4;k++){const flow=(a[keys[k]]-b[keys[k]])*rates[k]*permeability;delta[i*4+k]-=flow;delta[j*4+k]+=flow;}}
 for(let i=0;i<fields.length;i++)for(let k=0;k<4;k++)fields[i][keys[k]]+=delta[i*4+k];
}
