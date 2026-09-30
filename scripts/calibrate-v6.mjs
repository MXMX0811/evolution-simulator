import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Observational assays, not a fitness function. Run mechanism versions explicitly.
// node scripts/calibrate-v6.mjs --out=../v6-study/current --mode=all
// node scripts/calibrate-v6.mjs --version=5 --engine=../v6-study/baseline/dist/engine.js --out=../v6-study/baseline-results --mode=long
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(['out','engine','version','mode','seeds','horizons','sample','assay-seeds','conditions','resident-steps','invasion-steps']);
const args={};
for(const argument of process.argv.slice(2)){
 const match=/^--([^=]+)=(.+)$/.exec(argument);
 if(!match||!allowed.has(match[1]))throw new Error('Use --name=value. Arguments: '+[...allowed].join(', '));
 args[match[1]]=match[2];
}
if(!args.out)throw new Error('--out is required; use an experiment directory outside the project, e.g. --out=../v6-study/current');
const version=Number(args.version||6),mode=args.mode||'all';
if(![5,6].includes(version))throw new Error('--version must explicitly identify model 5 or 6');
if(!['long','invasion','all'].includes(mode))throw new Error('--mode must be long, invasion or all');
function positive(value,name){const number=Number(value);if(!Number.isInteger(number)||number<1)throw new Error(name+' must be a positive integer');return number;}
const out=path.resolve(args.out),engine=path.resolve(args.engine||path.join(project,'dist/engine.js')),source=path.dirname(engine);
const seeds=(args.seeds||'ORIGIN-042,DELTA-103,EDEN-221,STUDY-004').split(',');
const horizons=[...new Set((args.horizons||'6000,12000').split(',').map(value=>positive(value,'horizons')))].sort((a,b)=>a-b);
const sampleEvery=positive(args.sample||120,'sample');
const assaySeeds=(args['assay-seeds']||'ORIGIN-042,DELTA-103').split(',');
const residentSteps=positive(args['resident-steps']||1200,'resident-steps'),invasionSteps=positive(args['invasion-steps']||1200,'invasion-steps');
const conditions={mixed:{light:1,resources:1},bright:{light:1.6,resources:1},dim:{light:.35,resources:1}};
const chosen=(args.conditions||'mixed,bright,dim').split(',');
for(const name of chosen)if(!Object.hasOwn(conditions,name))throw new Error('Unknown assay condition '+name);
const {World}=await import(pathToFileURL(engine));
const {balances,recentFlows,injectLife}=await import(pathToFileURL(path.join(source,'ecology.js')));
const {GENES,TRAITS,DEFAULTS}=await import(pathToFileURL(path.join(source,'biology.js')));
// A versioned experiment branch: the v5 baseline predates the v6 diagnostics.
let diagnoseWorld;
if(version===6){({diagnoseWorld}=await import(pathToFileURL(path.join(source,'diagnostics.js'))));if(GENES.length!==14)throw new Error('v6 assay expects its 14-locus genome');}
if(version===5&&GENES.length!==12)throw new Error('v5 baseline expects its 12-locus genome');
fs.mkdirSync(out,{recursive:true});
const metadata={created:new Date().toISOString(),version,engine,mode,seeds,horizons,sampleEvery,defaults:DEFAULTS,
 invasion:{seeds:assaySeeds,conditions:Object.fromEntries(chosen.map(name=>[name,conditions[name]])),residentSteps,invasionSteps,residentFounders:52,invaders:8,
  mutation:0,reproductionMode:'asexual',volatility:0,initialReserve:17,shape:Array(8).fill(.5),
  note:'Each direction establishes its own resident. Both strategies are exact clones, introduced as independent origins. Invaders are external biomass recorded by injectLife. Local light/depth/vents still vary; mixed means the normal spatial world, not uniform resources. Initial introduction must be <=10% to be described as rare. Resident establishment for 1,200 steps is not proof of ecological equilibrium.'},
 limitations:['Metrics describe this model, not biological parameter estimates.','Version changes also change random trajectories; equal seeds are not paired ecological replicates.','Finite coexistence is not indefinite coexistence. A positive invader trajectory alone does not prove mutual invasibility.','Experiments stop at the explicit computation capacity or extinction. No labels are protected or replenished.','Maximum absolute balance errors are checked at recorded samples, not every intermediate time step.']};
fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
fs.writeFileSync(path.join(out,'results.jsonl'),'');
const results=[];
function writeResult(result){
 results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(result)+'\n');
}
function distribution(values){
 const counts=new Map();for(const value of values)counts.set(value,(counts.get(value)||0)+1);
 const n=values.length,rows=[...counts].map(([id,count])=>({id,count,share:count/n})).sort((a,b)=>b.count-a.count);
 return {richness:rows.length,effective:n?Math.exp(-rows.reduce((sum,row)=>sum+row.share*Math.log(row.share),0)):0,rows};
}
function baselineTraits(world){
 const rows=TRAITS.map(trait=>({id:trait.id,name:trait.name,stage:trait.stage,birthCarriers:0,livingCarriers:0,parents:0,transmittedBirths:0,mutationGains:0,mutationLosses:0,dependencyLosses:0,firstAppearanceTick:null}));
 const byId=new Map(rows.map(row=>[row.id,row]));
 for(const agent of world.agents)for(const id of agent.traits)byId.get(id).livingCarriers++;
 for(const record of Object.values(world.records)){
  for(const id of record.traits){const row=byId.get(id);row.birthCarriers++;if(record.offspring.length)row.parents++;if(row.firstAppearanceTick===null)row.firstAppearanceTick=record.born;}
  if(record.mode==='founder')continue;
  const changes=record.inheritance.changes;
  for(const trait of record.inheritance.traits)if(trait.retained&&trait.parents.length&&!changes.some(change=>change.kind==='trait'&&change.id===trait.id&&change.cause==='mutation-gain'))byId.get(trait.id).transmittedBirths++;
  for(const change of changes)if(change.kind==='trait'){
   const row=byId.get(change.id);
   if(change.cause==='mutation-gain')row.mutationGains++;
   if(change.cause==='mutation-loss')row.mutationLosses++;
   if(change.cause==='dependency-loss')row.dependencyLosses++;
  }
 }
 return {scope:'cumulative-birth-archive',rows:rows.filter(row=>row.birthCarriers||row.mutationGains)};
}
function flowReport(world){
 const totals=new Map();for(const flow of recentFlows(world)){const id=/^\d+$/.test(flow.source)?'prey':flow.source;totals.set(id,(totals.get(id)||0)+flow.amount);}
 const total=[...totals.values()].reduce((sum,amount)=>sum+amount,0);
 return {scope:'recent-decayed-including-dead',decaySteps:600,total,sources:[...totals].map(([id,amount])=>({id,amount,share:amount/total})).sort((a,b)=>b.amount-a.amount)};
}
function snapshot(world){
 const living=world.agents.filter(agent=>agent.alive),population=living.length;
 const deaths=Object.fromEntries(['饥饿','衰老','捕食','灾变'].map(cause=>[cause,world.species.reduce((sum,species)=>sum+species.deathCauses[cause],0)]));
 const common={tick:world.tick,population,historicalLabels:world.species.length,labels:distribution(living.map(agent=>agent.species)),origins:distribution(living.map(agent=>agent.origin)),
  births:world.totalBirths,deaths:world.totalDeaths,crossovers:world.totalCrossovers,mutations:world.totalMutations,
  maxGeneration:population?Math.max(...living.map(agent=>agent.generation)):null,meanGeneration:population?living.reduce((sum,agent)=>sum+agent.generation,0)/population:null,
  deathCauses:deaths,capacity:{limit:world.capacity,reached:world.saturated},balance:balances(world),networkFeeding:flowReport(world)};
 if(version===5){
  return {...common,topologies:distribution(living.map(agent=>agent.development.topology)),
   colonies:{livingWithColonyTrait:living.filter(agent=>agent.traits.includes('colony')).length,physicalGroups:null,cells:null,note:'v5 has no physical cell-count lifecycle'},traits:baselineTraits(world)};
 }
 const diagnostic=diagnoseWorld(world);
 return {...common,labels:diagnostic.diversity.labels,feeding:diagnostic.feeding,topologies:diagnostic.morphology.topologies,
  colonies:{livingWithColonyTrait:living.filter(agent=>agent.traits.includes('colony')).length,physicalGroups:diagnostic.morphology.colonies,cells:diagnostic.morphology.cells},
  shape:diagnostic.morphology.shape,combinations:diagnostic.morphology.combinations,resources:diagnostic.resources,
  traits:{scope:diagnostic.traits.scope,records:diagnostic.traits.records,rows:diagnostic.traits.rows.filter(row=>row.encodedBirthCarriers||row.mutationGains)}};
}
function termination(world){return world.saturated?'capacity':world.originDone&&!world.agents.length?'extinction':null;}
function newAudit(){return {samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,peakPopulation:0,nonFiniteBalances:0};}
function auditSample(audit,world){
 const balance=balances(world);audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(balance.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(balance.nutrientError));
 audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);audit.nonFiniteBalances+=Object.values(balance).filter(value=>!Number.isFinite(value)).length;
}

