import test from 'node:test';
import assert from 'node:assert/strict';
import {World,geneticDistance,compatible,recognizes} from '../dist/engine.js';
import {develop} from '../dist/development.js';
import {TRAITS,TRAIT_INDEX,has,phenotype,traitClosure} from '../dist/biology.js';
const options={seed:'TEST-12',origin:false,founders:2};
test('same seed and interventions reproduce identical individuals and histories',()=>{
 const a=new World(options),b=new World(options);for(const w of[a,b]){w.step(260);w.trigger('winter');w.step(120);}
 assert.deepEqual(a.summary(),b.summary());assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.history,b.history);
});
test('a saved world resumes the exact random trajectory',()=>{
 const a=new World(options);a.step(380);a.trigger('bloom');const b=World.restore(a.serialize());a.step(240);b.step(240);assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.summary(),b.summary());
});
test('crossovers use both genomes and never invent genes when mutation is zero',()=>{
 const w=new World({...options,mutation:0});const a=w.agents[0],b=w.agents[1];a.genes.fill(.1);b.genes.fill(.9);
 const dna=w.inherit(a,b);assert.ok(dna.genes.includes(.1)&&dna.genes.includes(.9));assert.ok(dna.genes.every(v=>v===.1||v===.9));assert.equal(dna.mutations,0);
});
test('independent reproductive origins cannot exchange genes, while compatible adults can',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],other=w.agents.find(b=>b.species!==a.species);
 Object.assign(a,{age:50,energy:30,cooldown:0});Object.assign(other,{age:50,energy:30,cooldown:0,x:a.x,y:a.y});
 const child=w.reproduce(a,[other]);assert.equal(w.totalCrossovers,0);assert.deepEqual(child.genes,a.genes);assert.equal(other.energy,30);
 const kin=w.agents[1];Object.assign(a,{energy:30,cooldown:0});Object.assign(kin,{age:50,energy:30,cooldown:0,x:a.x,y:a.y});w.reproduce(a,[kin]);assert.equal(w.totalCrossovers,1);
});
test('reproduction spends more parental energy than it creates in the offspring',()=>{
 const w=new World(options),a=w.agents[0],b=w.agents[1];Object.assign(a,{age:30,energy:30,cooldown:0});Object.assign(b,{age:30,energy:30,cooldown:0,x:a.x,y:a.y});const c=w.reproduce(a,[b]);assert.ok(Math.abs(a.energy+b.energy+c.energy+c.bodyEnergy-58.8)<1e-10);
});
test('inherited and mutated structures always retain structural prerequisites',()=>{
 const w=new World(options),a=w.agents[0],b=w.agents[1];a.traits=TRAITS.map(t=>t.id);b.traits=[];
 for(let n=0;n<300;n++){const c=w.inherit(a,b);for(const t of TRAITS)if(has(c,t.id))assert.ok(t.parents.every(p=>has(c,p)));}
});
test('fiction-disabled worlds never mutate into speculative traits',()=>{
 const w=new World({...options,fiction:false,mutation:.3}),a=w.agents[0];a.genes.fill(.9);a.traits=TRAITS.filter(t=>t.kind!=='fiction'&&t.id!=='radial').map(t=>t.id);
 for(let n=0;n<300;n++){const c=w.inherit(a,null);for(const t of TRAITS.filter(t=>t.kind==='fiction'))assert.equal(has(c,t.id),false);}
});
test('local resources remain finite and cannot become negative during competition',()=>{
 const w=new World(options);w.step(1800);assert.ok(w.totalBirths>0);assert.ok(w.totalMutations>0);assert.ok(w.totalCrossovers>0);assert.ok(w.fields.every(f=>Number.isFinite(f.nutrient)&&f.nutrient>=0));assert.ok(w.agents.every(a=>Number.isFinite(a.energy)&&a.energy>0));
});
test('extinction is persistent and is recorded once',()=>{
 const w=new World(options);for(const a of w.agents)w.kill(a,'灾变');w.agents=[];w.census();w.step(300);assert.equal(w.agents.length,0);assert.equal(w.events.filter(e=>e.type==='extinction').length,2);assert.ok(w.species.every(s=>s.traitCounts.every(x=>x===0)));
});
test('nutrient recovery allows starving spores to wake',()=>{
 const w=new World({...options,light:0,resources:.1}),a=w.agents[0];w.agents=[a];a.traits=['shell','spore'];a.form=phenotype(a.traits);a.energy=4;a.genes.fill(.3);a.genes[1]=.8;a.genes[10]=.1;for(const f of w.fields)f.nutrient=0;w.step();assert.equal(a.sleeping,true);
 w.config.light=2;w.config.resources=3;for(const f of w.fields)f.nutrient=2;w.step();assert.equal(a.sleeping,false);
});
test('finite-duration events expire, while sea retreat changes habitat permanently',()=>{
 const w=new World(options);w.trigger('winter');assert.ok(w.environment.temperature<10);w.step(451);assert.ok(!w.effects.some(e=>e.type==='winter'));const sea=w.config.sea;w.trigger('drought');assert.equal(w.config.sea,sea-.13);
});
test('capacity is a visible pause, not a fabricated ecological equilibrium',()=>{
 const w=new World(options);w.capacity=w.agents.length;w.step();assert.equal(w.saturated,true);const tick=w.tick;w.step(10);assert.equal(w.tick,tick);assert.ok(w.events.some(e=>e.type==='capacity'));
});
test('malformed save imports are rejected before replacing a world',()=>{
 assert.throws(()=>World.restore('{broken'));assert.throws(()=>World.restore('{"version":2}'));const w=new World(options);const d=JSON.parse(w.serialize());d.world.agents[0].genes[0]='bad';assert.throws(()=>World.restore(JSON.stringify(d)));
});
test('inherited recognition differences prevent crossover within the same labeled species',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];a.reproduction.signal=.05;b.reproduction.signal=.95;Object.assign(a,{age:30,energy:30,cooldown:0});Object.assign(b,{age:30,energy:30,cooldown:0,x:a.x,y:a.y});w.reproduce(a,[b]);assert.equal(w.totalCrossovers,0);assert.equal(b.energy,30);
});
test('geography alone cannot relabel genetically identical populations',()=>{
 const w=new World({...options,founders:1});w.agents.forEach((a,i)=>{a.genes.fill(.4);a.x=i<13?100:700;a.y=100;});w.census();w.speciate();w.speciate();w.speciate();assert.equal(w.species.length,1);
});
test('repeated snapshots of the same adults cannot establish persistent descendant divergence',()=>{
 const w=new World({...options,founders:1});w.agents.forEach((a,i)=>{a.genes.fill(i<13?.2:.65);a.x=i<13?100:700;a.y=100;});w.census();for(const tick of[0,144,288,432]){w.tick=tick;w.speciate();}assert.equal(w.species.length,1);
});
test('persistent divergence is registered only after observed reproduction and does not impose isolation',()=>{
 const w=new World({...options,mutation:0,founders:1});w.agents.forEach((a,i)=>{a.genes.fill(i<13?.2:.65);a.x=i<13?100:700;a.y=100;});w.census();w.speciate();
 for(const tick of[144,288]){w.tick=tick;for(const a of [...w.agents.slice(0,2)]){Object.assign(a,{age:30,energy:40,cooldown:0});const child=w.reproduce(a,[]);assert.ok(child);}w.speciate();}
 assert.equal(w.species.length,2);const branch=w.species[1];assert.ok(branch.speciationEvidence.newborns>=4);assert.ok(branch.speciationEvidence.contributors>=2);assert.equal(branch.speciationEvidence.kind,'divergent-lineage');assert.ok(branch.speciationEvidence.compatiblePairs>0);
});
test('all 72 structures have ordered prerequisites, independent IDs and compatible closures',()=>{
 assert.equal(TRAITS.length,72);assert.equal(new Set(TRAITS.map(t=>t.id)).size,72);
 for(const t of TRAITS){const closure=traitClosure([t.id]);for(const id of closure){const part=TRAITS[TRAIT_INDEX[id]];assert.ok(part.parents.every(p=>closure.indexOf(p)<closure.indexOf(id)));assert.ok(!(part.excludes||[]).some(p=>closure.includes(p)));}}
 const w=new World({...options,mutation:0}),a=w.agents[0];a.traits=traitClosure(['crystalSense']);a.genes.fill(.8);assert.deepEqual(w.inherit(a,null).traits,a.traits);assert.ok(a.traits.includes('crystalSense'));assert.ok(!a.traits.includes('pigment'));
});
test('sexual recombination never retains incompatible body plans or orphaned organs',()=>{
 const w=new World(options),a=w.agents[0],b=w.agents[1];a.traits=traitClosure(['camera','segments']);b.traits=traitClosure(['tentacles','bell']);a.genes.fill(.8);b.genes.fill(.8);
 for(let n=0;n<800;n++){const dna=w.inherit(a,b);assert.ok(!(has(dna,'radial')&&has(dna,'bilateral')));for(const id of dna.traits)assert.ok(TRAITS[TRAIT_INDEX[id]].parents.every(p=>has(dna,p)));}
});
test('filter feeders and scavengers consume finite supplies and wake when food returns',()=>{
 for(const id of ['filter','detritus']){const w=new World({...options,light:0,resources:.1,founders:1});const a=w.makeAgent(w.species[0],100,100,Array(12).fill(.3),traitClosure([id,'spore']),0,4);w.agents=[a];for(const f of w.fields){f.nutrient=0;f.plankton=id==='filter'?.6:0;f.detritus=id==='detritus'?2:0;}w.step();assert.equal(a.sleeping,false,id);assert.ok(w.fieldAt(a.x,a.y)[id==='filter'?'plankton':'detritus']<(id==='filter'?.6:2));assert.ok(w.fields.every(f=>f.plankton>=0&&f.detritus>=0&&f.photons>=0));}
});
test('parental care transfers paid energy to offspring instead of creating it',()=>{
 const w=new World({...options,mutation:0}),s=w.species[0];const a=w.makeAgent(s,100,100,Array(12).fill(.6),traitClosure(['brood']),0,40);a.age=50;w.agents=[a];const child=w.reproduce(a,[]);assert.ok(child);assert.ok(Math.abs(a.energy+child.energy+child.bodyEnergy-38.8)<1e-10);assert.equal(child.energy,14);
});
test('habitat structures carry different effects and maintenance costs',()=>{
 const fish=phenotype(traitClosure(['fins'])),walker=phenotype(traitClosure(['limbs'])),brood=phenotype(traitClosure(['brood']));assert.ok(fish.swim>fish.landSpeed);assert.ok(walker.landSpeed>walker.swim);assert.ok(fish.cost>0&&walker.cost>0&&brood.cost>0);assert.equal(brood.childEnergy,brood.birthCost);
});
test('conflicting inherited body plans have no catalogue-order advantage',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];a.traits=traitClosure(['bilateral']);b.traits=traitClosure(['radial']);let left=0,right=0;
 for(let i=0;i<10000;i++){const dna=w.inherit(a,b);if(has(dna,'bilateral'))left++;if(has(dna,'radial'))right++;}assert.ok(Math.abs(left-right)<250,`${left} versus ${right}`);
});
test('damaged v5 structures are rejected instead of multiplying effects',()=>{
 const w=new World(options);for(const traits of [['vacuole','vacuole'],['bilateral','radial'],['camera']]){const save=JSON.parse(w.serialize());save.world.agents[0].traits=traits;assert.throws(()=>World.restore(JSON.stringify(save)));}
});
test('naturally registered branches carry descendant evidence without requiring a branch in every run',()=>{
 const w=new World();w.step(8000);assert.ok(!w.saturated);for(const s of w.species.filter(s=>s.parent)){assert.ok(s.speciationEvidence.gap>=.1);assert.ok(s.speciationEvidence.cohort>=8);assert.ok(s.speciationEvidence.newborns>=4);assert.ok(s.speciationEvidence.tick-s.speciationEvidence.since>=288);}
});
test('morphology crosses over, mutates and survives exact save resumption',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];a.shape.fill(.1);b.shape.fill(.9);const dna=w.inherit(a,b);assert.ok(dna.shape.includes(.1)&&dna.shape.includes(.9));assert.ok(dna.shape.every(v=>v===.1||v===.9));w.config.mutation=1;const changed=w.inherit(a,b);assert.ok(changed.shape.some(v=>v!==.1&&v!==.9));assert.ok(changed.shape.every(v=>v>=0&&v<=1));
 a.development=develop(a);b.development=develop(b);for(const parent of[a,b]){w.records[parent.id].shape=[...parent.shape];}const restored=World.restore(w.serialize());w.step(100);restored.step(100);assert.deepEqual(w.agents,restored.agents);assert.deepEqual(w.lineages,restored.lineages);
});
test('shape divergence alone does not fabricate a reproductive barrier',()=>{
 const w=new World({...options,mutation:0,founders:1}),a=w.agents[0],b=w.agents[1];a.shape.fill(.1);b.shape.fill(.9);a.genes.fill(.1);b.genes.fill(.9);Object.assign(a,{age:30,energy:40,cooldown:0});Object.assign(b,{age:30,energy:40,cooldown:0,x:a.x,y:a.y});assert.ok(compatible(a,b));const child=w.reproduce(a,[b]);assert.equal(w.totalCrossovers,1);assert.deepEqual(child.parents,[a.id,b.id]);
});
test('repeated budding retains binary ancestry, continuation identity and immutable snapshots',()=>{
 const w=new World({...options,founders:1}),a=w.species[0],root=w.lineages[0],before=structuredClone(a.specimen);w.tick=100;const b=w.createSpecies(a.mean,a);w.tick=200;const c=w.createSpecies(a.mean,a);b.specimen=structuredClone(before);w.tick=300;const d=w.createSpecies(b.mean,b);const nodes=new Map(w.lineages.map(n=>[n.id,n]));assert.equal(root.children.length,2);assert.equal(nodes.get(a.lineage).parent,nodes.get(c.lineage).parent);assert.notEqual(nodes.get(a.lineage).parent,nodes.get(b.lineage).parent);assert.equal(nodes.get(b.lineage).parent,nodes.get(d.lineage).parent);a.specimen.shape[0]=.99;assert.deepEqual(root.snapshot,before);assert.ok(w.lineages.every(n=>n.children.length===0||n.children.length===2));assert.deepEqual(World.restore(w.serialize()).lineages,w.lineages);
});
test('v5 rejects missing morphology, old schema and broken ancestry',()=>{
 const w=new World(options);for(const damage of [d=>d.version=2,d=>delete d.world.agents[0].shape,d=>d.world.lineages[0].children=[999],d=>d.world.species[0].lineage=999]){const d=JSON.parse(w.serialize());damage(d);assert.throws(()=>World.restore(JSON.stringify(d)));}
});

