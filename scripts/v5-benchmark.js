import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// An observational experiment harness. It does not reward complexity or species count.
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const source=path.resolve(args['--source']||'dist');
const {World}=await import(pathToFileURL(path.join(source,'engine.js')));
const {balances}=await import(pathToFileURL(path.join(source,'ecology.js')));
const {TRAITS,TRAIT_INDEX,DEFAULTS}=await import(pathToFileURL(path.join(source,'biology.js')));
const seeds=(args['--seeds']||'ORIGIN-042,DELTA-103,EDEN-221,STUDY-004').split(',');
const conditions={default:{},dark:{light:0},cold:{temperature:5},rich:{resources:2,light:1.5},stable:{volatility:0}};
const chosen=(args['--conditions']||'default,dark,cold,rich').split(',');
const horizon=Number(args['--horizon']||6000),interval=Number(args['--interval']||600);
const prefix=path.resolve(args['--output']||'../v5-study/current');
fs.mkdirSync(path.dirname(prefix),{recursive:true});
const metadata={date:new Date().toISOString(),source,seeds,conditions:Object.fromEntries(chosen.map(c=>[c,conditions[c]])),horizon,interval,defaults:DEFAULTS,limits:'Fixed game parameter samples, not biological estimates. Different mechanism versions change random trajectories. Observations stop at extinction or explicit computational capacity. Complexity and branch count are descriptive only.'};
fs.writeFileSync(prefix+'-metadata.json',JSON.stringify(metadata,null,2));
fs.writeFileSync(prefix+'-results.jsonl','');
const results=[];
function metrics(w){
 const n=w.agents.length,topology={cell:0,colony:0,axial:0,radial:0};
 let traits=0,maxTraits=0,stage=-1,generation=0,energy=0,mass=0,cost=0,intake=0;
 for(const a of w.agents){topology[a.development.topology]++;traits+=a.traits.length;maxTraits=Math.max(maxTraits,a.traits.length);generation=Math.max(generation,a.generation);energy+=a.energy;mass+=a.development.mass;cost+=a.form.cost+a.development.cost;intake+=a.lastIntake;for(const id of a.traits)stage=Math.max(stage,TRAITS[TRAIT_INDEX[id]].stage);}
 const living=new Set(w.agents.map(a=>a.species));
 return {tick:w.tick,population:n,historicalGroups:w.species.length,livingGroups:living.size,births:w.totalBirths,deaths:w.totalDeaths,crossovers:w.totalCrossovers,maxGeneration:generation,meanTraits:n?traits/n:null,maxTraits,maxStage:stage,topology,meanEnergy:n?energy/n:null,meanMass:n?mass/n:null,meanMaintenance:n?cost/n:null,meanLastIntake:n?intake/n:null,balance:balances(w)};
}
for(const condition of chosen)for(const seed of seeds){
 if(!Object.hasOwn(conditions,condition))throw new Error('Unknown condition '+condition);
 const started=performance.now(),w=new World({seed,...conditions[condition]});
 const audit={maxEnergyError:0,maxNutrientError:0,minOrganic:Infinity,minResource:Infinity,nonFinite:0,birthsObserved:0,energyCreatingBirths:0,maxBirthEnergyIncrease:0,peakPopulation:0,classificationTimes:[],labelLimitTick:null,everMaxTraits:0,everMaxStage:-1};
 const reproduce=w.reproduce;
 w.reproduce=function(a,near){
  const before=a.energy+a.bodyEnergy+near.reduce((n,b)=>n+b.energy+b.bodyEnergy,0),child=reproduce.call(this,a,near);
  if(child){const delta=a.energy+a.bodyEnergy+near.reduce((n,b)=>n+b.energy+b.bodyEnergy,0)+child.energy+child.bodyEnergy-before;audit.birthsObserved++;audit.maxBirthEnergyIncrease=Math.max(audit.maxBirthEnergyIncrease,delta);if(delta>1e-8)audit.energyCreatingBirths++;audit.everMaxTraits=Math.max(audit.everMaxTraits,child.traits.length);for(const id of child.traits)audit.everMaxStage=Math.max(audit.everMaxStage,TRAITS[TRAIT_INDEX[id]].stage);}
  return child;
 };
 const record=w.recordEvent;
 w.recordEvent=function(type,...rest){if(type==='speciation')audit.classificationTimes.push(this.tick);return record.call(this,type,...rest);};
 const timeline=[metrics(w)];let termination='horizon';
 for(let t=0;t<horizon;t++){
  w.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,w.agents.length);
  const b=balances(w);audit.maxEnergyError=Math.max(audit.maxEnergyError,Math.abs(b.energyError));audit.maxNutrientError=Math.max(audit.maxNutrientError,Math.abs(b.nutrientError));audit.nonFinite+=Object.values(b).filter(v=>!Number.isFinite(v)).length;
  if(w.tick%60===0){for(const f of w.fields)for(const k of ['nutrient','redox','plankton','detritus','photons','radiant'])audit.minResource=Math.min(audit.minResource,f[k]);for(const a of w.agents)audit.minOrganic=Math.min(audit.minOrganic,a.energy,a.bodyEnergy);}
  if(w.species.length>=40&&audit.labelLimitTick===null)audit.labelLimitTick=w.tick;
  if(w.tick%interval===0)timeline.push(metrics(w));
  if(w.saturated){termination='capacity';break;}if(w.originDone&&!w.agents.length){termination='extinction';break;}
 }
 w.census();
 // Restore/continue equivalence compares actual state, not a second implementation.
 const save=w.serialize(),final=metrics(w),ecology=structuredClone(w.ecology),restored=World.restore(save);
 if(args['--save']===seed&&condition==='default')fs.writeFileSync(prefix+'-'+seed+'-T'+w.tick+'.json',save);
 w.reproduce=reproduce;w.recordEvent=record;
 restored.step(60);w.step(60);
 const restoreRepeat=restored.serialize()===w.serialize();
 const serialized=JSON.parse(save),archiveKeys=Object.keys(serialized.world).filter(k=>/archive|record|evidence|geneFlow|encounter|pedigree|birth|death/i.test(k));
 const archive=Object.fromEntries(archiveKeys.map(k=>{const v=serialized.world[k];return [k,{entries:Array.isArray(v)?v.length:typeof v==='object'&&v!==null?Object.keys(v).length:null,bytes:Buffer.byteLength(JSON.stringify(v))}];}));
 let evidence=null;
 if(serialized.version===5){
  const data=serialized.world,records=Object.values(data.records),children=records.filter(r=>r.mode!=='founder'),mating=Object.values(data.matingEvidence),changes={};
  for(const r of children)for(const c of r.inheritance.changes)changes[c.cause]=(changes[c.cause]||0)+1;
  let incorrectInheritance=0,unexplainedStructures=0;
  for(const r of children){for(const key of ['genes','shape'])for(const e of r.inheritance[key])if(data.records[e.parent][key][e.index]!==e.before||r[key][e.index]!==e.after||e.mutated!==(e.before!==e.after))incorrectInheritance++;for(const e of r.inheritance.reproduction)if(data.records[e.parent].reproduction[e.id]!==e.before||r.reproduction[e.id]!==e.after)incorrectInheritance++;for(const id of r.traits)if(!r.parents.some(p=>data.records[p].traits.includes(id))&&!r.inheritance.changes.some(c=>c.id===id&&c.cause==='mutation-gain'))unexplainedStructures++;}
  evidence={founderRecords:records.length-children.length,birthRecords:children.length,deathRecords:records.filter(r=>r.death).length,sexualRecords:children.filter(r=>r.parents.length===2).length,missingParents:children.filter(r=>r.parents.some(id=>!data.records[id]||data.records[id].born>r.born)).length,missingChildLinks:children.filter(r=>r.parents.some(id=>!data.records[id]?.offspring.includes(r.id))).length,missingLiveRecords:data.agents.filter(a=>!data.records[a.id]).length,invalidEnergyRecords:records.filter(r=>Object.values(r.energy).some(n=>!Number.isFinite(n)||n<0)).length,incorrectInheritance,unexplainedStructures,crossLabelBirths:data.geneFlows.length,matingTotals:Object.fromEntries(['encounters','eligible','compatible','births'].map(k=>[k,mating.reduce((s,r)=>s+r[k],0)])),changes};
 }
 const result={condition,seed,termination,horizon,elapsedMs:performance.now()-started,final,audit,timeline,restoreRepeat,saveBytes:Buffer.byteLength(save),archive,evidence,foodFlows:Object.values(serialized.world.foodWeb).length,deathCauses:serialized.world.species.reduce((all,s)=>{for(const [k,v]of Object.entries(s.deathCauses))all[k]=(all[k]||0)+v;return all;},{}),ecology};
 results.push(result);fs.appendFileSync(prefix+'-results.jsonl',JSON.stringify(result)+'\n');fs.writeFileSync(prefix+'-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({condition,seed,end:termination,tick:final.tick,population:final.population,groups:final.historicalGroups,births:final.births,crossovers:final.crossovers,traits:final.meanTraits,energyError:audit.maxEnergyError,nutrientError:audit.maxNutrientError,saveMB:+(result.saveBytes/1e6).toFixed(2),ms:Math.round(result.elapsedMs)}));
}
