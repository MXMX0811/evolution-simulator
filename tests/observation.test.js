import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/engine.js';
import {observationView,snapshotView} from '../dist/observation-view.js';
import {compareWorlds} from '../dist/comparison.js';
import {lineageView,journalView} from '../dist/views.js';

test('a birth remains inspectable with its parents and neutral inheritance after death and restore',()=>{
 const world=new World({origin:false,seed:'ARCHIVE-TEST'});world.step(220);
 const child=world.agents.find(a=>a.parents.length);assert.ok(child);
 world.kill(child,'灾变');world.agents=world.agents.filter(a=>a.alive);world.census();
 const restored=World.restore(world.serialize());
 const html=observationView(restored,child.id,child.parents[0],'protection','relative');
 assert.match(html,new RegExp(`data-individual="${child.id}"`));
 assert.match(html,new RegExp(`data-observe="${child.parents[0]}"`));
 assert.match(html,/历史标本/);assert.match(html,/中性位点/);assert.match(html,/实际能量记录/);
 assert.doesNotMatch(html,/undefined|NaN/);
 assert.doesNotMatch(journalView(restored),/undefined|NaN/);
 assert.doesNotMatch(lineageView(restored,null),/undefined|NaN/);
});

test('paired branches leave original world intact and share external future across biological divergence',()=>{
 const world=new World({origin:false,volatility:1,seed:'PAIRED-ENV'});world.step(840);
 const snapshot=world.serialize(),first=compareWorlds(snapshot,'cooling',0,120),again=compareWorlds(snapshot,'cooling',0,120);
 assert.equal(world.serialize(),snapshot);assert.deepEqual(first,again);
 assert.equal(first.control.tick,960);assert.equal(first.altered.tick,960);
 assert.ok(first.control.naturalEvents.length);
 assert.deepEqual(first.control.naturalEvents,first.altered.naturalEvents);
 assert.equal(first.control.environmentRandomState,first.altered.environmentRandomState);
 assert.ok(Math.abs(first.control.energyError)<1e-6&&Math.abs(first.altered.energyError)<1e-6);
});

test('comparison display excludes censored durations from equal-window means',()=>{
 const world=new World({origin:false,seed:'CENSOR'}),snapshot={text:world.serialize(),tick:0,seed:'CENSOR',population:104,bytes:1};
 const truncated={start:0,requestedSteps:600,control:{tick:10,population:104,saturated:true},altered:{tick:600,population:120,saturated:false}};
 const html=snapshotView({snapshot,results:[truncated],change:'cooling',busy:false,completed:1,error:null});
 assert.match(html,/尚无完整配对/);assert.doesNotMatch(html,/<table/);
 assert.match(html,/实际/);assert.doesNotMatch(html,/NaN|undefined/);
});