test('relabeling does not change mating, social recognition, predation or ecological trajectories',()=>{
 const a=new World({...options,founders:2}),b=World.restore(a.serialize());a.speciate=()=>{};b.speciate=()=>{};
 for(const individual of b.agents)individual.species=individual.species===1?2:1;
 a.step(700);b.step(700);
 const biological=w=>w.agents.map(({species,...individual})=>individual);
 assert.deepEqual(biological(a),biological(b));assert.equal(a.rng.state,b.rng.state);assert.deepEqual(a.fields,b.fields);assert.deepEqual(a.ecology,b.ecology);
});
test('classification and repeated census never consume biological or environmental random values',()=>{
 const w=new World(options),state=w.rng.state,environment=w.envRng.state;w.census();w.speciate();w.createSpecies(w.species[0].mean,w.species[0]);assert.equal(w.rng.state,state);assert.equal(w.envRng.state,environment);
});
test('compatible relatives recover gene exchange after receiving different labels',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1],branch=w.createSpecies(w.species[0].mean,w.species[0]);b.species=branch.id;
 Object.assign(a,{age:30,energy:40,cooldown:0});Object.assign(b,{age:30,energy:40,cooldown:0,x:a.x,y:a.y});assert.ok(recognizes(a,b));const c=w.reproduce(a,[b]);assert.deepEqual(c.parents,[a.id,b.id]);assert.equal(w.geneFlows.length,1);assert.equal(w.geneFlows[0].child,c.id);
});
test('obligate sexual individuals do not clone when no compatible mate exists',()=>{
 const w=new World({...options,reproductionMode:'sexual'}),a=w.agents[0];Object.assign(a,{age:30,energy:40,cooldown:0});const before=Object.keys(w.records).length;assert.equal(w.reproduce(a,[]),null);assert.equal(Object.keys(w.records).length,before);assert.equal(w.totalBirths,0);
});
test('successful births retain exact source alleles and actual mutation changes',()=>{
 const w=new World({...options,mutation:1}),a=w.agents[0],b=w.agents[1];Object.assign(a,{age:30,energy:40,cooldown:0});Object.assign(b,{age:30,energy:40,cooldown:0,x:a.x,y:a.y});const c=w.reproduce(a,[b]),record=w.records[c.id];
 assert.equal(record.mode,'sexual');for(const key of['genes','shape'])for(const entry of record.inheritance[key]){const parent=entry.parent===a.id?a:b;assert.equal(entry.before,parent[key][entry.index]);assert.equal(entry.after,c[key][entry.index]);assert.equal(entry.mutated,entry.before!==entry.after);}assert.ok(record.inheritance.changes.length);assert.ok(w.records[a.id].offspring.includes(c.id));assert.ok(w.records[b.id].offspring.includes(c.id));
});
test('dependency deletions identify the missing prerequisite instead of inventing mutations',()=>{
 const w=new World({...options,mutation:1}),a=w.agents[0];a.traits=traitClosure(['camera','segments','limbs']);let found=false;
 for(let i=0;i<1000&&!found;i++){const dna=w.inherit(a,null);const removed=dna.inheritance.changes.filter(c=>c.cause==='dependency-loss');if(removed.length){found=true;for(const change of removed){assert.ok(change.dependencies.length);assert.ok(!dna.traits.includes(change.id));}}}assert.ok(found);
});
test('deaths, interventions and individual energy budgets persist across exact restore',()=>{
 const w=new World(options);w.step(90);const a=w.agents[0];w.kill(a,'灾变');w.agents=w.agents.filter(a=>a.alive);w.setEnvironment({temperature:12,mutation:.06});const r=World.restore(w.serialize());assert.deepEqual(r.records,w.records);assert.equal(r.records[a.id].death.tick,w.tick);assert.deepEqual(r.interventions,w.interventions);const id=r.agents[0].id;r.step(20);w.step(20);assert.deepEqual(r.records,w.records);assert.strictEqual(r.records[id].energy,r.agents.find(a=>a.id===id).energyLedger);
});
test('external event randomness is independent of biological draws and impact population size',()=>{
 const a=new World(options),b=World.restore(a.serialize());for(let i=0;i<1000;i++)b.rng.next();b.agents=b.agents.slice(0,5);a.trigger('meteor');b.trigger('meteor');assert.deepEqual(a.impact,b.impact);assert.equal(a.envRng.state,b.envRng.state);assert.equal(a.interventions[0].type,'meteor');
});

