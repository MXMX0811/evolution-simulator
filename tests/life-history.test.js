import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/engine.js';
import {GENES,traitClosure} from '../dist/biology.js';
import {develop} from '../dist/development.js';
import {growColony,matureCells,readyToReproduce} from '../dist/life-history.js';
import {injectLife,balances,preySuitability} from '../dist/ecology.js';
function setup(traits=['colony']){
 const w=new World({origin:false,founders:0,mutation:0,reproductionMode:'asexual'}),genes=GENES.map(()=>.4),shape=Array(8).fill(.5),s=w.createSpecies(genes,null,shape),a=w.makeAgent(s,200,200,genes,traitClosure(traits),0,40,shape);w.agents.push(a);w.liveCount=1;injectLife(w,a);w.census();return {w,a};
}
function grow(w,a){while(!readyToReproduce(a)){a.age+=12;w.tick+=12;assert.ok(growColony(w,a));}}
function balanced(w){assert.ok(Math.abs(balances(w).energyError)<1e-8);assert.ok(Math.abs(balances(w).nutrientError)<1e-8);}
test('clonal division pays for material and respiration and gates reproduction',()=>{
 const {w,a}=setup();a.age=24;assert.equal(w.reproduce(a,[]),null);const energy=a.energy,body=a.bodyEnergy;grow(w,a);assert.equal(a.cells,matureCells(a));assert.ok(a.energy<energy);assert.ok(a.bodyEnergy>body);assert.equal(w.records[a.id].lifeHistory.divisions,a.cells-1);balanced(w);
});
test('colony releases a paid single-unit propagule then must regrow',()=>{
 const {w,a}=setup();grow(w,a);const cells=a.cells,body=a.bodyEnergy,c=w.reproduce(a,[]);assert.ok(c);assert.equal(c.cells,1);assert.equal(a.cells,cells-1);assert.ok(a.bodyEnergy<body);assert.ok(w.records[c.id].lifeHistory.materialFromParent>0);assert.equal(readyToReproduce(a),false);balanced(w);const restored=World.restore(w.serialize());assert.deepEqual(restored.agents,w.agents);assert.deepEqual(restored.records,w.records);
});
test('size affects predator access and tissue transport improves only with growth',()=>{
 const {a}=setup();const single=develop(a,1),group=develop(a,4);assert.equal(group.mass,single.mass*4);assert.ok(group.surface<4);assert.ok(group.speed<single.speed);const predator={development:single};assert.ok(preySuitability(predator,{development:group})<preySuitability(predator,{development:single}));const {a:tissue}=setup(['tissue']);assert.equal(develop(tissue,1).surface,1);assert.ok(develop(tissue,4).surface>group.surface);
});
test('insufficient reserves do not create colony biomass',()=>{
 const {w,a}=setup();a.energy=4;a.age=24;const before=[a.cells,a.bodyEnergy,a.energy,w.ecology.heat];assert.equal(growColony(w,a),false);assert.deepEqual([a.cells,a.bodyEnergy,a.energy,w.ecology.heat],before);
});

test('restore rejects invented biomass and incompatible encoded expression',()=>{
 const {w,a}=setup();for(const change of [d=>d.world.agents[0].cells=5,d=>d.world.agents[0].bodyEnergy*=2,d=>d.world.agents[0].structureGenes.push('pigment'),d=>d.world.records[a.id].lifeHistory.divisions=3]){const d=JSON.parse(w.serialize());change(d);assert.throws(()=>World.restore(JSON.stringify(d)));}
});
