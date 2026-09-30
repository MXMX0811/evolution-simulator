import {GENES,TRAITS,TRAIT_INDEX} from './biology.js';
import {SHAPE_GENES} from './development.js';
const bound=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function compatible(a,b){return a.origin===b.origin&&a.reproduction.mode!=='asexual'&&b.reproduction.mode!=='asexual'&&Math.abs(a.reproduction.signal-b.reproduction.signal)<=Math.min(a.reproduction.tolerance,b.reproduction.tolerance);}
export function recognizes(a,b){return a.origin===b.origin&&Math.abs(a.reproduction.socialSignal-b.reproduction.socialSignal)<=a.reproduction.socialTolerance;}
// The construction graph governs expression. An inactive downstream blueprint stays heritable.
export function expressStructures(encoded){
 const present=new Set(encoded),active=new Set();
 for(const t of TRAITS)if(present.has(t.id)&&t.parents.every(id=>active.has(id))&&!(t.excludes||[]).some(id=>active.has(id)))active.add(t.id);
 return [...active];
}
export function inheritGenome(world,a,b){
 const rng=world.rng,rate=world.config.mutation,changes=[],evidence={genes:[],shape:[],reproduction:[],traits:[],changes};
 let mutations=0;
 function sequence(key,count,scale){const cut=1+Math.floor(rng.next()*(count-1));return a[key].map((value,index)=>{const parent=b&&index>=cut?b:a,before=parent[key][index];let after=before;const attempted=rng.next()<rate;if(attempted)after=bound(before+rng.normal()*scale);const mutated=after!==before;if(mutated){mutations++;changes.push({kind:key,index,from:before,to:after,cause:'mutation'});}evidence[key].push({index,parent:parent.id,before,after,mutated});return after;});}
 const genes=sequence('genes',GENES.length,.12),shape=sequence('shape',SHAPE_GENES.length,.065),reproduction={};
 for(const key of ['mode','signal','tolerance','socialSignal','socialTolerance']){const parent=b&&rng.next()<.5?b:a,before=parent.reproduction[key];let after=before;if(key!=='mode'&&rng.next()<rate){after=bound(before+rng.normal()*.04,key.endsWith('Tolerance')||key==='tolerance'?.04:0,key.endsWith('Tolerance')||key==='tolerance'?.4:1);}const mutated=after!==before;if(mutated){mutations++;changes.push({kind:'reproduction',id:key,from:before,to:after,cause:'mutation'});}reproduction[key]=after;evidence.reproduction.push({id:key,parent:parent.id,before,after,mutated});}
 let structureGenes=[];const source=new Map();
 for(const parent of b?[a,b]:[a])for(const id of parent.structureGenes){if(!source.has(id))source.set(id,[]);source.get(id).push(parent.id);}
 if(!b)structureGenes=[...a.structureGenes];else{
  const shared=new Set(a.structureGenes.filter(id=>b.structureGenes.includes(id)));structureGenes=[...shared];
  for(const parent of [a,b]){const remaining=new Set(parent.structureGenes.filter(id=>!shared.has(id)));
   while(remaining.size){const component=[remaining.values().next().value];remaining.delete(component[0]);
    for(let i=0;i<component.length;i++)for(const other of [...remaining])if(TRAITS[TRAIT_INDEX[component[i]]].parents.includes(other)||TRAITS[TRAIT_INDEX[other]].parents.includes(component[i])){remaining.delete(other);component.push(other);}
    const retained=rng.next()<.5;if(retained)structureGenes.push(...component);else for(const id of component)changes.push({kind:'trait',id,from:true,to:false,cause:'segregation'});
   }
  }
 }
 const resolved=new Set();for(const t of TRAITS)for(const other of t.excludes||[]){const pair=[t.id,other].sort().join(':');if(resolved.has(pair))continue;resolved.add(pair);if(structureGenes.includes(t.id)&&structureGenes.includes(other)){const drop=rng.next()<.5?t.id:other;structureGenes=structureGenes.filter(id=>id!==drop);changes.push({kind:'trait',id:drop,from:true,to:false,cause:'structural-conflict'});}}
 let traits=expressStructures(structureGenes);
 // Each attempt changes at most one blueprint. Missing prerequisites affect expression, not inheritance.
 if(rng.next()<rate){const available=TRAITS.filter(t=>(world.config.fiction||t.kind!=='fiction')&&!structureGenes.includes(t.id)&&genes[t.gene]>=t.min&&t.parents.every(p=>traits.includes(p))&&!(t.excludes||[]).some(p=>structureGenes.includes(p)));if(available.length){const id=rng.pick(available).id;structureGenes.push(id);source.set(id,[]);mutations++;changes.push({kind:'trait',id,from:false,to:true,cause:'mutation-gain'});}}
 if(structureGenes.length&&rng.next()<rate){const id=structureGenes.splice(Math.floor(rng.next()*structureGenes.length),1)[0];mutations++;changes.push({kind:'trait',id,from:true,to:false,cause:'mutation-loss'});}
 structureGenes=TRAITS.filter(t=>structureGenes.includes(t.id)).map(t=>t.id);
 traits=expressStructures(structureGenes);
 for(const id of structureGenes)if(!traits.includes(id)){const dependencies=TRAITS[TRAIT_INDEX[id]].parents.filter(parent=>!traits.includes(parent));const parentalExpression=(b?[a,b]:[a]).filter(parent=>parent.structureGenes.includes(id)).map(parent=>({parent:parent.id,expressed:parent.traits.includes(id)}));changes.push({kind:'trait',id,from:parentalExpression.some(p=>p.expressed),to:false,cause:'dependency-inactive',parentalExpression,dependencies});}
 for(const [id,parents]of source)evidence.traits.push({id,parents,retained:traits.includes(id),encoded:structureGenes.includes(id)});
 // This unlinked marker has its own random stream and never enters ecological decisions.
 const markerParent=b&&world.markerRng.next()<.5?b:a,neutralBefore=markerParent.neutralAllele,neutralMutation=world.markerRng.next()<rate,neutralAllele=neutralMutation?1-neutralBefore:neutralBefore;
 evidence.neutralAllele={parent:markerParent.id,before:neutralBefore,after:neutralAllele,mutated:neutralMutation};
 if(neutralMutation){mutations++;changes.push({kind:'neutralAllele',from:neutralBefore,to:neutralAllele,cause:'mutation'});}
 return {genes,shape,structureGenes,traits,reproduction,neutralAllele,mutations,inheritance:evidence};
}