test('complete event archive and parameter edits remain separate from the rolling display log',()=>{
 const w=new World(options);for(let i=0;i<220;i++)w.recordEvent('observation','证据记录',String(i));assert.equal(w.events.length,180);assert.ok(w.timeline.length>220);assert.throws(()=>w.setEnvironment({mutation:2}));assert.throws(()=>w.setEnvironment({light:-1}));const count=w.interventions.length;w.setEnvironment({mutation:.03});assert.equal(w.interventions.length,count+1);assert.match(w.events[0].detail,/随机突变概率/);const save=JSON.parse(w.serialize());save.world.records['1'].offspring=[999999];assert.throws(()=>World.restore(JSON.stringify(save)));
});

test('neutral marker values cannot change ecological decisions or their random trajectory',()=>{
 const a=new World({...options,mutation:0}),b=World.restore(a.serialize());for(const individual of b.agents){individual.neutralAllele=1-individual.neutralAllele;b.records[individual.id].neutralAllele=individual.neutralAllele;}a.step(900);b.step(900);
 const biological=w=>w.agents.map(({neutralAllele,...individual})=>individual);assert.deepEqual(biological(a),biological(b));assert.deepEqual(a.fields,b.fields);assert.deepEqual(a.ecology,b.ecology);assert.equal(a.rng.state,b.rng.state);assert.equal(a.envRng.state,b.envRng.state);
});
test('neutral marker records a real parental allele and explicit mutation',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];a.neutralAllele=0;b.neutralAllele=1;const marker=w.inherit(a,b).inheritance.neutralAllele;assert.equal(marker.before,marker.parent===a.id?0:1);assert.equal(marker.before,marker.after);assert.equal(marker.mutated,false);w.config.mutation=1;const dna=w.inherit(a,b);assert.equal(dna.neutralAllele,1-dna.inheritance.neutralAllele.before);assert.equal(dna.inheritance.neutralAllele.mutated,true);
});

