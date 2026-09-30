import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// Read-only instrumentation: no added draws from any of the world's RNG streams.
// Every failed birth attempt is kept separate from a realized birth.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args={};
for(const arg of process.argv.slice(2)){
 const m=/^--([^=]+)=(.+)$/.exec(arg);
 if(!m||!['out','seed','horizons','engine','condition','verify','parent-samples','fates'].includes(m[1]))throw new Error('Use --out=directory --seed=ORIGIN-042 --horizons=6000,12000,24000,36000');
 args[m[1]]=m[2];
}
if(!args.out)throw new Error('--out is required');
const engine=path.resolve(args.engine||path.join(project,'dist/engine.js')),source=path.dirname(engine);
const {World,Random}=await import(pathToFileURL(engine));
const {TRAITS,TRAIT_INDEX,DEFAULTS}=await import(pathToFileURL(path.join(source,'biology.js')));
const {expressStructures}=await import(pathToFileURL(path.join(source,'heredity.js')));
const {diagnoseWorld}=await import(pathToFileURL(path.join(source,'diagnostics.js')));
const {balances}=await import(pathToFileURL(path.join(source,'ecology.js')));
const {readyToReproduce}=await import(pathToFileURL(path.join(source,'life-history.js')));
const conditions={default:{},stable:{volatility:0},geological:{resources:3},bright:{light:1.6}};
const condition=args.condition||'default';if(!Object.hasOwn(conditions,condition))throw new Error('Unknown condition');
const seed=args.seed||'ORIGIN-042',horizons=(args.horizons||'6000,12000,24000,36000').split(',').map(Number).sort((a,b)=>a-b);
if(horizons.some(n=>!Number.isInteger(n)||n<1))throw new Error('Invalid horizons');
const sampleLimit=Number(args['parent-samples']||256),out=path.resolve(args.out);fs.mkdirSync(out,{recursive:true});
const focal=['colony','tissue','bilateral','radial'];
const compactParent=a=>a?Object.fromEntries(['id','origin','generation','genes','shape','traits','structureGenes','reproduction','neutralAllele','age','cells','energy'].map(k=>[k,structuredClone(a[k])])):null;
const newTarget=id=>({id,inheritanceAttempts:0,preconditionsPresent:0,missingBlueprintAndPrerequisites:0,geneEligible:0,eligibleChoices:0,expectedGainAttempts:0,actualGains:0,gainSurvivesExpression:0,gainBorn:0,gainBornExpressed:0,gainRejectedByBirthCost:0,expressedBirths:0,encodedBirths:0,carryingParentAttempts:0,carryingParentHighGeneAttempts:0});
function instrument(world){
 const sampling=new Random(seed+':observation-only'),stats={calls:0,attempts:0,born:0,rejectedAfterInheritance:0,colonyParentAttempts:0,colonyParentHighSocial:0,targets:Object.fromEntries(focal.map(id=>[id,newTarget(id)]))},parents=[],events=[];
 let pending=null;
 const originalInherit=world.inherit,originalReproduce=world.reproduce;
 world.inherit=function(a,b){
  const parent=compactParent(a),mate=compactParent(b),dna=originalInherit.call(this,a,b);
  const before=new Set(dna.structureGenes);
  for(const change of [...dna.inheritance.changes].reverse())if(change.kind==='trait'){
   if(change.cause==='mutation-loss')before.add(change.id);
   if(change.cause==='mutation-gain')before.delete(change.id);
  }
  const expressed=expressStructures([...before]);
  const choices=TRAITS.filter(t=>(this.config.fiction||t.kind!=='fiction')&&!before.has(t.id)&&dna.genes[t.gene]>=t.min&&t.parents.every(p=>expressed.includes(p))&&!(t.excludes||[]).some(p=>before.has(p)));
  const assessment=[];stats.attempts++;
  for(const id of focal){
   const t=TRAITS[TRAIT_INDEX[id]],s=stats.targets[id],prerequisites=t.parents.every(p=>expressed.includes(p)),eligible=choices.some(t=>t.id===id),gain=dna.inheritance.changes.some(c=>c.kind==='trait'&&c.id===id&&c.cause==='mutation-gain');
   s.inheritanceAttempts++;s.preconditionsPresent+=+prerequisites;s.missingBlueprintAndPrerequisites+=+(prerequisites&&!before.has(id));s.geneEligible+=+(prerequisites&&!before.has(id)&&dna.genes[t.gene]>=t.min);
   if(eligible){s.eligibleChoices++;s.expectedGainAttempts+=this.config.mutation/choices.length;}
   if(gain){s.actualGains++;s.gainSurvivesExpression+=+dna.traits.includes(id);}
   const parentPrereq=t.parents.every(p=>a.traits.includes(p));s.carryingParentAttempts+=+parentPrereq;s.carryingParentHighGeneAttempts+=+(parentPrereq&&a.genes[t.gene]>=t.min);
   assessment.push({id,gain});
  }
  let sampleIndex=-1;
  if(a.traits.includes('colony')||b?.traits.includes('colony')){
   stats.colonyParentAttempts++;stats.colonyParentHighSocial+=+(a.genes[5]>=.38||b?.genes[5]>=.38);
   const candidate={tick:this.tick,attempt:stats.attempts,parent,mate,childId:null,born:false};
   const index=parents.length<sampleLimit?parents.length:Math.floor(sampling.next()*stats.colonyParentAttempts);
   if(index<sampleLimit){parents[index]=candidate;sampleIndex=index;}
  }
  pending={dna,assessment,parent,mate,sampleIndex};return dna;
 };
 world.reproduce=function(a,near){
  stats.calls++;pending=null;const child=originalReproduce.call(this,a,near);if(!pending)return child;
  const {dna,assessment,parent,mate,sampleIndex}=pending;
  stats.born+=+!!child;stats.rejectedAfterInheritance+=+!child;
  if(sampleIndex>=0){parents[sampleIndex].born=!!child;parents[sampleIndex].childId=child?.id??null;}
  for(const {id,gain} of assessment){const s=stats.targets[id];
   if(child){s.expressedBirths+=+dna.traits.includes(id);s.encodedBirths+=+dna.structureGenes.includes(id);if(gain){s.gainBorn++;s.gainBornExpressed+=+dna.traits.includes(id);}}
   else if(gain)s.gainRejectedByBirthCost++;
   if(gain&&id!=='colony')events.push({tick:this.tick,id,childId:child?.id??null,born:!!child,expressed:dna.traits.includes(id),encoded:dna.structureGenes.includes(id),socialGene:dna.genes[5],parents:[parent.id,...mate?[mate.id]:[]],changes:dna.inheritance.changes.filter(c=>c.kind==='trait')});
  }
  return child;
 };
 return {stats,parents,events};
}
if(args.verify==='true'){
 const plain=new World({seed,...conditions[condition]}),observed=new World({seed,...conditions[condition]});instrument(observed);
 plain.step(1200);observed.step(1200);assert.equal(observed.serialize(),plain.serialize());
 fs.writeFileSync(path.join(out,'instrumentation-check.json'),JSON.stringify({steps:1200,identical:true,comparison:'Full serialized world, including all three RNG states, resources and birth records'},null,2));
 console.log(JSON.stringify({instrumentationVerified:true,steps:1200}));
}
const world=new World({seed,...conditions[condition]}),observer=instrument(world),audit={samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,nonFinite:0,sampledPeakPopulation:0},started=performance.now();
const metadata={version:6,seed,condition,engine,config:world.config,horizons,sampleEvery:120,parentSampleLimit:sampleLimit,startingCommit:'103932a7faf0e8ba667933c9d5dd9b9a8717f784',instrumentation:'Observers do not modify simulation state or draw from simulation RNGs. Parent reservoirs use an independent RNG. Candidate counts reconstruct pre-gain blueprints from realized inheritance evidence. Expected gains sum mutationRate / numberOfEligibleChoices; estimates are conditional on observed paths, not independent-event probabilities.'};
metadata.countingNotes=['trace.offspring counts parent-child edges; two carrier parents can refer to the same child. Use traitHistory.transmittedBirths for distinct inherited-structure births.','carryingParentAttempts checks prerequisites on the initiating parent only. Candidate eligibility itself uses the actual recombined, mutated child genome and pre-gain expression.','colonyParentHighSocial counts pairs with any colony parent and any high-social parent; the two properties need not belong to the same parent.','followed600 describes at least 600 steps of follow-up; offspring count includes the whole observed lifetime, not a standardized first-600-step rate.'];
fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(out,'trajectory.jsonl'),'');
function distribution(values){const n=values.length,counts=new Map();for(const id of values)counts.set(id,(counts.get(id)||0)+1);const rows=[...counts].map(([id,count])=>({id,count,share:count/n}));return{richness:rows.length,effective:n?Math.exp(-rows.reduce((s,r)=>s+r.share*Math.log(r.share),0)):0,rows};}
function trace(id){
 const records=Object.values(world.records),carriers=records.filter(r=>r.traits.includes(id)),oldEnough=carriers.filter(r=>world.tick-r.born>=600),alive=world.agents.filter(a=>a.traits.includes(id)),parents=carriers.filter(r=>r.offspring.length),ended=carriers.filter(r=>r.death),encoded=records.filter(r=>r.structureGenes.includes(id));
 const deaths={};for(const r of ended)deaths[r.death.cause]=(deaths[r.death.cause]||0)+1;
 return{id,birthCarriers:carriers.length,encodedBirthCarriers:encoded.length,parents:parents.length,offspring:parents.reduce((s,r)=>s+r.offspring.length,0),matured:carriers.filter(r=>r.lifeHistory.matureAt!==null).length,actualMulticellularAlive:alive.filter(a=>a.cells>1).length,alive:alive.length,readyToReproduceAlive:alive.filter(readyToReproduce).length,firstBorn:carriers[0]?.born??null,firstEncoded:encoded[0]?.born??null,highSocialBirthCarriers:carriers.filter(r=>r.genes[5]>=.38).length,highSocialParents:parents.filter(r=>r.genes[5]>=.38).length,highSocialParentOffspring:parents.filter(r=>r.genes[5]>=.38).reduce((s,r)=>s+r.offspring.length,0),meanSocialGeneAtBirth:carriers.length?carriers.reduce((s,r)=>s+r.genes[5],0)/carriers.length:null,meanSocialGeneParents:parents.length?parents.reduce((s,r)=>s+r.genes[5],0)/parents.length:null,deaths,deadMeanAge:ended.length?ended.reduce((s,r)=>s+r.death.tick-r.born,0)/ended.length:null,followed600:{carriers:oldEnough.length,parents:oldEnough.filter(r=>r.offspring.length).length,matured:oldEnough.filter(r=>r.lifeHistory.matureAt!==null).length,stillAlive:oldEnough.filter(r=>!r.death).length}};
}
function sample(full=false,reason='checkpoint'){
 const b=balances(world);audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(b.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(b.nutrientError));audit.nonFinite+=Object.values(b).filter(v=>!Number.isFinite(v)).length;audit.sampledPeakPopulation=Math.max(audit.sampledPeakPopulation,world.agents.length);
 const living=world.agents,labels=distribution(living.map(a=>a.species)),social=living.map(a=>a.genes[5]),record={tick:world.tick,population:living.length,births:world.totalBirths,deaths:world.totalDeaths,labels,origins:distribution(living.map(a=>a.origin)),maxLivingGeneration:living.length?Math.max(...living.map(a=>a.generation)):null,meanSocialGene:living.length?social.reduce((s,x)=>s+x,0)/living.length:null,highSocialLiving:social.filter(x=>x>=.38).length,traits:Object.fromEntries(focal.map(id=>[id,{living:living.filter(a=>a.traits.includes(id)).length,encoded:living.filter(a=>a.structureGenes.includes(id)).length}]))};
 fs.appendFileSync(path.join(out,'trajectory.jsonl'),JSON.stringify(record)+'\n');
 if(full){const diagnostic=diagnoseWorld(world),snapshot={...record,reason,audit:{...audit},birthsEver:world.nextId-1,observed:structuredClone(observer.stats),trace:focal.map(trace),morphology:diagnostic.morphology,feeding:diagnostic.feeding,traitHistory:diagnostic.traits,energy:b,elapsedSeconds:(performance.now()-started)/1000};fs.writeFileSync(path.join(out,`T${world.tick}.json`),JSON.stringify(snapshot,null,2));fs.writeFileSync(path.join(out,`parents-T${world.tick}.json`),JSON.stringify({schema:'v6-parent-attempts',seed,tick:world.tick,population:world.agents.length,eligibleAttempts:observer.stats.colonyParentAttempts,sampling:'Uniform reservoir of colony-associated inheritance attempts, not independent genomes',samples:observer.parents},null,2));fs.writeFileSync(path.join(out,'innovation-events.json'),JSON.stringify(observer.events,null,2));console.log(JSON.stringify({seed,condition,tick:world.tick,population:living.length,births:world.totalBirths,tissueEligible:observer.stats.targets.tissue.eligibleChoices,tissueExpected:observer.stats.targets.tissue.expectedGainAttempts,tissueGains:observer.stats.targets.tissue.actualGains,tissueBirths:observer.stats.targets.tissue.expressedBirths,reason,elapsedSeconds:Math.round(snapshot.elapsedSeconds)}));}
}
sample();let termination='horizon';
while(world.tick<horizons.at(-1)){
 world.stepOne();const stop=world.saturated?'capacity':world.originDone&&!world.agents.length?'extinction':null,checkpoint=horizons.includes(world.tick);
 if(world.tick%120===0||checkpoint||stop)sample(checkpoint||!!stop,stop||'checkpoint');
 if(args.fates==='true'&&(checkpoint||stop)){
  const records=Object.values(world.records).filter(r=>['tissue','bilateral','radial'].some(id=>r.structureGenes.includes(id)));
  const fates=records.map(r=>{const live=world.agents.find(a=>a.id===r.id);return{...r,living:live?{cells:live.cells,energy:live.energy,bodyEnergy:live.bodyEnergy}:null,offspring:r.offspring.map(id=>{const c=world.records[id];return{id,born:c.born,traits:c.traits,structureGenes:c.structureGenes,death:c.death,offspring:c.offspring};})};});
  fs.writeFileSync(path.join(out,`fates-T${world.tick}.json`),JSON.stringify({tick:world.tick,seed,scope:'All birth records with encoded tissue, bilateral or radial; founder blueprints excluded unless present in the world.',records:fates},null,2));
 }
 if(stop){termination=stop;break;}
}
fs.writeFileSync(path.join(out,'completion.json'),JSON.stringify({seed,condition,termination,tick:world.tick,audit,elapsedSeconds:(performance.now()-started)/1000},null,2));
