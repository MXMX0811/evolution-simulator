import test from 'node:test';
import assert from 'node:assert/strict';
import {GENES,TRAITS,TRAIT_INDEX,traitClosure} from '../dist/biology.js';
import {SHAPE_GENES} from '../dist/development.js';
import {expressStructures,inheritGenome} from '../dist/heredity.js';
import {Random} from '../dist/engine.js';

const reproduction={mode:'facultative',signal:.5,tolerance:.17,socialSignal:.5,socialTolerance:.22};
function parent(id,structureGenes){return {id,origin:1,genes:GENES.map(()=>.5),shape:SHAPE_GENES.map(()=>.5),structureGenes:[...structureGenes],traits:expressStructures(structureGenes),reproduction:{...reproduction},neutralAllele:id%2};}
function world(seed='BLUEPRINTS',mutation=0){return {config:{mutation,fiction:true},rng:new Random(seed),markerRng:new Random(seed+':neutral')};}

test('a missing prerequisite makes downstream blueprints inactive and restoring it restores expression',()=>{
 const encoded=['cilia','filter'];
 assert.deepEqual(expressStructures(encoded),[]);
 assert.deepEqual(expressStructures([...encoded,'flagella']),['flagella','cilia','filter']);
 assert.deepEqual(encoded,['cilia','filter']);
});

test('one loss attempt removes one blueprint without cascading permanent deletions',()=>{
 // Adhesion has no social-investment threshold. Include its blueprint so zero
 // parameter values suppress gains and this fixture isolates the loss attempt.
 const a=parent(1,['flagella','cilia','colony','filter']),w=world('LOSS',1);
 a.genes.fill(0);w.rng={next:()=>0,normal:()=>0,pick:values=>values[0]};
 const dna=inheritGenome(w,a,null);
 assert.deepEqual(dna.inheritance.changes.filter(x=>x.cause==='mutation-gain'),[]);
 assert.deepEqual(dna.structureGenes,['cilia','colony','filter']);assert.deepEqual(dna.traits,['colony']);
 assert.deepEqual(dna.inheritance.changes.filter(x=>x.cause==='mutation-loss').map(x=>x.id),['flagella']);
 const inactive=dna.inheritance.changes.filter(x=>x.cause==='dependency-inactive');
 assert.deepEqual(inactive.map(x=>[x.id,x.dependencies]),[['cilia',['flagella']],['filter',['cilia']]]);
 assert.deepEqual(dna.inheritance.traits.map(x=>[x.id,x.encoded,x.retained]),[['flagella',false,false],['cilia',true,false],['colony',true,true],['filter',true,false]]);
 assert.deepEqual(expressStructures([...dna.structureGenes,'flagella']),a.traits);
});

test('inactive blueprints keep their parental origin across sexual and clonal inheritance',()=>{
 const a=parent(1,['cilia','filter']),b=parent(2,[]),w=world();
 w.rng={next:()=>0,normal:()=>0,pick:values=>values[0]};
 const child=inheritGenome(w,a,b);
 assert.deepEqual(child.structureGenes,a.structureGenes);assert.deepEqual(child.traits,[]);
 assert.deepEqual(child.inheritance.traits,[{id:'cilia',parents:[1],retained:false,encoded:true},{id:'filter',parents:[1],retained:false,encoded:true}]);
 const descendant=inheritGenome(w,{...child,id:3},null);
 assert.deepEqual(descendant.structureGenes,a.structureGenes);
 assert.ok(descendant.inheritance.traits.every(x=>x.parents.length===1&&x.parents[0]===3&&x.encoded&&!x.retained));
});

test('recombination traces shared and segregated blueprints independently of expression',()=>{
 const a=parent(1,['pigment','cilia','filter']),b=parent(2,['pigment']),w=world();
 w.rng={next:()=>.75,normal:()=>0,pick:values=>values[0]};
 const dna=inheritGenome(w,a,b);
 assert.deepEqual(dna.structureGenes,['pigment']);
 assert.deepEqual(dna.inheritance.traits.find(x=>x.id==='pigment'),{id:'pigment',parents:[1,2],retained:true,encoded:true});
 for(const id of ['cilia','filter']){
  assert.deepEqual(dna.inheritance.traits.find(x=>x.id===id),{id,parents:[1],retained:false,encoded:false});
  assert.ok(dna.inheritance.changes.some(x=>x.id===id&&x.cause==='segregation'));
 }
});

test('conflict resolution has no body-plan order preference and never expresses orphaned structures',()=>{
 const a=parent(1,traitClosure(['segments','camera'])),b=parent(2,traitClosure(['tentacles','bell'])),w=world();
 let bilateral=0,radial=0,conflicts=0;
 for(let i=0;i<4000;i++){
  const dna=inheritGenome(w,a,b);
  bilateral+=Number(dna.traits.includes('bilateral'));radial+=Number(dna.traits.includes('radial'));
  assert.ok(!(dna.structureGenes.includes('bilateral')&&dna.structureGenes.includes('radial')));
  for(const id of dna.traits)assert.ok(TRAITS[TRAIT_INDEX[id]].parents.every(p=>dna.traits.includes(p)));
  for(const change of dna.inheritance.changes.filter(x=>x.cause==='structural-conflict')){conflicts++;assert.ok(!dna.structureGenes.includes(change.id));}
 }
 assert.ok(conflicts>0);assert.ok(Math.abs(bilateral-radial)<160,`${bilateral} versus ${radial}`);
});

test('blueprint expression and inheritance do not use the neutral marker or its random stream',()=>{
 const a=parent(1,traitClosure(['camera'])),b=parent(2,traitClosure(['bell'])),w1=world('NEUTRAL',.09),w2=world('NEUTRAL',.09);
 for(let i=0;i<57;i++)w2.markerRng.next();
 const result1=inheritGenome(w1,a,b),result2=inheritGenome(w2,{...a,neutralAllele:1-a.neutralAllele},{...b,neutralAllele:1-b.neutralAllele});
 for(const key of ['genes','shape','structureGenes','traits','reproduction'])assert.deepEqual(result1[key],result2[key]);
 assert.equal(w1.rng.state,w2.rng.state);
 assert.deepEqual(result1.inheritance.changes.filter(x=>x.kind!=='neutralAllele'),result2.inheritance.changes.filter(x=>x.kind!=='neutralAllele'));
 assert.equal(result1.genes.length,GENES.length);
});
