import {TRAITS,TRAIT_INDEX} from './biology.js';
import {develop,SHAPE_GENES} from './development.js';
import {recentFlows} from './ecology.js';

export const FEEDING_SOURCES={photons:'光能合成',redox:'化能合成',plankton:'浮游物摄食',detritus:'残骸摄食',radiant:'辐射合成',prey:'捕食',mixed:'混合摄入',unobserved:'暂无摄入证据'};
const TOPOLOGIES={cell:'单体结构',colony:'细胞群落',axial:'两侧主轴',radial:'辐射主轴'};

// exp(Shannon entropy) is the number of equally abundant categories that would
// have the same diversity. The categories below are explicitly not species.
function distribution(counts,total){
 const rows=[...counts].map(([id,count])=>({id,count,share:count/total})).sort((a,b)=>b.count-a.count||String(a.id).localeCompare(String(b.id)));
 return {richness:rows.length,effective:total?Math.exp(-rows.reduce((sum,row)=>sum+row.share*Math.log(row.share),0)):0,rows};
}
function countBy(items,key){const counts=new Map();for(const item of items){const id=key(item);counts.set(id,(counts.get(id)||0)+1);}return distribution(counts,items.length);}

export function individualFeeding(agent,tick){
 const decay=Math.exp(-(tick-agent.feeding.tick)/600);
 const sources=Object.entries(agent.feeding.sources).map(([id,amount])=>({id,name:FEEDING_SOURCES[id],amount:amount*decay}));
 const intake=sources.reduce((sum,source)=>sum+source.amount,0);
 sources.sort((a,b)=>b.amount-a.amount||a.id.localeCompare(b.id));
 for(const source of sources)source.share=intake?source.amount/intake:0;
 return {intake,sources,majoritySource:intake?(sources[0].share>.5?sources[0].id:'mixed'):'unobserved'};
}

function feedingReport(world,living){
 const sourceTotals=new Map(),byConsumer=new Map(),strategies=new Map();
 for(const agent of living){
  const {intake,sources:profile,majoritySource}=individualFeeding(agent,world.tick);
  if(!strategies.has(majoritySource))strategies.set(majoritySource,{id:majoritySource,name:FEEDING_SOURCES[majoritySource],population:0,labels:new Set(),intake:0});
  const strategy=strategies.get(majoritySource);strategy.population++;strategy.labels.add(agent.species);strategy.intake+=intake;
  if(!byConsumer.has(agent.species))byConsumer.set(agent.species,{label:agent.species,population:0,intake:0,sources:new Map()});
  const consumer=byConsumer.get(agent.species);consumer.population++;consumer.intake+=intake;
  for(const source of profile)if(source.amount>0){
   sourceTotals.set(source.id,(sourceTotals.get(source.id)||0)+source.amount);
   consumer.sources.set(source.id,(consumer.sources.get(source.id)||0)+source.amount);
  }
 }
 const total=[...sourceTotals.values()].reduce((sum,amount)=>sum+amount,0);
 const profile=(sources,intake)=>[...sources].map(([id,amount])=>({id,name:FEEDING_SOURCES[id],amount,share:amount/intake})).sort((a,b)=>b.amount-a.amount||a.id.localeCompare(b.id));
 const network=recentFlows(world);
 return {scope:'recent-decayed',decaySteps:600,evidence:'individual-intake',classification:'one-source-over-half',
  note:'按每个现存个体的实际摄入分类，单项来源超过一半才归为主摄入，否则为混合。较早摄入按 600 时步指数衰减；暂无摄入证据不等于没有摄食能力。这些是行为分类，不是物种。',
  totalObservedIntake:total,sources:profile(sourceTotals,total),
  byLabel:[...byConsumer.values()].map(consumer=>({label:consumer.label,population:consumer.population,intake:consumer.intake,profile:profile(consumer.sources,consumer.intake)})).sort((a,b)=>b.population-a.population||a.label-b.label),
  strategies:[...strategies.values()].map(strategy=>({...strategy,labels:strategy.labels.size})).sort((a,b)=>b.population-a.population||a.id.localeCompare(b.id)),
  unobservedPopulation:strategies.get('unobserved')?.population||0,
  network:{scope:'recent-decayed-including-dead',intake:network.reduce((sum,flow)=>sum+flow.amount,0),flows:network.length,minimumFlow:.015,note:'标签食物网还包含已死亡个体留下的衰减记录，与现存个体摄入之和口径不同。'}};
}

