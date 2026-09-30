import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Fixed-clone life-history feasibility, not a competition/selection assay.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args={};
const allowed=new Set(['out','engine','seeds','steps','sample','conditions','maturity','variants']);
for(const argument of process.argv.slice(2)){
 const match=/^--([^=]+)=(.+)$/.exec(argument);
 if(!match||!allowed.has(match[1]))throw new Error('Use --name=value; arguments: '+[...allowed].join(', '));
 args[match[1]]=match[2];
}
const engine=path.resolve(args.engine||path.join(project,'dist/engine.js')),source=path.dirname(engine),out=path.resolve(args.out||path.join(project,'../v6-study/colony-assay-1'));
const {World}=await import(pathToFileURL(engine));
const {balances,injectLife,N_RATIO}=await import(pathToFileURL(path.join(source,'ecology.js')));
const {matureCells}=await import(pathToFileURL(path.join(source,'life-history.js')));
const {GENES}=await import(pathToFileURL(path.join(source,'biology.js')));
const seeds=(args.seeds||'ORIGIN-042,DELTA-103').split(','),steps=Number(args.steps||1500),sampleEvery=Number(args.sample||120);
const targets=(args.maturity||'2,3,4,5,6').split(',').map(Number),variants=(args.variants||'single,colony,tissue').split(',');
const conditions={mixed:{light:1,resources:1},bright:{light:1.6,resources:1}},chosen=(args.conditions||'mixed,bright').split(',');
if(GENES.length!==14)throw new Error('This assay requires the v6 14-locus genome');
if(!Number.isInteger(steps)||steps<1||!Number.isInteger(sampleEvery)||sampleEvery<1)throw new Error('steps and sample must be positive integers');
if(targets.some(n=>!Number.isInteger(n)||n<2||n>6))throw new Error('maturity must be integers 2..6');
if(variants.some(name=>!['single','colony','tissue'].includes(name))||chosen.some(name=>!Object.hasOwn(conditions,name)))throw new Error('Unknown condition or variant');
const genes=[.9,.15,0,.25,.15,.4,.46,.5,.5,.45,.1,.6,.05,.05];
const metadata={created:new Date().toISOString(),engine,seeds,conditions:Object.fromEntries(chosen.map(name=>[name,conditions[name]])),steps,sampleEvery,targets,variants,genes,
 founders:26,initialReserve:17,mutation:0,reproductionMode:'asexual',volatility:0,
 design:'For each seed, light condition and repeat-gene value, separate worlds contain only single cells, colony carriers or colony+tissue carriers. All have pigment. Genomes and all other shape values are identical. Founders begin as one cell and pay their own growth costs. Initial cells are exact clones distributed over aquatic field centres; no random founding gene perturbation is used.',
 limitations:['This is a feasible-life-cycle assay for a synthetic photosynthetic genotype, not evidence of spontaneous evolution or competitive fitness.','Independent monocultures do not establish a selective advantage for multicellularity.','maturity is a design variable; single controls have the same shape[3] but are mature at one cell.','mixed retains normal spatial depth, vent and nutrient variation; it does not mean uniform resources.','Same seeds generate the same initial environment and positions; changed behaviour later consumes randomness differently.','Initial reserve and body material are explicit external inputs. All later growth and reproduction must be paid by existing organisms.','Ledger growth/reproduction include transfers to biomass or offspring; they are not all irreversible ecosystem losses.','Reported maturation/first-birth delay medians are conditional on reaching those events before the horizon.','Capacity termination is a computational limit, not an ecological equilibrium.']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(out,'results.jsonl'),'');
