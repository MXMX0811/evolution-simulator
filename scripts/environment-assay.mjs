import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Fixed inherited backgrounds probe environmental feasibility; no organism is
// rewarded, rescued or replenished, and no simulation mechanism is modified.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args={};
const allowed=new Set(['out','engine','seeds','steps','sample','mode','conditions','variants','backgrounds']);
for(const argument of process.argv.slice(2)){
 const match=/^--([^=]+)=(.+)$/.exec(argument);
 if(!match||!allowed.has(match[1]))throw new Error('Use --name=value. Arguments: '+[...allowed].join(', '));
 args[match[1]]=match[2];
}
const engine=path.resolve(args.engine||path.join(project,'dist/engine.js')),out=path.resolve(args.out||path.join(project,'../v7-study/environment'));
const {World}=await import(pathToFileURL(engine));
const {GENES,TRAITS,DEFAULTS,traitClosure}=await import(pathToFileURL(path.join(path.dirname(engine),'biology.js')));
const {balances,injectLife,FOOD_SOURCES,N_RATIO}=await import(pathToFileURL(path.join(path.dirname(engine),'ecology.js')));
const {matureCells}=await import(pathToFileURL(path.join(path.dirname(engine),'life-history.js')));
const {expressStructures}=await import(pathToFileURL(path.join(path.dirname(engine),'heredity.js')));
const steps=Number(args.steps||3000),sampleEvery=Number(args.sample||150),mode=args.mode||'monoculture';
const seeds=(args.seeds||'ORIGIN-042,DELTA-103').split(','),variants=(args.variants||'single,colony,tissue').split(',');
const backgrounds=(args.backgrounds||'photo,chemo').split(','),selectedConditions=(args.conditions||'standard,geology,bright,vent-placement').split(',');
const baseGenes=[0,0,0,.35,.15,.4,.46,.5,.5,.45,.1,.6,0,0],shape=Array(8).fill(.5);
const profiles={photo:{genes:baseGenes.map((g,i)=>i===0?.9:g),traits:['pigment']},chemo:{genes:baseGenes.map((g,i)=>i===1?.9:g),traits:['vent']}};
const structures={single:[],colony:['colony'],tissue:['tissue'],bilateral:['bilateral'],radial:['radial']};
const conditions={standard:{light:1,resources:1,predators:0,placement:'dispersed'},geology:{light:1,resources:3,predators:0,placement:'dispersed'},bright:{light:1.6,resources:1,predators:0,placement:'dispersed'},predators:{light:1,resources:1,predators:6,placement:'dispersed'},'vent-placement':{light:1,resources:1,predators:0,placement:'vent'}};
const predator={genes:[0,0,.9,.65,.25,.1,.46,.5,.5,.65,.1,.5,0,0],traits:traitClosure(['engulf']),shape:Array(8).fill(.5)};
if(GENES.length!==14)throw new Error('This assay expects the v6 14-parameter genotype.');
if(!Number.isInteger(steps)||steps<1||!Number.isInteger(sampleEvery)||sampleEvery<1)throw new Error('steps/sample must be positive integers');
if(!['all','monoculture','competition'].includes(mode))throw new Error('mode must be all, monoculture or competition');
if(variants.some(key=>!Object.hasOwn(structures,key))||backgrounds.some(key=>!Object.hasOwn(profiles,key))||selectedConditions.some(key=>!Object.hasOwn(conditions,key)))throw new Error('Unknown variant, background or condition');
const metadata={created:new Date().toISOString(),modelVersion:6,engine,steps,sampleEvery,seeds,variants,backgrounds,selectedConditions,mode,defaults:DEFAULTS,
 structureRequirements:TRAITS.filter(t=>['colony','tissue','bilateral','radial'].includes(t.id)).map(t=>({id:t.id,gene:t.gene,minimum:t.min,cost:t.cost})),
 config:{mutation:0,volatility:0,reproductionMode:'asexual',fiction:false,founders:0,origin:false},profiles,shape,structures,conditions,predator,
 design:{monoculture:'26 exact clones, all born with one cell and 17 reserve. Only structural blueprint differs within an energy background. Compare every changed environment to standard for the same seed/background/variant.',competition:'13 single clones plus 13 challenger clones, same total initial count/reserve/material as a monoculture. Each pair shares a field centre; insertion order alternates by site. Independent origins prevent cross-mating and identify descendants. Primary competition matrix tests colony and tissue, in standard and predator conditions.',placement:'Dispersed founders use deterministic aquatic field quantiles. The vent-placement arm changes only starting sites to the highest-vent aquatic fields. Local temperature/depth covary with those positions; it does not isolate chemical concentration from other habitat properties.',predation:'Add six fixed predatory clones once at T0 near distributed prey sites. Predators are explicitly accounted external starting biomass. Never replace extinct predators or prey. Effects include actual predation, predator nutrient recycling and competition; report predator survival and prey deaths before interpreting pressure.'},
 limitations:['Pure photo and chemo genotypes are separate blocks; changing energy background is not claimed to isolate a single environmental factor.','Independent monocultures establish life-cycle feasibility, not relative competitive fitness.','Competition compares frequencies in one world at finite density, not rare-mutant invasion or asymptotic coexistence.','Cell unit means abstract biomass. Shape repeat value is held at 0.5, giving colony maturity at four units.','Initial count/reserve and one-cell material match structural variants; later growth is paid by organisms.','The geology control changes the existing resources setting, which supplies both redox and dissolved nutrients; their effects cannot be separated here.','No spontaneous evolution is claimed: all structural variants are introduced, mutation is disabled.','Equal seeds fix starting terrain and positions; subsequent biological random consumption can diverge.','Late-window rates distinguish surviving founders from replacement by descendants; zero offspring in 3000 steps is evidence only for these conditions/backgrounds.','Extinction/capacity terminate a run; censored durations and vanished predators are reported, never hidden.','Energy-source records are cumulative over all births, including dead individuals; growth and reproduction are reserve uses, not all ecosystem dissipation.']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(out,'results.jsonl'),'');
