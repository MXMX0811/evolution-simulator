import {has} from './biology.js';
import {develop} from './development.js';
import {dissipate} from './ecology.js';

export function matureCells(a){return has(a,'colony')?2+Math.round(a.shape[3]*4):1;}
export function readyToReproduce(a){return a.cells>=matureCells(a);}
export function growColony(world,a){
 if(a.cells>=matureCells(a)||a.age<12||a.age%12!==0)return false;
 const material=2*develop(a).unitMass,respiration=material*.2,cost=material+respiration;
 if(a.energy<12+cost)return false;
 a.energy-=cost;a.bodyEnergy+=material;a.energyLedger.growth+=cost;
 dissipate(world,world.fieldAt(a.x,a.y),respiration);
 a.cells++;a.development=develop(a,a.cells);
 const history=world.records[a.id].lifeHistory;history.peakCells=Math.max(history.peakCells,a.cells);history.divisions++;
 if(a.cells===matureCells(a)&&history.matureAt===null)history.matureAt=world.tick;
 return true;
}
export function propaguleMaterial(a,childBody){
 const removed=has(a,'colony')&&a.cells>1?a.bodyEnergy/a.cells:0;
 return {removed,transferred:Math.min(removed,childBody)};
}
export function releasePropagule(world,a,material,child){
 if(!material.removed)return;
 a.bodyEnergy-=material.removed;a.cells--;a.development=develop(a,a.cells);
 dissipate(world,world.fieldAt(a.x,a.y),material.removed-material.transferred);
 world.records[a.id].lifeHistory.releases++;
 world.records[child.id].lifeHistory.materialFromParent=material.transferred;
}