const results=[],ledgerKeys=['intake','maintenance','movement','reproduction','hunting','stress','growth'];
function median(values){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function termination(world){return world.saturated?'capacity':!world.agents.length?'extinction':null;}
function distribution(values){const counts={};for(const value of values)counts[value]=(counts[value]||0)+1;return counts;}
function totals(records){return Object.fromEntries(ledgerKeys.map(key=>[key,records.reduce((sum,record)=>sum+record.energy[key],0)]));}
function summarize(world,founderIds,variant){
 const living=world.agents.filter(agent=>agent.alive),records=Object.values(world.records),founders=founderIds.map(id=>world.records[id]);
 const accounting=totals(records),exposure=records.reduce((sum,record)=>sum+(record.death?record.death.tick:world.tick)-record.born,0);
 const operating=accounting.intake-accounting.maintenance-accounting.movement-accounting.hunting-accounting.stress;
 const firstBirths=records.filter(record=>record.offspring.length).map(record=>({id:record.id,tick:world.records[record.offspring[0]].born,delay:world.records[record.offspring[0]].born-record.born}));
 const matured=variant==='single'?records.map(record=>({id:record.id,tick:record.born,delay:0})):records.filter(record=>record.lifeHistory.matureAt!==null).map(record=>({id:record.id,tick:record.lifeHistory.matureAt,delay:record.lifeHistory.matureAt-record.born}));
 const founderOutcomes=founders.map(record=>({id:record.id,alive:!record.death,death:record.death,peakCells:record.lifeHistory.peakCells,
  matureAt:variant==='single'?record.born:record.lifeHistory.matureAt,firstBirth:record.offspring.length?world.records[record.offspring[0]].born:null,offspring:record.offspring.length,accounts:record.energy}));
 return {tick:world.tick,population:living.length,births:world.totalBirths,deaths:world.totalDeaths,capacity:{limit:world.capacity,reached:world.saturated},
  aliveFounders:founderOutcomes.filter(record=>record.alive).length,aliveDescendants:living.filter(agent=>!founderIds.includes(agent.id)).length,
  maxGeneration:records.length?Math.max(...records.map(record=>record.generation)):0,
  liveCells:living.reduce((sum,agent)=>sum+agent.cells,0),cellDistribution:distribution(living.map(agent=>agent.cells)),peakCells:Math.max(...records.map(record=>record.lifeHistory.peakCells)),
  maturation:{carriersReachingMaturity:matured.length,firstTick:matured.length?Math.min(...matured.map(record=>record.tick)):null,medianDelay:median(matured.map(record=>record.delay)),foundersReachingMaturity:founderOutcomes.filter(record=>record.matureAt!==null).length},
  reproduction:{parents:firstBirths.length,firstBirthTick:firstBirths.length?Math.min(...firstBirths.map(record=>record.tick)):null,medianFirstBirthDelay:median(firstBirths.map(record=>record.delay)),foundersWithOffspring:founderOutcomes.filter(record=>record.offspring>0).length,
   materialTransferred:records.reduce((sum,record)=>sum+record.lifeHistory.materialFromParent,0),releases:records.reduce((sum,record)=>sum+record.lifeHistory.releases,0)},
  accounts:{scope:'all-birth-records-including-dead',...accounting,operatingSurplusBeforeGrowthAndReproduction:operating,individualStepExposure:exposure,
   intakePerIndividualStep:exposure?accounting.intake/exposure:null,maintenancePerIndividualStep:exposure?accounting.maintenance/exposure:null,operatingSurplusPerIndividualStep:exposure?operating/exposure:null,
   sources:Object.fromEntries(Object.keys(records[0].energy.sources).map(key=>[key,records.reduce((sum,record)=>sum+record.energy.sources[key],0)]))},
  founderAccounts:totals(founders),founderOutcomes,
  deathsByCause:Object.fromEntries(['饥饿','衰老','捕食','灾变'].map(cause=>[cause,records.filter(record=>record.death?.cause===cause).length])),
  balance:balances(world)};
}
for(const seed of seeds)for(const condition of chosen)for(const target of targets)for(const variant of variants){
 const start=performance.now(),config={seed,founders:0,origin:false,mutation:0,reproductionMode:'asexual',volatility:0,fiction:false,...conditions[condition]},world=new World(config);
 const shape=Array(8).fill(.5);shape[3]=(target-2)/4;
 const traits=['pigment',...(variant==='single'?[]:variant==='colony'?['colony']:['colony','tissue'])],species=world.createSpecies(genes,null,shape),founderIds=[];
 species.discovered=[...traits];const sites=world.fields.filter(field=>!field.land);let injectedEnergy=0;
 for(let i=0;i<26;i++){
  const site=sites[Math.floor((i+.5)*sites.length/26)],agent=world.makeAgent(species,site.x,site.y,genes,traits,0,17,shape);
  world.agents.push(agent);injectLife(world,agent);injectedEnergy+=agent.energy+agent.bodyEnergy;founderIds.push(agent.id);
 }
 world.liveCount=world.agents.length;world.census();world.reindex();
 if(matureCells(world.agents[0])!==(variant==='single'?1:target))throw new Error('Maturity mapping changed; revise the assay before running');
 const audit={samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,nonFinite:0,peakPopulation:26},trajectory=[];let end='horizon';
 function sample(){const balance=balances(world);audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(balance.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(balance.nutrientError));audit.nonFinite+=Object.values(balance).filter(value=>!Number.isFinite(value)).length;trajectory.push({tick:world.tick,population:world.agents.length,births:world.totalBirths,deaths:world.totalDeaths,cells:distribution(world.agents.map(agent=>agent.cells)),reserve:world.agents.reduce((sum,agent)=>sum+agent.energy,0),bodyEnergy:world.agents.reduce((sum,agent)=>sum+agent.bodyEnergy,0),energyError:balance.energyError,nutrientError:balance.nutrientError});}
 sample();
 while(world.tick<steps){world.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);const stop=termination(world);if(world.tick%sampleEvery===0||world.tick===steps||stop)sample();if(stop){end=stop;break;}}
 const result={seed,condition,targetMatureCells:target,actualMatureCells:variant==='single'?1:target,variant,genes,shape,traits,config,termination:end,injected:{energy:injectedEnergy,nutrient:injectedEnergy*N_RATIO},elapsedMs:performance.now()-start,audit,final:summarize(world,founderIds,variant),trajectory};
 results.push(result);fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(result)+'\n');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({seed,condition,variant,matureCells:result.actualMatureCells,repeat:shape[3],tick:world.tick,population:result.final.population,births:result.final.births,matured:result.final.maturation.carriersReachingMaturity,firstMature:result.final.maturation.firstTick,firstBirth:result.final.reproduction.firstBirthTick,peakCells:result.final.peakCells,stop:end,elapsedSeconds:+(result.elapsedMs/1000).toFixed(1)}));
}
const summary=[];
for(const condition of chosen)for(const target of targets)for(const variant of variants){
 const matching=results.filter(result=>result.condition===condition&&result.targetMatureCells===target&&result.variant===variant);
 summary.push({condition,targetMatureCells:target,variant,replicates:matching.length,runsWithMaturation:matching.filter(result=>result.final.maturation.carriersReachingMaturity>0).length,
  runsWithBirths:matching.filter(result=>result.final.births>0).length,runsWithLivingDescendants:matching.filter(result=>result.final.aliveDescendants>0).length,
  runsAtCapacity:matching.filter(result=>result.termination==='capacity').length,populations:matching.map(result=>result.final.population),births:matching.map(result=>result.final.births),
  interpretation:'Synthetic-clone life-cycle feasibility in independent worlds. No comparative fitness or evolutionary prevalence claim.'});
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
