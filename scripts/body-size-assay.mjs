import fs from 'node:fs';
import path from 'node:path';
import {World} from '../dist/engine.js';
import {phenotype,traitClosure} from '../dist/biology.js';
import {develop} from '../dist/development.js';
import {allocation,uptake,metabolicInvestment} from '../dist/metabolism.js';
import {balances,injectLife,N_RATIO,FOOD_SOURCES} from '../dist/ecology.js';

// A small fixed-background size matrix, not a search for fitness maxima.
const args={},allowed=new Set(['out','seeds','steps','sample']);
for(const text of process.argv.slice(2)){const match=/^--([^=]+)=(.+)$/.exec(text);if(!match||!allowed.has(match[1]))throw new Error('Use --name=value: '+[...allowed].join(', '));args[match[1]]=match[2];}
const out=path.resolve(args.out||'../v7-study/body-size'),seeds=(args.seeds||'ORIGIN-042,DELTA-103').split(','),steps=Number(args.steps||3000),sampleEvery=Number(args.sample||150);
if(!Number.isInteger(steps)||steps<1||!Number.isInteger(sampleEvery)||sampleEvery<1)throw new Error('steps and sample must be positive integers');
const genes=[.9,0,0,.35,.15,.4,.46,.5,.5,.45,.1,.6,0,0],levels=[.1,.5,.9],plans=[];
for(const seed of seeds){for(const length of levels)for(const width of levels)plans.push({seed,variant:'single',length,width});for(const variant of ['colony','tissue'])plans.push({seed,variant,length:.5,width:.5});}
const config={founders:0,origin:false,mutation:0,reproductionMode:'asexual',volatility:0,fiction:false,light:1,resources:1};
const metadata={created:new Date().toISOString(),modelVersion:6,seeds,steps,sampleEvery,plans,genes,shapeLevels:levels,otherShapeValues:.5,config,founders:26,initialReserve:17,
 design:'Matches the environment-assay pure-photo background and dispersed aquatic starting sites. Single bodies vary only shape[0] and shape[1] over a 3×3 grid. Colony and tissue references retain all shape parameters at 0.5 and mature at four units. Each condition is an independent monoculture.',
 exposureDefinition:'Before every step, sum bodyEnergy of all living individuals. Integrating that start-of-step stock gives body-material-energy × time, the denominator for cumulative intake and expenditure per unit material-step. This is a discrete stock exposure, not an exact continuous integral within the sequential step.',
 idealBudgetDefinition:'A diagnostic ceiling for uniform unlimited-nutrient aquatic patches with light 1, photons 0.34, no crowding, no boundaries: photon access is 0.34 × mass^(2/3), capped by actual uptake demand, then multiplied by photosynthesis efficiency 0.86. Awake maintenance uses the current engine formula. These ceilings are not the experienced field conditions.',
 limitations:['Independent cultures test ecological feasibility and yield; they do not establish competitive replacement, invasion fitness or stable coexistence.','Different body sizes require different initial material inputs, explicitly recorded. Initial count and reserve are equal; material is not artificially equalized. Late-window rates reduce but do not eliminate initial-condition effects.','All clones retain pigment and lack predation investment. This isolates one photosynthetic background, not all strategies or habitats.','Only two terrain seeds are repeated. The shape values are deliberately sparse; this is not parameter optimization.','Body size is continuous inherited geometry. A large single remains a single, and is never counted as morphological complexity.','Body-material energy is a model proxy, not grams or cell count. Growth and reproduction ledgers include material/reserve transfers, not only ecosystem heat losses.','Rates are weighted by realized material exposure, including individuals that die. Intra-step death and birth occur sequentially; the denominator uses a stated discrete convention.','Capacity or extinction ends a run; late-window rates are omitted if the full window was not completed.']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(out,'results.jsonl'),'');
