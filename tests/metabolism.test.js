import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/engine.js';
import {allocation,uptake,metabolicInvestment} from '../dist/metabolism.js';
import {synthesize,ingest} from '../dist/ecology.js';
test('a saturated uptake budget trades one pathway against the others',()=>{
 const w=new World({origin:false,founders:1}),a=w.agents[0];a.genes.fill(.8);const before=allocation(a);a.genes[0]=1;const after=allocation(a);
 assert.ok(after.photons>before.photons);for(const key of ['redox','prey','plankton','detritus'])assert.ok(after[key]<before[key]);assert.ok(Math.abs(Object.values(after).reduce((s,v)=>s+v,0)-1)<1e-12);
});
test('scaling all investments down cannot retain free uptake',()=>{
 const w=new World({origin:false,founders:1}),a=w.agents[0],f=w.fields[0];a.genes.fill(.4);const before=uptake(a,f,.6),cost=metabolicInvestment(a);a.genes.fill(.2);const after=uptake(a,f,.6);
 assert.ok(metabolicInvestment(a)<cost);for(const key of Object.keys(before))assert.ok(after[key]<before[key]);
});
test('real source intake is archived and recent intake decays once per elapsed interval',()=>{
 const w=new World({origin:false,founders:1}),a=w.agents[0],f=w.fieldAt(a.x,a.y);a.energy=1;f.photons=3;f.nutrient=3;f.detritus=3;
 const photo=synthesize(w,a,f,'photons',1,.8);w.tick=600;const detritus=ingest(w,a,f,'detritus',1,.7);
 assert.ok(Math.abs(a.feeding.sources.photons-photo/Math.E)<1e-12);assert.equal(a.feeding.sources.detritus,detritus);assert.equal(w.records[a.id].energy.sources.photons,photo);assert.equal(a.energyLedger.intake,photo+detritus);
});

test('body contact divides one uptake budget and stays continuous across patch borders',async()=>{
 const {contactPatches}=await import('../dist/metabolism.js'),{develop}=await import('../dist/development.js'),w=new World({origin:false,founders:1}),a=w.agents[0];a.traits=['colony'];a.cells=4;a.development=develop(a,a.cells);
 for(const x of [200,209.99,210,210.01,220]){a.x=x;a.y=200;const parts=contactPatches(w,a,48,32);assert.ok(Math.abs(parts.reduce((s,p)=>s+p.weight,0)-1)<1e-12);assert.ok(parts.length>1);assert.ok(parts.every(p=>p.coverage>0&&p.coverage<=1));assert.ok(Math.abs(parts.reduce((s,p)=>s+p.coverage,0)-a.development.mass**(2/3))<1e-10);}
 a.x=1;a.y=1;assert.ok(contactPatches(w,a,48,32).reduce((s,p)=>s+p.weight,0)<1,'outside-world area grants no free intake');
});
test('a larger footprint can access more photons without duplicating its demand',async()=>{
 const {contactPatches}=await import('../dist/metabolism.js'),{develop}=await import('../dist/development.js'),w=new World({origin:false,founders:1}),a=w.agents[0];a.x=220;a.y=220;a.traits=['colony'];a.genes.fill(.01);a.genes[0]=1;
 const collect=cells=>{a.cells=cells;a.development=develop(a,cells);a.energy=0;let total=0;for(const f of w.fields){f.photons=.3;f.nutrient=10;f.light=1;}for(const part of contactPatches(w,a,48,32)){const demand=uptake(a,part.field,.6).photons*part.weight;total+=synthesize(w,a,part.field,'photons',Math.min(part.field.photons*part.coverage,demand),.86);}return total;};
 const one=collect(1),four=collect(4);assert.ok(four>one*2);assert.ok(four<=.3*a.development.mass**(2/3)*.86+1e-10);
});
test('radiant intake does not enter the oxygen-producing photosynthesis ledger',()=>{
 const w=new World({origin:false,founders:1}),a=w.agents[0],f=w.fieldAt(a.x,a.y),photo=w.ecology.photo;f.radiant=1;f.nutrient=1;assert.ok(synthesize(w,a,f,'radiant',.1,.65)>0);assert.equal(w.ecology.photo,photo);assert.ok(a.energyLedger.sources.radiant>0);
});
