import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrganism,MORPHOLOGY,previewSpecimen} from '../dist/morphology.js';
import {disposeOrganism} from '../dist/anatomy.js';
import {GENES,TRAITS,TRAIT_INDEX,traitClosure} from '../dist/biology.js';
import {develop,compatibleTraits,combinationSample} from '../dist/development.js';
const specimen=traits=>({genes:GENES.map(()=>.6),cells:1,shape:Array(8).fill(.5),traits:traitClosure(traits)});
function finite(model){let meshes=0;model.traverse(n=>{assert.ok([...n.position.toArray(),...n.scale.toArray()].every(Number.isFinite));if(n.geometry){meshes++;assert.ok(Array.from(n.geometry.attributes.position.array).every(Number.isFinite));assert.ok(Array.from(n.geometry.attributes.normal.array).every(Number.isFinite));}});assert.ok(meshes>0);}
test('all 72 structure previews generate finite surface and anatomy geometry',()=>{
 assert.equal(Object.keys(MORPHOLOGY).length,TRAITS.length);
 for(const t of TRAITS)for(const anatomy of [false,true]){const model=buildOrganism(previewSpecimen('trait:'+t.id),'#88dfbc',{anatomy});finite(model);disposeOrganism(model);}
});
test('inherited shape parameters change the mesh and ecological cost',()=>{
 const a=specimen([]),b=specimen([]);a.shape.fill(.1);b.shape.fill(.8);const x=buildOrganism(a,'#88dfbc'),y=buildOrganism(b,'#88dfbc');x.children[0].geometry.computeBoundingBox();y.children[0].geometry.computeBoundingBox();assert.ok(y.children[0].geometry.boundingBox.max.x>x.children[0].geometry.boundingBox.max.x);assert.ok(y.children[0].geometry.boundingBox.max.y>x.children[0].geometry.boundingBox.max.y);assert.ok(develop(b).cost>develop(a).cost);disposeOrganism(x);disposeOrganism(y);
});
test('anatomical view reveals internal organs behind transparent skin',()=>{
 const a=specimen(['endoskeleton','fins','camera','gills']),external=buildOrganism(a,'#88dfbc'),internal=buildOrganism(a,'#88dfbc',{anatomy:true});let n=0,m=0;external.traverse(x=>{if(x.geometry)n++;});internal.traverse(x=>{if(x.geometry)m++;});assert.ok(m>n);assert.equal(external.children[0].material.opacity,1);assert.ok(internal.children[0].material.opacity<.3);disposeOrganism(external);disposeOrganism(internal);
});
test('fins, legs, wings and tentacles coexist without a dominant species template',()=>{
 const a=specimen(['fins','limbs','poweredFlight','tentacles','camera']);assert.ok(compatibleTraits(a.traits));const model=buildOrganism(a,'#88dfbc');finite(model);for(const id of ['fins','limbs','flight','tentacles'])assert.ok(model.userData.modules.includes(id));
 for(const id of ['fins','limbs','flight','tentacles']){const smaller={...a,traits:a.traits.filter(t=>t!==id)},other=buildOrganism(smaller,'#88dfbc');let full=0,reduced=0;model.traverse(n=>{if(n.geometry)full++;});other.traverse(n=>{if(n.geometry)reduced++;});assert.ok(full>reduced,id);disposeOrganism(other);}disposeOrganism(model);
});
test('grammar samples have compatible structures, deterministic variation and bounded geometry',()=>{
 const silhouettes=new Set();for(let seed=0;seed<36;seed++){const a=combinationSample(seed);assert.deepEqual(a,combinationSample(seed));assert.ok(compatibleTraits(a.traits));for(const id of a.traits)assert.ok(TRAITS[TRAIT_INDEX[id]].parents.every(p=>a.traits.includes(p)));const model=buildOrganism(a,'#88dfbc');finite(model);silhouettes.add(JSON.stringify(model.userData.fit));disposeOrganism(model);}assert.equal(silhouettes.size,36);assert.equal(compatibleTraits(['radial','limbs']),false);assert.equal(compatibleTraits(['camera','radial','tentacles']),true);
});
test('radial, bell and tissue surfaces retain compatible armor, feeding and locomotion modules',()=>{
 for(const [parts,id] of [[['bell','tubeFeet'],'tubeFeet'],[['bell','spines'],'spines'],[['radial','carapace'],'carapace'],[['tissue','filter'],'filter']]){const a=specimen(parts),full=buildOrganism(a,'#88dfbc'),less=buildOrganism({...a,traits:a.traits.filter(t=>t!==id)},'#88dfbc');let n=0,m=0;full.traverse(x=>{if(x.geometry)n++;});less.traverse(x=>{if(x.geometry)m++;});assert.ok(n>m,parts.join('+'));finite(full);disposeOrganism(full);disposeOrganism(less);}
});