const keys=['intake','maintenance','movement','growth','reproduction','hunting','stress'],results=[];
const sum=(values,get)=>values.reduce((total,value)=>total+get(value),0);
function idealBudget(shape,traits,cells){
 const a={genes,shape,traits,cells,form:phenotype(traits)};a.development=develop(a,cells);const d=a.development,budget=allocation(a),demand=uptake(a,{light:1,land:false,height:0,vent:0},.57,0,budget).photons;
 const maintenanceBase=.047+metabolicInvestment(a,budget)+genes[4]**2*.016+genes[5]**2*.012+genes[7]**2*.02+genes[9]**2*.013+genes[11]**2*.011+genes[8]**2*.014+a.form.cost+d.cost;
 const maintenance=maintenanceBase*(.8+.2*d.unitMass**.75)*cells,intake=Math.min(.34*d.mass**(2/3),demand)*.86;
 return {cells,unitMass:d.unitMass,totalMass:d.mass,bodyMaterial:2*d.mass,footprintAreaInFieldCells:d.mass**(2/3),uptakeSurface:d.surface,photonDemand:demand,accessiblePhotonCeiling:.34*d.mass**(2/3),intakeCeiling:intake,maintenance,maintenancePerMaterial:maintenance/(2*d.mass),intakeCeilingPerMaterial:intake/(2*d.mass),intakeToMaintenance:intake/maintenance};
}
for(const plan of plans){
 const start=performance.now(),world=new World({...config,seed:plan.seed}),shape=Array(8).fill(.5);shape[0]=plan.length;shape[1]=plan.width;
 const traits=traitClosure(['pigment',...(plan.variant==='single'?[]:[plan.variant])]),species=world.createSpecies(genes,null,shape),sites=world.fields.filter(f=>!f.land),founderIds=[];species.discovered=[...traits];
 let initialReserve=0,initialBody=0,individualSteps=0,materialSteps=0;
 for(let i=0;i<26;i++){const f=sites[Math.floor((i+.5)*sites.length/26)],a=world.makeAgent(species,f.x,f.y,genes,traits,0,17,shape);world.agents.push(a);injectLife(world,a);founderIds.push(a.id);initialReserve+=a.energy;initialBody+=a.bodyEnergy;}
 world.liveCount=world.agents.length;world.census();world.reindex();
 const trajectory=[],audit={samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,nonFinite:0,peakPopulation:26};
 function snapshot(){
  const records=Object.values(world.records),accounts=Object.fromEntries(keys.map(key=>[key,sum(records,r=>r.energy[key])])),sources=Object.fromEntries(FOOD_SOURCES.map(key=>[key,sum(records,r=>r.energy.sources[key])])),balance=balances(world);
  audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(balance.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(balance.nutrientError));audit.nonFinite+=Object.values(balance).filter(value=>!Number.isFinite(value)).length;
  if(audit.nonFinite||Math.abs(balance.energyError)>.001||Math.abs(balance.nutrientError)>.0001)throw new Error('Resource accounting failed');
  const counts={};for(const a of world.agents)counts[a.cells]=(counts[a.cells]||0)+1;
  const result={tick:world.tick,population:world.agents.length,births:world.totalBirths,deaths:world.totalDeaths,aliveFounders:world.agents.filter(a=>founderIds.includes(a.id)).length,aliveDescendants:world.agents.filter(a=>!founderIds.includes(a.id)).length,maxGeneration:Math.max(...records.map(r=>r.generation)),currentReserve:sum(world.agents,a=>a.energy),currentBody:sum(world.agents,a=>a.bodyEnergy),cells:counts,individualSteps,materialSteps,accounts,sources,balance};
  trajectory.push(result);return result;
 }
 snapshot();let stop='horizon';
 while(world.tick<steps){
  individualSteps+=world.agents.length;materialSteps+=sum(world.agents,a=>a.bodyEnergy);world.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);
  const terminated=world.saturated?'capacity':!world.agents.length?'extinction':null;
  if(world.tick%sampleEvery===0||world.tick===1500||world.tick===steps||terminated)snapshot();
  if(terminated){stop=terminated;break;}
 }
 function window(from,to){
  const a=trajectory.find(s=>s.tick===from),b=trajectory.find(s=>s.tick===to);if(!a||!b)return null;
  const material=b.materialSteps-a.materialSteps,individual=b.individualSteps-a.individualSteps,accounts=Object.fromEntries(keys.map(key=>[key,b.accounts[key]-a.accounts[key]]));
  return {from,to,populationStart:a.population,populationEnd:b.population,births:b.births-a.births,deaths:b.deaths-a.deaths,materialSteps:material,individualSteps:individual,accounts,perMaterialStep:Object.fromEntries(keys.map(key=>[key,material?accounts[key]/material:null])),perIndividualStep:Object.fromEntries(keys.map(key=>[key,individual?accounts[key]/individual:null])),operatingSurplusPerMaterialStep:material?(accounts.intake-accounts.maintenance-accounts.movement-accounts.hunting-accounts.stress)/material:null,birthsPer1000MaterialSteps:material?(b.births-a.births)/material*1000:null};
 }
 const final=trajectory.at(-1),records=Object.values(world.records),founders=founderIds.map(id=>world.records[id]),requiredCells=plan.variant==='single'?1:4;
 const result={...plan,shape,traits,genes,config:world.config,requestedSteps:steps,actualSteps:world.tick,termination:stop,initial:{individuals:26,reserve:initialReserve,bodyMaterial:initialBody,totalEnergy:initialReserve+initialBody,totalNutrient:(initialReserve+initialBody)*N_RATIO},idealBudgets:{atBirth:idealBudget(shape,traits,1),atMaturity:idealBudget(shape,traits,requiredCells)},audit,final,
  lifeHistory:{requiredCells,matured:requiredCells===1?records.length:records.filter(r=>r.lifeHistory.matureAt!==null).length,foundersMatured:requiredCells===1?26:founders.filter(r=>r.lifeHistory.matureAt!==null).length,parents:records.filter(r=>r.offspring.length).length,founderParents:founders.filter(r=>r.offspring.length).length,firstBirth:records.filter(r=>r.parents.length).reduce((v,r)=>Math.min(v,r.born),Infinity),divisions:sum(records,r=>r.lifeHistory.divisions),releases:sum(records,r=>r.lifeHistory.releases),materialTransferred:sum(records,r=>r.lifeHistory.materialFromParent),deathsByCause:Object.fromEntries(['饥饿','衰老','捕食','灾变'].map(cause=>[cause,records.filter(r=>r.death?.cause===cause).length]))},
  cumulative:window(0,world.tick),late:window(1500,3000),trajectory,elapsedMs:performance.now()-start};
 if(!Number.isFinite(result.lifeHistory.firstBirth))result.lifeHistory.firstBirth=null;
 results.push(result);fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(result)+'\n');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({run:results.length,total:plans.length,...plan,tick:world.tick,stop,population:final.population,births:final.births,material:final.currentBody,lateIntakePerMaterialStep:result.late?.perMaterialStep.intake,lateMaintenancePerMaterialStep:result.late?.perMaterialStep.maintenance,seconds:+(result.elapsedMs/1000).toFixed(2)}));
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(results.map(({trajectory,...r})=>r),null,2));
