import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/engine.js';
import {allocation} from '../dist/metabolism.js';

test('each step recomputes metabolic allocation after a genotype intervention',()=>{
 const original=new World({origin:false,founders:1,seed:'BUDGET-CACHE'}),intervened=World.restore(original.serialize());
 for(const world of [original,intervened]){const a=world.agents[0];a.genes[2]=.95;a.genes[12]=.7;}
 for(const a of intervened.agents)a.metabolismBudget={photons:0,redox:0,prey:0,plankton:0,detritus:0};
 original.step(40);intervened.step(40);
 assert.deepEqual(original.agents,intervened.agents);assert.deepEqual(original.fields,intervened.fields);
 assert.deepEqual(original.ecology,intervened.ecology);assert.equal(original.rng.state,intervened.rng.state);
 for(const a of original.agents)assert.deepEqual(a.metabolismBudget,allocation(a));
});

test('restoring a world derives metabolic allocation from inherited parameters',()=>{
 const world=new World({origin:false,founders:1,seed:'RESTORE-BUDGET'});world.step(100);
 const data=JSON.parse(world.serialize());
 for(const a of data.world.agents)a.metabolismBudget={photons:0,redox:0,prey:0,plankton:0,detritus:0};
 const restored=World.restore(JSON.stringify(data));
 assert.deepEqual(world.agents,restored.agents);
 world.step(40);restored.step(40);
 assert.deepEqual(world.agents,restored.agents);assert.deepEqual(world.fields,restored.fields);
 assert.deepEqual(world.ecology,restored.ecology);assert.equal(world.rng.state,restored.rng.state);
});