test('shape-function report partitions geometry cost and leaves colour neutral',async()=>{
 const {bodyReport}=await import('../dist/development.js');
 const a=specimen(['fins','carapace']),b=structuredClone(a);b.shape[6]=1;b.shape[7]=0;
 const x=develop(a),y=develop(b);
 for(const key of ['mass','cost','speed','turn','defense','movementCost'])assert.equal(x[key],y[key],key);
 const report=bodyReport(a);assert.deepEqual(report.map(r=>r.id),['body','propulsion','protection']);assert.ok(Math.abs(report.reduce((v,r)=>v+r.cost,0)-x.cost)<1e-12);
 assert.ok(report.every(r=>r.note&&r.metrics.every(m=>Number.isFinite(m.value))));
});
test('longer propulsion and thicker protection have simultaneous geometric benefits and costs',()=>{
 const a=specimen(['fins','carapace']),long=structuredClone(a),thick=structuredClone(a);long.shape[2]=1;thick.shape[1]=1;
 const ref=develop(a),p=develop(long),d=develop(thick);
 assert.ok(p.propulsion.area>ref.propulsion.area&&p.speed>ref.speed&&p.movementCost>ref.movementCost&&p.cost>ref.cost);
 assert.ok(d.protection.thickness>ref.protection.thickness&&d.defense>ref.defense&&d.protection.cost>ref.protection.cost);
 const thin=buildOrganism(a,'#88dfbc'),wide=buildOrganism(thick,'#88dfbc');assert.ok(wide.userData.development.protection.thickness>thin.userData.development.protection.thickness);disposeOrganism(thin);disposeOrganism(wide);
});
test('functional focus highlights the corresponding organs and does not change geometry',async()=>{
 const {focusOrganism}=await import('../dist/anatomy.js'),a=specimen(['fins','limbs','carapace']),root=buildOrganism(a,'#88dfbc');
 const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});const arrays=meshes.map(m=>m.geometry.attributes.position.array.slice());
 for(const region of ['body','propulsion','protection']){assert.ok(meshes.some(m=>m.userData.region===region));focusOrganism(root,region);for(const m of meshes)assert.equal(m.material.emissiveIntensity===.24,m.userData.region===region);}
 focusOrganism(root,null);meshes.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.position.array,arrays[i]));disposeOrganism(root);
});
test('individual dialog uses fixed archived identity instead of a changing species representative',async()=>{
 const {specimenDialog}=await import('../dist/morphology.js'),a={...specimen(['fins']),id:17,generation:4};
 const html=specimenDialog({records:{17:a}},'individual:17');assert.match(html,/data-individual="17"/);assert.doesNotMatch(html,/data-model=/);assert.match(html,/出生结构重建/);
});

test('external structures require birth material in the same body description',()=>{
 const plain=specimen([]),protectedBody=specimen(['shell']),propelled=specimen(['flagella']);
 assert.equal(develop(plain).structureMass,0);
 for(const a of [protectedBody,propelled]){const d=develop(a);assert.ok(d.structureMass>0);assert.equal(d.mass,d.trunkMass+d.structureMass);assert.ok(d.mass>develop(plain).mass);}
});
test('species recolouring cannot redraw inherited body appearance',()=>{
 const a=specimen(['fins','carapace']),one=buildOrganism(a,'#ff0044'),two=buildOrganism(a,'#0033ff');
 const collect=root=>{const values=[];root.traverse(m=>{if(m.isMesh)values.push({color:m.material.color.getHex(),position:Array.from(m.geometry.attributes.position.array),scale:m.scale.toArray()});});return values;};assert.deepEqual(collect(one),collect(two));disposeOrganism(one);disposeOrganism(two);
});
test('visible colony cells track paid growth and tissue bodies scale with their material volume',()=>{
 for(const cells of [1,2,4,6]){
  const a={...specimen(['colony','budding','filter']),cells},model=buildOrganism(a,'#88dfbc');
  let envelopes=0;model.traverse(m=>{if(m.userData.core)envelopes++;});
  assert.equal(envelopes,cells);assert.equal(model.userData.cells.length,cells);
  assert.equal(model.userData.development.mass,develop(a).mass*cells);
  assert.ok(model.userData.cells.every(cell=>Math.abs(cell.s-1)<1e-12));
  finite(model);disposeOrganism(model);
 }
 const a=specimen(['fins','camera','gills']),juvenile=buildOrganism(a,'#88dfbc'),adult=buildOrganism({...a,cells:6},'#88dfbc');
 assert.ok(Math.abs(juvenile.userData.normalization.scale/adult.userData.normalization.scale-Math.cbrt(6))<1e-10);
 assert.equal(adult.userData.development.mass,juvenile.userData.development.mass*6);
 disposeOrganism(juvenile);disposeOrganism(adult);
});
test('gallery represents actual growth while independent previews explicitly show mature bodies',async()=>{
 const {morphologyView,specimenDialog}=await import('../dist/morphology.js'),a={...specimen(['colony']),cells:5,id:17,generation:4,cohort:10};
 const world={agents:[],records:{17:{...a,cells:1}},species:[{id:2,name:'测试群落',color:'#88dfbc',count:10,extinct:null,specimen:a,parent:null}]};
 const gallery=morphologyView(world,2),dialog=specimenDialog(world,'species:2');
 assert.match(gallery,/5 个细胞单元/);assert.match(gallery,/总材料/);assert.match(gallery,/data-size="relative"/);
 assert.match(dialog,/data-model="2"/);assert.doesNotMatch(dialog,/data-individual=/);assert.match(dialog,/实际生长状态 · 5 个细胞单元/);
 for(const key of ['trait:colony','trait:fins','sample:3','workshop']){const sample=previewSpecimen(key);assert.equal(sample.cells,sample.traits.includes('colony')?2+Math.round(sample.shape[3]*4):1);assert.equal(sample.genes.length,GENES.length);}
 assert.match(specimenDialog(world,'trait:colony'),/成熟结构示意/);
});