const ledgerKeys=['intake','maintenance','movement','reproduction','hunting','stress','growth'],results=[];
function count(values){const result={};for(const value of values)result[value]=(result[value]||0)+1;return result;}
function sum(rows,key){return rows.reduce((total,row)=>total+row[key],0);}
function grouped(world,group){
 const records=Object.values(world.records).filter(r=>r.origin===group.origin),living=world.agents.filter(a=>a.origin===group.origin),founders=group.founderIds.map(id=>world.records[id]),sources=Object.fromEntries(FOOD_SOURCES.map(key=>[key,records.reduce((total,r)=>total+r.energy.sources[key],0)]));
 const accounts=Object.fromEntries(ledgerKeys.map(key=>[key,records.reduce((total,r)=>total+r.energy[key],0)]));
 const exposure=records.reduce((total,r)=>total+(r.death?r.death.tick:world.tick)-r.born,0),requiredCells=matureCells({traits:group.traits,shape:group.shape}),maturityTick=r=>requiredCells===1?r.born:r.lifeHistory.matureAt,mature=records.filter(r=>maturityTick(r)!==null),parents=records.filter(r=>r.offspring.length);
 return {name:group.name,origin:group.origin,initialCount:group.founderIds.length,population:living.length,births:records.length-founders.length,deaths:records.filter(r=>r.death).length,aliveFounders:founders.filter(r=>!r.death).length,aliveDescendants:living.filter(a=>!group.founderIds.includes(a.id)).length,
  maxGeneration:Math.max(0,...records.map(r=>r.generation)),cells:sum(living,'cells'),cellDistribution:count(living.map(a=>a.cells)),peakCells:Math.max(1,...records.map(r=>r.lifeHistory.peakCells)),
  maturation:{requiredCells,individuals:mature.length,founders:founders.filter(r=>maturityTick(r)!==null).length,firstTick:mature.length?Math.min(...mature.map(maturityTick)):null},
  reproduction:{parents:parents.length,founderParents:founders.filter(r=>r.offspring.length).length,founderOffspring:founders.reduce((n,r)=>n+r.offspring.length,0),firstBirth:parents.length?Math.min(...parents.map(r=>world.records[r.offspring[0]].born)):null,releases:records.reduce((n,r)=>n+r.lifeHistory.releases,0),materialTransferred:records.reduce((n,r)=>n+r.lifeHistory.materialFromParent,0)},
  accounts:{...accounts,sources,individualSteps:exposure,operatingSurplus:accounts.intake-accounts.maintenance-accounts.movement-accounts.hunting-accounts.stress,intakePerIndividualStep:exposure?accounts.intake/exposure:null,maintenancePerIndividualStep:exposure?accounts.maintenance/exposure:null},
  currentReserve:sum(living,'energy'),currentBodyMaterial:sum(living,'bodyEnergy'),deathsByCause:count(records.filter(r=>r.death).map(r=>r.death.cause)),
  founders:founders.map(r=>({id:r.id,death:r.death,peakCells:r.lifeHistory.peakCells,matureAt:r.lifeHistory.matureAt,offspring:r.offspring.length,energy:r.energy}))};
}
function windowReport(trajectory,groupName,from,to){
 const start=trajectory.find(s=>s.tick===from),end=trajectory.find(s=>s.tick===to);if(!start||!end)return null;
 const a=start.groups.find(g=>g.name===groupName),b=end.groups.find(g=>g.name===groupName),accounts=Object.fromEntries(ledgerKeys.map(key=>[key,b.accounts[key]-a.accounts[key]])),exposure=b.accounts.individualSteps-a.accounts.individualSteps;
 return {from,to,populationStart:a.population,populationEnd:b.population,births:b.births-a.births,deaths:b.deaths-a.deaths,individualSteps:exposure,accounts,sources:Object.fromEntries(FOOD_SOURCES.map(key=>[key,b.accounts.sources[key]-a.accounts.sources[key]])),intakePerIndividualStep:exposure?accounts.intake/exposure:null,operatingSurplusPerIndividualStep:exposure?(accounts.intake-accounts.maintenance-accounts.movement-accounts.hunting-accounts.stress)/exposure:null};
}
const plans=[];
for(const seed of seeds)for(const background of backgrounds){
 if(mode!=='competition')for(const condition of selectedConditions)for(const variant of variants)plans.push({kind:'monoculture',seed,background,condition,variant});
 if(mode!=='monoculture')for(const condition of selectedConditions.filter(c=>['standard','predators'].includes(c)))for(const variant of variants.filter(v=>['colony','tissue'].includes(v)))plans.push({kind:'competition',seed,background,condition,variant});
}
for(const plan of plans){
 const start=performance.now(),condition=conditions[plan.condition],profile=profiles[plan.background],world=new World({seed:plan.seed,...metadata.config,light:condition.light,resources:condition.resources});
 const allSites=world.fields.filter(field=>!field.land),ordered=condition.placement==='vent'?[...allSites].sort((a,b)=>b.vent-a.vent||a.y-b.y||a.x-b.x):allSites;
 const siteCount=plan.kind==='monoculture'?26:13,sites=Array.from({length:siteCount},(_,i)=>condition.placement==='vent'?ordered[i]:ordered[Math.floor((i+.5)*ordered.length/siteCount)]),groups=[];
 function makeGroup(name,genes,traits,bodyShape){const species=world.createSpecies(genes,null,bodyShape);species.discovered=[...traits];const group={name,origin:species.origin,species,genes,traits,shape:bodyShape,founderIds:[],initialEnergy:0,initialBody:0};groups.push(group);return group;}
 function birth(group,site){const a=world.makeAgent(group.species,site.x,site.y,group.genes,group.traits,0,17,group.shape);world.agents.push(a);injectLife(world,a);group.founderIds.push(a.id);group.initialEnergy+=a.energy+a.bodyEnergy;group.initialBody+=a.bodyEnergy;if(JSON.stringify(a.traits)!==JSON.stringify(expressStructures(a.structureGenes)))throw new Error('Founding expression mismatch');return a;}
 const focal=makeGroup(plan.variant,profile.genes,traitClosure([...profile.traits,...structures[plan.variant]]),shape);
 const single=plan.kind==='competition'?makeGroup('single',profile.genes,traitClosure(profile.traits),shape):null;
 for(let i=0;i<sites.length;i++)for(const group of single?(i%2?[focal,single]:[single,focal]):[focal])birth(group,sites[i]);
 if(single&&Math.abs(single.initialBody-focal.initialBody)>1e-9)throw new Error('Structural comparison has unequal initial body material');
 if(matureCells(world.agents.find(a=>a.origin===focal.origin))!==(plan.variant==='single'?1:4))throw new Error('Maturity assumptions changed');
 if(condition.predators){const hunters=makeGroup('predator',predator.genes,predator.traits,predator.shape);for(let i=0;i<condition.predators;i++){const site=sites[Math.floor((i+.5)*sites.length/condition.predators)];birth(hunters,{x:site.x+3,y:site.y+3});}}
 world.liveCount=world.agents.length;world.census();world.reindex();
 const initialGroups=groups.map(g=>({name:g.name,origin:g.origin,genes:g.genes,traits:g.traits,shape:g.shape,founderIds:g.founderIds,initialEnergy:g.initialEnergy,initialBody:g.initialBody}));
 const trajectory=[],audit={samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,nonFinite:0,peakPopulation:world.agents.length},special=new Set([600,1500,3000]);let stop='horizon';
 function sample(){const balance=balances(world);audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(balance.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(balance.nutrientError));audit.nonFinite+=Object.values(balance).filter(v=>!Number.isFinite(v)).length;if(audit.nonFinite||Math.abs(balance.energyError)>.001||Math.abs(balance.nutrientError)>.0001)throw new Error('Resource accounting failed');trajectory.push({tick:world.tick,population:world.agents.length,groups:groups.map(g=>{const report=grouped(world,g);delete report.founders;return report;}),balance});}
 sample();
 while(world.tick<steps){world.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);const terminated=world.saturated?'capacity':!world.agents.length?'extinction':null;if(world.tick%sampleEvery===0||special.has(world.tick)||world.tick===steps||terminated)sample();if(terminated){stop=terminated;break;}}
 const final=groups.map(g=>grouped(world,g)),result={...plan,config:world.config,requestedSteps:steps,actualSteps:world.tick,termination:stop,capacity:world.capacity,initialGroups,initialSites:sites.map(f=>({x:f.x,y:f.y,vent:f.vent,temperature:f.temp,light:f.light})),audit,final,trajectory,windows:Object.fromEntries(groups.map(g=>[g.name,[[0,600],[600,1500],[1500,3000]].map(([a,b])=>windowReport(trajectory,g.name,a,b)).filter(Boolean)])),elapsedMs:performance.now()-start};
 result.initialEnergy=initialGroups.reduce((total,g)=>total+g.initialEnergy,0);result.initialNutrient=result.initialEnergy*N_RATIO;
 results.push(result);fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(result)+'\n');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({run:results.length,total:plans.length,...plan,tick:world.tick,stop,groups:final.map(g=>({name:g.name,population:g.population,births:g.births,aliveDescendants:g.aliveDescendants,matured:g.maturation.individuals,predationDeaths:g.deathsByCause['捕食']||0})),seconds:+((performance.now()-start)/1000).toFixed(2)}));
}
const summary=[];
for(const plan of plans){const key=[plan.kind,plan.background,plan.condition,plan.variant].join('|');if(summary.some(s=>s.key===key))continue;const matches=results.filter(r=>[r.kind,r.background,r.condition,r.variant].join('|')===key);summary.push({key,replicates:matches.length,results:matches.map(r=>({seed:r.seed,tick:r.actualSteps,termination:r.termination,groups:r.final.map(g=>({name:g.name,population:g.population,births:g.births,maxGeneration:g.maxGeneration,aliveDescendants:g.aliveDescendants,parents:g.reproduction.parents,matured:g.maturation.individuals,founderOffspring:g.reproduction.founderOffspring,sources:g.accounts.sources,accounts:g.accounts,deaths:g.deathsByCause}))}))});}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
