import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseWorld} from '../dist/diagnostics.js';
import {diagnosticsView} from '../dist/diagnostics-view.js';
import {observationView} from '../dist/observation-view.js';

const sources=patch=>({photons:0,redox:0,plankton:0,detritus:0,prey:0,radiant:0,...patch});
function agent(id,options={}){
 const traits=options.traits||[];
 return {id,species:1,origin:1,alive:true,shape:Array(8).fill(.5),traits,structureGenes:[...traits],cells:1,feeding:{tick:0,sources:sources()},...options};
}
function founder(a){return {id:a.id,born:0,parents:[],traits:[...a.traits],structureGenes:[...a.structureGenes],mode:'founder',inheritance:null,offspring:[]};}
function world(agents=[],records=agents.map(founder)){
 return {tick:600,agents,records:Object.fromEntries(records.map(record=>[record.id,record])),foodWeb:{},
  fields:[{nutrient:3,redox:5,plankton:2,detritus:1,photons:.5,radiant:0}],rng:{state:152},markerRng:{state:254},envRng:{state:365}};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('current label, origin, and abundance diversity remain distinct and exclude dead agents',()=>{
 const agents=Array.from({length:8},(_,index)=>agent(index+1));
 agents.push(agent(9,{species:2}),agent(10,{species:3,origin:2}),agent(11,{species:4,origin:3,alive:false}));
 const result=diagnoseWorld(world(agents)).diversity;
 assert.equal(result.population,10);assert.equal(result.labels.richness,3);assert.equal(result.origins.richness,2);
 assert.ok(Math.abs(result.labels.effective-Math.exp(-.8*Math.log(.8)-2*.1*Math.log(.1)))<1e-12);
 assert.ok(Math.abs(result.origins.effective-Math.exp(-.9*Math.log(.9)-.1*Math.log(.1)))<1e-12);
 assert.deepEqual(result.labels.rows.map(row=>row.count),[8,1,1]);
});

test('morphology reports expressed combinations, continuous variation, and actual cell counts separately',()=>{
 const agents=[agent(1,{traits:['shell','colony'],cells:3,shape:Array(8).fill(.3)}),agent(2,{traits:['colony','shell'],cells:2,shape:Array(8).fill(.7)}),agent(3,{traits:[],structureGenes:['colony']})];
 const result=diagnoseWorld(world(agents)).morphology;
 assert.equal(result.topologies.richness,2);assert.equal(result.combinations.richness,2);
 assert.deepEqual(result.combinations.rows[0].traits,['shell','colony']);assert.equal(result.combinations.rows[0].count,2);
 assert.equal(result.colonies,2);assert.equal(result.cells,6);
 assert.equal(result.shape[0].mean,.5);assert.equal(result.shape[0].minimum,.3);assert.equal(result.shape[0].maximum,.7);
 assert.ok(Math.abs(result.shape[0].deviation-Math.sqrt(.08/3))<1e-12);
});

test('feeding strategies follow individual intake even within one label, with explicit decay and no-evidence cases',()=>{
 const agents=[agent(1,{feeding:{tick:0,sources:sources({photons:10})}}),agent(2,{feeding:{tick:600,sources:sources({prey:5})}}),agent(3,{species:2,feeding:{tick:600,sources:sources({photons:3,redox:3})}}),agent(4,{species:3}),agent(5,{alive:false,feeding:{tick:600,sources:sources({detritus:1000})}})];
 const w=world(agents);w.foodWeb={'detritus>1':{source:'detritus',consumer:'1',amount:1000,tick:600}};
 const feeding=diagnoseWorld(w).feeding;
 assert.equal(feeding.evidence,'individual-intake');assert.equal(feeding.unobservedPopulation,1);
 assert.deepEqual(Object.fromEntries(feeding.strategies.map(row=>[row.id,row.population])),{mixed:1,photons:1,prey:1,unobserved:1});
 assert.ok(Math.abs(feeding.totalObservedIntake-(10/Math.E+11))<1e-12);
 assert.ok(Math.abs(feeding.sources.find(source=>source.id==='photons').amount-(10/Math.E+3))<1e-12);
 assert.equal(feeding.byLabel[0].population,2);assert.equal(feeding.byLabel[0].profile.length,2);
 assert.equal(feeding.network.intake,1000);assert.equal(feeding.network.scope,'recent-decayed-including-dead');
 assert.equal(feeding.sources.some(source=>source.id==='detritus'),false);
});

test('birth evidence counts offspring once and distinguishes lost DNA, inactive expression, and transient gains',()=>{
 const a=agent(1,{traits:['shell','colony'],alive:false}),b=agent(2,{traits:['shell','colony'],alive:false});
 const first=founder(a),second=founder(b);first.offspring=[3,4,5,6];second.offspring=[3];
 const evidence=(id,parents,encoded=true,retained=encoded)=>({id,parents,encoded,retained});
 const child=(id,parents,traits,structureGenes,traitEvidence,changes=[])=>({id,born:id*10,parents,traits,structureGenes,mode:parents.length===2?'sexual':'asexual',offspring:[],inheritance:{traits:traitEvidence,changes}});
 const shared=child(3,[1,2],['shell','colony'],['shell','colony'],[evidence('shell',[1,2]),evidence('colony',[1,2])]);
 const inactive=child(4,[1],[],['colony'],[evidence('shell',[1],false),evidence('colony',[1],true,false)],[{kind:'trait',id:'shell',from:true,to:false,cause:'mutation-loss'},{kind:'trait',id:'colony',from:true,to:false,cause:'dependency-inactive',dependencies:['shell']}]);
 const segregated=child(5,[1],['shell'],['shell'],[evidence('shell',[1]),evidence('colony',[1],false)],[{kind:'trait',id:'colony',from:true,to:false,cause:'segregation'}]);
 const transient=child(6,[1],['shell','colony'],['shell','colony'],[evidence('shell',[1]),evidence('colony',[1]),evidence('flagella',[],false)],[{kind:'trait',id:'flagella',from:false,to:true,cause:'mutation-gain'},{kind:'trait',id:'flagella',from:true,to:false,cause:'mutation-loss'}]);
 const live=[agent(3,{traits:shared.traits}),agent(4,{traits:inactive.traits,structureGenes:inactive.structureGenes}),agent(5,{traits:segregated.traits}),agent(6,{traits:transient.traits})];
 const result=diagnoseWorld(world(live,[first,second,shared,inactive,segregated,transient])).traits;
 const colony=result.rows.find(row=>row.id==='colony'),shell=result.rows.find(row=>row.id==='shell'),flagella=result.rows.find(row=>row.id==='flagella');
 assert.equal(result.records,6);assert.equal(result.founders,2);
 assert.equal(colony.birthCarriers,4);assert.equal(colony.founderCarriers,2);assert.equal(colony.descendantBirthCarriers,2);assert.equal(colony.livingCarriers,2);
 assert.equal(colony.parents,2);assert.equal(colony.transmittedBirths,2);assert.equal(colony.transmittingParents,2);
 assert.equal(colony.encodedBirthCarriers,5);assert.equal(colony.encodedLivingCarriers,3);assert.equal(colony.encodedTransmittedBirths,3);assert.equal(colony.inactiveBirthCarriers,1);
 assert.equal(colony.dependencyInactivations,1);assert.equal(colony.segregationLosses,1);assert.equal(colony.mutationLosses,0);
 assert.equal(shell.mutationLosses,1);assert.equal(flagella.mutationGains,1);assert.equal(flagella.expressedMutationGains,0);assert.equal(flagella.mutationLosses,1);
 assert.equal(colony.exampleBirth,1);assert.equal(colony.firstAppearanceTick,0);assert.equal(colony.lastBirthTick,60);
});

test('empty and frozen worlds produce finite summaries without writes or random draws',()=>{
 const empty=diagnoseWorld(world());assert.equal(empty.diversity.labels.effective,0);assert.equal(empty.morphology.cells,0);
 assert.deepEqual(empty.feeding.sources,[]);assert.deepEqual(empty.feeding.strategies,[]);assert.equal(empty.feeding.totalObservedIntake,0);
 assert.equal(empty.morphology.shape[0].mean,null);assert.equal(empty.traits.rows.every(row=>row.birthCarriers===0),true);
 const w=freeze(world([agent(1,{traits:['shell']})])),before=JSON.stringify(w),first=diagnoseWorld(w),second=diagnoseWorld(w);
 assert.deepEqual(first,second);assert.equal(JSON.stringify(w),before);
 assert.equal(first.resources.scope,'current');assert.equal(first.resources.nutrient,3);
 assert.doesNotMatch(JSON.stringify(first),/NaN|Infinity/);
});

test('observation desk labels current and cumulative evidence and provides real archive entry points',()=>{
 const w=world([agent(1,{traits:['shell'],feeding:{tick:600,sources:sources({photons:3})}})]),html=diagnosticsView(w);
 assert.match(html,/存续分群标签/);assert.match(html,/分群有效数量/);assert.match(html,/表达结构组合/);assert.match(html,/细胞群落个体/);
 assert.match(html,/实际摄入 \/ 个体/);assert.match(html,/光能合成/);assert.match(html,/出生表达/);assert.match(html,/现存蓝图/);assert.match(html,/出生时潜伏/);assert.match(html,/不表示每代新发生一次失活/);
 assert.match(html,/data-panel="diagnostics-inheritance"/);assert.match(html,/data-observe="1"/);
 assert.match(html,/其他列累计到此刻/);assert.match(html,/不直接等同于自然物种/);assert.match(html,/采样 T \+ 600/);
 assert.doesNotMatch(html,/undefined|NaN|物种数|课程/);
 const empty=diagnosticsView(world());assert.match(empty,/等待第一批生命/);assert.match(empty,/尚无附加结构/);assert.doesNotMatch(empty,/undefined|NaN/);
});

test('observation desk caches each world for 24 steps instead of repeatedly scanning its archive',()=>{
 const w=world([agent(1)]),records=w.records;let reads=0;
 Object.defineProperty(w,'records',{get(){reads++;return records;}});
 const initial=diagnosticsView(w),initialReads=reads;
 w.tick=623;assert.equal(diagnosticsView(w),initial);assert.equal(reads,initialReads);
 w.tick=624;assert.match(diagnosticsView(w),/采样 T \+ 624/);assert.ok(reads>initialReads);
 const other=world();other.tick=624;assert.match(diagnosticsView(other),/世界中暂时没有存活个体/);
 w.tick=12;assert.match(diagnosticsView(w),/采样 T \+ 12/);
});

test('individual archive distinguishes latent structure blueprints and includes measured cell growth expenditure',()=>{
 const energy={intake:10,maintenance:2,movement:1,reproduction:0,hunting:0,stress:0,growth:3.25,sources:sources({photons:7,prey:3})};
 const a=agent(1),b=agent(2,{energyLedger:energy,cells:2,feeding:{tick:600,sources:sources({prey:3})}});
 const parent={...founder(a),shape:a.shape,genes:Array(12).fill(.5),generation:0,death:null,offspring:[2]};
 const child={...founder(b),shape:b.shape,genes:Array(12).fill(.5),generation:1,origin:1,neutralAllele:0,reproduction:{mode:'asexual'},mode:'asexual',born:30,birthSpecies:1,parents:[1],death:null,energy,
  cells:1,lifeHistory:{peakCells:3,divisions:3,releases:1,matureAt:48,materialFromParent:1.25},structureGenes:['colony'],inheritance:{genes:[],shape:[],neutralAllele:{parent:1,before:0,mutated:false},traits:[{id:'colony',parents:[1],encoded:true,retained:false},{id:'shell',parents:[1],encoded:false,retained:false},{id:'pigment',parents:[],encoded:true,retained:true}],changes:[]}};
 const w=world([a,b],[parent,child]);w.species=[{id:1,name:'测试分群'}];
 const html=observationView(w,2,null);
 assert.match(html,/细胞生长/);assert.match(html,/繁殖投入只计本次从亲本储备扣除的能量/);assert.match(html,/另记在子代生活史/);assert.match(html,/3\.25/);assert.match(html,/近期主摄入：捕食/);assert.match(html,/累计来源/);assert.match(html,/群落的生长与释放/);assert.match(html,/T \+ 48/);assert.match(html,/潜伏蓝图 · 尚未表达/);assert.match(html,/蓝图丢失/);assert.match(html,/光合色素 · 出生变异 · 已表达/);
 assert.doesNotMatch(html,/undefined|NaN/);
});