if(mode==='long'||mode==='all')for(const seed of seeds){
 const start=performance.now(),world=new World({seed}),audit=newAudit(),samples=[],checkpoints=[];
 const targets=new Set(horizons);let end='horizon';
 function record(){const state=snapshot(world);auditSample(audit,world);samples.push({tick:state.tick,population:state.population,labels:state.labels.richness,effectiveLabels:state.labels.effective,births:state.births,maxGeneration:state.maxGeneration,topologies:state.topologies.rows,colonies:state.colonies,energyError:state.balance.energyError,nutrientError:state.balance.nutrientError});return state;}
 record();
 while(world.tick<horizons.at(-1)){
  world.stepOne();const stop=termination(world);
  if(world.tick%sampleEvery===0||targets.has(world.tick)||stop){
   const state=record();
   if(targets.has(world.tick)||stop){checkpoints.push(state);console.log(JSON.stringify({experiment:'long',version,seed,tick:world.tick,population:state.population,effectiveLabels:+state.labels.effective.toFixed(3),labels:state.labels.richness,colonies:state.colonies.physicalGroups,stop:stop||'checkpoint',elapsedSeconds:+((performance.now()-start)/1000).toFixed(1)}));}
  }
  if(stop){end=stop;break;}
 }
 const result={experiment:'long',version,seed,requestedHorizons:horizons,termination:end,elapsedMs:performance.now()-start,audit,checkpoints,samples};
 fs.writeFileSync(path.join(out,'long-'+seed+'.json'),JSON.stringify(result,null,2));writeResult(result);
}