function traitReport(world,living){
 const rows=TRAITS.map(trait=>({id:trait.id,name:trait.name,stage:trait.stage,
  birthCarriers:0,encodedBirthCarriers:0,encodedLivingCarriers:0,inactiveBirthCarriers:0,encodedTransmittedBirths:0,founderCarriers:0,descendantBirthCarriers:0,livingCarriers:0,parents:0,transmittedBirths:0,transmittingParents:0,
  mutationGains:0,expressedMutationGains:0,segregationLosses:0,mutationLosses:0,dependencyInactivations:0,structuralConflicts:0,
  firstAppearanceTick:null,lastBirthTick:null,exampleBirth:null,exampleLiving:null,exampleParent:null}));
 const transmitting=TRAITS.map(()=>new Set());
 for(const agent of living){for(const id of agent.structureGenes)rows[TRAIT_INDEX[id]].encodedLivingCarriers++;for(const id of agent.traits){const row=rows[TRAIT_INDEX[id]];row.livingCarriers++;row.exampleLiving=agent.id;}}
 for(const record of Object.values(world.records)){
  for(const id of record.structureGenes){const row=rows[TRAIT_INDEX[id]];row.encodedBirthCarriers++;if(!record.traits.includes(id))row.inactiveBirthCarriers++;}
  for(const id of record.traits){
   const row=rows[TRAIT_INDEX[id]];row.birthCarriers++;
   if(record.mode==='founder')row.founderCarriers++;else row.descendantBirthCarriers++;
   if(row.firstAppearanceTick===null||record.born<row.firstAppearanceTick){row.firstAppearanceTick=record.born;row.exampleBirth=record.id;}
   if(row.lastBirthTick===null||record.born>row.lastBirthTick)row.lastBirthTick=record.born;
   if(record.offspring.length){row.parents++;row.exampleParent=record.id;}
  }
  if(record.mode==='founder')continue;
  const changes=record.inheritance.changes;
  for(const trait of record.inheritance.traits){
   // A fresh acquisition after a loss is not counted as successful inheritance.
   if(!trait.encoded||!trait.parents.length||changes.some(change=>change.kind==='trait'&&change.id===trait.id&&change.cause==='mutation-gain'))continue;
   rows[TRAIT_INDEX[trait.id]].encodedTransmittedBirths++;
   if(trait.retained){rows[TRAIT_INDEX[trait.id]].transmittedBirths++;for(const parent of trait.parents)transmitting[TRAIT_INDEX[trait.id]].add(parent);}
  }
  for(const change of changes){
   if(change.kind!=='trait')continue;
   const row=rows[TRAIT_INDEX[change.id]];
   if(change.cause==='mutation-gain'){row.mutationGains++;if(record.traits.includes(change.id))row.expressedMutationGains++;}
   if(change.cause==='segregation')row.segregationLosses++;
   if(change.cause==='mutation-loss')row.mutationLosses++;
   if(change.cause==='dependency-inactive')row.dependencyInactivations++;
   if(change.cause==='structural-conflict')row.structuralConflicts++;
  }
 }
 rows.forEach((row,index)=>{row.transmittingParents=transmitting[index].size;});
 const records=Object.values(world.records);
 return {scope:'cumulative-birth-archive',observedThrough:world.tick,records:records.length,founders:records.filter(record=>record.mode==='founder').length,
  note:'出生携带包括初始个体，现存携带是当前时点。成为亲本按携带该结构且有直接后代的个体去重；表达传承按保留亲本结构蓝图且在子代表达的出生去重（亲本蓝图可以未表达），两位亲本共同携带不会把同一子代计两次。获得和丢失按出生变更事件计数；出生时潜伏统计依赖缺失导致未表达的子代，持续潜伏会逐代计数；它不是新增突变、蓝图丢失或每代新发生的失活。存活个体的生存与繁殖记录仍未结束。',rows};
}

/** Read-only summary: never advances a world or consumes any random stream. */
export function diagnoseWorld(world){
 const living=world.agents.filter(agent=>agent.alive),population=living.length;
 const labels=countBy(living,agent=>agent.species),origins=countBy(living,agent=>agent.origin);
 const topologies=countBy(living,agent=>develop(agent,agent.cells).topology);
 topologies.rows=topologies.rows.map(row=>({...row,name:TOPOLOGIES[row.id]}));
 const combinations=countBy(living,agent=>[...agent.traits].sort((a,b)=>TRAIT_INDEX[a]-TRAIT_INDEX[b]).join('|'));
 combinations.rows=combinations.rows.map(row=>({...row,traits:row.id?row.id.split('|'):[]}));
 const shape=SHAPE_GENES.map((name,index)=>{
  if(!population)return {index,name,mean:null,minimum:null,maximum:null,deviation:null};
  const values=living.map(agent=>agent.shape[index]),mean=values.reduce((sum,value)=>sum+value,0)/population;
  return {index,name,mean,minimum:Math.min(...values),maximum:Math.max(...values),deviation:Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/population)};
 });
 const resources=Object.fromEntries(['nutrient','redox','plankton','detritus','photons','radiant'].map(key=>[key,world.fields.reduce((sum,field)=>sum+field[key],0)]));
 return {tick:world.tick,
  diversity:{scope:'current',population,labels,origins,note:'分群标签、起源体系、结构组合是不同分类口径，均不能直接当作自然物种数；有效数量为 exp(Shannon 熵)。'},
  morphology:{scope:'current',colonies:living.filter(agent=>agent.cells>1).length,cells:living.reduce((sum,agent)=>sum+agent.cells,0),topologies,combinations,structureCounts:countBy(living,agent=>agent.traits.length),shape,note:'结构组合只统计已表达结构；相同比例或结构不定义同一物种，连续形态参数另列。'},
  feeding:feedingReport(world,living),resources:{scope:'current',...resources},traits:traitReport(world,living)};
}