test('restore rejects missing historical body, reproduction, energy and inheritance fields',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];Object.assign(a,{age:30,energy:40,cooldown:0});Object.assign(b,{age:30,energy:40,cooldown:0,x:a.x,y:a.y});const child=w.reproduce(a,[b]);w.kill(a,'灾变');w.agents=w.agents.filter(a=>a.alive);
 for(const damage of [d=>delete d.world.records[a.id].shape,d=>delete d.world.records[a.id].genes,d=>delete d.world.records[a.id].reproduction,d=>delete d.world.records[a.id].energy,d=>d.world.records[a.id].birthSpecies=999,d=>d.world.records[a.id].traits=['camera'],d=>delete d.world.records[child.id].inheritance.neutralAllele,d=>delete d.world.records[child.id].inheritance.genes,d=>delete d.world.records[child.id].inheritance.traits]){const d=JSON.parse(w.serialize());damage(d);assert.throws(()=>World.restore(JSON.stringify(d)));}
});
test('restore rejects one-way ancestry, contradictory living records and forged allele sources',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0],b=w.agents[1];Object.assign(a,{age:30,energy:40,cooldown:0});Object.assign(b,{age:30,energy:40,cooldown:0,x:a.x,y:a.y});const child=w.reproduce(a,[b]);
 for(const damage of [d=>d.world.records[a.id].offspring=[],d=>d.world.records[child.id].parents=[a.id],d=>d.world.records[a.id].shape[0]=1-d.world.records[a.id].shape[0],d=>d.world.records[a.id].energy.intake+=1,d=>d.world.records[a.id].death={tick:0,cause:'灾变',x:1,y:1},d=>d.world.records[child.id].inheritance.genes[0].before=-1,d=>d.world.records[child.id].inheritance.neutralAllele.mutated=true]){const d=JSON.parse(w.serialize());damage(d);assert.throws(()=>World.restore(JSON.stringify(d)));}
});
test('a real death preserves its existing v5 archive schema and exact continuation',()=>{
 const w=new World({...options,mutation:0}),a=w.agents[0];w.step(35);w.kill(a,'灾变');w.agents=w.agents.filter(a=>a.alive);assert.equal('species' in w.records[a.id].death,false);const restored=World.restore(w.serialize());assert.deepEqual(restored.records[a.id],w.records[a.id]);assert.deepEqual(restored.records[a.id].death,{tick:35,cause:'灾变',x:a.x,y:a.y});w.step(90);restored.step(90);assert.deepEqual(restored.records,w.records);assert.deepEqual(restored.agents,w.agents);
});