// The assay uses fixed genomes. Synthetic strategies are controls, not mutation
// directions in the game and not evidence that the game evolved specialists.
function genome(strategy){
 const genes=[.1,.1,.03,.3,.15,.15,.46,.55,.45,.4,.1,.6,.05,.05];
 genes[strategy==='photo'?0:1]=.8;return version===5?genes.slice(0,12):genes;
}
function inoculate(world,strategy,count){
 const genes=genome(strategy),traits=[strategy==='photo'?'pigment':'vent'],shape=Array(8).fill(.5),species=world.createSpecies(genes,null,shape);
 species.discovered=[...traits];
 const sites=world.fields.filter(field=>!field.land);
 if(!sites.length)throw new Error('Invasion assay needs aquatic inoculation sites');
 const injected={individuals:count,energy:0};
 for(let i=0;i<count;i++){
  const site=sites[Math.floor((i+.5)*sites.length/count)],agent=world.makeAgent(species,site.x,site.y,genes,traits,0,17,shape);
  world.agents.push(agent);injectLife(world,agent);injected.energy+=agent.energy+agent.bodyEnergy;
 }
 world.liveCount=world.agents.length;world.census();world.reindex();
 world.recordEvent('origin','实验接种',`${strategy}: ${count} 个固定基因无性复制者，独立起源 ${species.origin}；注入能量与养分计入账本。`,species.id);
 return {origin:species.origin,label:species.id,genes,traits,injected};
}
function abundance(world,origin){return world.agents.filter(agent=>agent.alive&&agent.origin===origin).length;}
function finiteLogGrowth(final,initial,elapsed){return final>0&&initial>0&&elapsed>0?Math.log(final/initial)/elapsed:null;}
const invasionResults=[];
if(mode==='invasion'||mode==='all')for(const seed of assaySeeds)for(const condition of chosen)for(const resident of ['photo','chemo']){
 const start=performance.now(),invader=resident==='photo'?'chemo':'photo';
 const config={seed,origin:false,founders:0,mutation:0,reproductionMode:'asexual',volatility:0,fiction:false,...conditions[condition]};
 const world=new World(config),residentIdentity=inoculate(world,resident,52),audit=newAudit(),establishment=[];
 function residentSample(){auditSample(audit,world);establishment.push({tick:world.tick,population:abundance(world,residentIdentity.origin)});}
 residentSample();
 while(world.tick<residentSteps){world.stepOne();if(world.tick%sampleEvery===0||world.tick===residentSteps||termination(world))residentSample();if(termination(world))break;}
 const before=snapshot(world),residentBefore=abundance(world,residentIdentity.origin);
 if(termination(world)){
  const result={experiment:'invasion',version,seed,condition,resident,invader,config,residentIdentity,termination:'resident-'+termination(world),invaderIntroduced:false,before,audit,establishment,elapsedMs:performance.now()-start};
  writeResult(result);invasionResults.push(result);console.log(JSON.stringify({experiment:'invasion',version,seed,condition,resident,invader,status:result.termination}));continue;
 }
 const invaderIdentity=inoculate(world,invader,8),introductionTick=world.tick,initialInvaderShare=8/(residentBefore+8),rareAtIntroduction=initialInvaderShare<=.1,samples=[];
 function invasionSample(){const r=abundance(world,residentIdentity.origin),i=abundance(world,invaderIdentity.origin);auditSample(audit,world);samples.push({tick:world.tick,resident:r,invader:i,invaderShare:r+i?i/(r+i):null});}
 invasionSample();let end='horizon';
 while(world.tick<introductionTick+invasionSteps){
  world.stepOne();const stop=termination(world);
  if((world.tick-introductionTick)%sampleEvery===0||world.tick===introductionTick+invasionSteps||stop)invasionSample();
  if(stop){end=stop;break;}
 }
 world.census();const final=snapshot(world),finalResident=abundance(world,residentIdentity.origin),finalInvader=abundance(world,invaderIdentity.origin),elapsed=world.tick-introductionTick;
 const evidence={rareAtIntroduction,initialInvaderShare,residentBefore,initialInvaders:8,finalResident,finalInvader,
  invaderExtinct:finalInvader===0,residentExtinct:finalResident===0,
  invaderLogGrowthPerStep:finiteLogGrowth(finalInvader,8,elapsed),residentLogGrowthPerStep:finiteLogGrowth(finalResident,residentBefore,elapsed),
  logOddsChangePerStep:finalInvader&&finalResident&&elapsed?Math.log((finalInvader/finalResident)/(8/residentBefore))/elapsed:null,
  increasedFromRare:rareAtIntroduction&&end!=='capacity'&&finalInvader>8&&finalInvader/(finalResident+finalInvader)>initialInvaderShare,
  note:'Growth is per simulation step. Extinction rates are null rather than pseudocount-adjusted logarithms. Increased-from-rare is a finite-run observation, not proof of stable coexistence.'};
 const result={experiment:'invasion',version,seed,condition,resident,invader,config,residentIdentity,invaderIdentity,invaderIntroduced:true,introductionTick,termination:end,elapsedMs:performance.now()-start,evidence,audit,before,final,establishment,samples};
 writeResult(result);invasionResults.push(result);
 console.log(JSON.stringify({experiment:'invasion',version,seed,condition,resident,invader,rare:rareAtIntroduction,residentBefore,finalResident,finalInvader,increasedFromRare:evidence.increasedFromRare,stop:end,elapsedSeconds:+(result.elapsedMs/1000).toFixed(1)}));
}
if(invasionResults.length){
 const pairs=[];
 for(const seed of assaySeeds)for(const condition of chosen){
  const directions=invasionResults.filter(result=>result.seed===seed&&result.condition===condition);
  pairs.push({seed,condition,directions:directions.map(result=>({resident:result.resident,invader:result.invader,termination:result.termination,evidence:result.evidence})),
   bothDirectionsIncreaseFromRare:directions.length===2&&directions.every(result=>result.invaderIntroduced&&result.evidence.increasedFromRare),
   interpretation:'Descriptive two-direction outcome of finite assays. No claim of indefinite coexistence or equilibrium is made.'});
 }
 fs.writeFileSync(path.join(out,'invasion-pairs.json'),JSON.stringify(pairs,null,2));
}
