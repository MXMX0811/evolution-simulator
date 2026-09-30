import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.min.js';
import {buildOrganism,disposeOrganism} from '../dist/anatomy.js';
import {GENES,traitClosure} from '../dist/biology.js';
function surfaces(root){root.scale.setScalar(1);root.position.set(...root.userData.normalization.center);root.updateMatrixWorld(true);const meshes=[],triangles=[];root.traverse(m=>{if(m.userData.core)meshes.push(m);});for(const m of meshes){const p=m.geometry.attributes.position,idx=m.geometry.index;for(let i=0;i<idx.count;i+=3){const t=new THREE.Triangle();t.a.fromBufferAttribute(p,idx.getX(i)).applyMatrix4(m.matrixWorld);t.b.fromBufferAttribute(p,idx.getX(i+1)).applyMatrix4(m.matrixWorld);t.c.fromBufferAttribute(p,idx.getX(i+2)).applyMatrix4(m.matrixWorld);if(t.getArea()>1e-12)triangles.push(t);}}return {meshes,triangles};}
function inside(p,meshes){const ray=new THREE.Raycaster(p,new THREE.Vector3(.271,.929,.251).normalize()),hits=ray.intersectObjects(meshes,false).map(x=>x.distance).sort((a,b)=>a-b).filter((d,i,a)=>!i||d-a[i-1]>1e-7);return hits.length%2===1;}
test('external organ roots meet actual body triangles at extreme inherited proportions',()=>{
 for(const parts of [['radial','filter'],['tubeFeet'],['bell','filter','tentacles'],['notochord','camera'],['notochord','poweredFlight','limbs']])for(const value of [0,.5,1])for(const cells of [1,6]){const a={genes:GENES.map(()=>.6),cells,shape:Array(8).fill(value),traits:traitClosure(parts)},root=buildOrganism(a,'#98b99e'),{meshes,triangles}=surfaces(root),near=new THREE.Vector3();for(const at of root.userData.attachments){const p=new THREE.Vector3(...at.point);let gap=Infinity;for(const t of triangles){t.closestPointToPoint(p,near);gap=Math.min(gap,p.distanceTo(near));}const closed=a.traits.includes('bell')?meshes.filter(m=>m.geometry.type==='SphereGeometry'):meshes;if(gap>.012)assert.ok(inside(p,closed),`${parts}, shape ${value}, ${at.label}, gap ${gap}`);}disposeOrganism(root);}
});
test('tentacle suckers and crystal antenna tips inherit their organ animation',()=>{const root=buildOrganism({genes:GENES.map(()=>.6),cells:1,shape:Array(8).fill(.5),traits:traitClosure(['tentacles','crystalSense'])},'#98b99e');const decorated=root.userData.motions.filter(m=>m.m.isGroup&&m.m.children.some(c=>['TorusGeometry','OctahedronGeometry'].includes(c.geometry?.type)));assert.ok(decorated.length>=3);for(const motion of decorated){const local=motion.m.children.map(c=>c.matrix.clone());for(const sign of [-1,1]){motion.m.rotation[motion.axis]=motion.base+sign*motion.amp;root.updateMatrixWorld(true);motion.m.children.forEach((c,i)=>assert.deepEqual(c.matrix.elements,local[i].elements));}}disposeOrganism(root);});
test('growing microbial colonies retain every organ root on a connected cell envelope',()=>{
 for(const cells of [1,2,6])for(const value of [0,1]){
  const a={genes:GENES.map(()=>.6),cells,shape:Array(8).fill(value),traits:traitClosure(['colony','budding','filter','spines','chemoreceptor'])},root=buildOrganism(a,'#98b99e'),{meshes,triangles}=surfaces(root),near=new THREE.Vector3();
  assert.equal(meshes.length,cells);
  for(const at of root.userData.attachments){
   const p=new THREE.Vector3(...at.point);let gap=Infinity;
   for(const t of triangles){t.closestPointToPoint(p,near);gap=Math.min(gap,p.distanceTo(near));}
   assert.ok(gap<=.012||meshes.some(m=>inside(p,[m])),`${cells} cells, shape ${value}, ${at.label}, gap ${gap}`);
  }
  const connected=new Set([0]);
  while(true){const count=connected.size;for(let i=0;i<root.userData.cells.length;i++)for(const j of connected){const p=root.userData.cells[i].p,q=root.userData.cells[j].p,d=root.userData.development;if(Math.hypot((p[0]-q[0])/d.length,(p[1]-q[1])/d.width,(p[2]-q[2])/(d.width*.8))<2)connected.add(i);}if(count===connected.size)break;}
  assert.equal(connected.size,cells);disposeOrganism(root);
 }
});
