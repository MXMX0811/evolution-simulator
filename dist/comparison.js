import {World, Random} from './engine.js';
import {balances} from './ecology.js';

export const COMPARISON_CHANGES = {
 cooling: {name:'基础温度降低 8 °C', key:'temperature', change:v=>Math.max(-15,v-8)},
 dimming: {name:'光照降为原来的 60%', key:'light', change:v=>v*.6},
 enrichment: {name:'地质补给增至原来的 1.5 倍', key:'resources', change:v=>Math.min(3,v*1.5)},
};

// Both histories start at exactly the same checkpoint. Replicates vary only
// the biological random stream; the environment stream is shared within pairs.
export function compareWorlds(snapshot, changeId, repeat, steps=600) {
 const change=COMPARISON_CHANGES[changeId];
 if(!change)throw new Error('请选择一个环境变化');
 const control=World.restore(snapshot), altered=World.restore(snapshot);
 const seed=`${control.config.seed}:T${control.tick}:comparison:${repeat}`;
 control.rng=new Random(seed);altered.rng=new Random(seed);
 control.markerRng=new Random(seed+':neutral');altered.markerRng=new Random(seed+':neutral');
 const initial=control.summary(),from=control.config[change.key],to=change.change(from);
 altered.setEnvironment({[change.key]:to});
 const finish=w=>{
  w.step(steps);w.census();const b=balances(w);
  return {tick:w.tick,population:w.agents.length,births:w.totalBirths-initial.births,deaths:w.totalDeaths-initial.deaths,
   livingSpecies:w.species.filter(s=>s.count>0).length,biomass:w.agents.reduce((sum,a)=>sum+a.bodyEnergy,0),
   meanStructures:w.agents.length?w.agents.reduce((sum,a)=>sum+a.traits.length,0)/w.agents.length:0,
   energyError:b.energyError,nutrientError:b.nutrientError,saturated:w.saturated,extinct:w.originDone&&!w.agents.length,
   environmentRandomState:w.envRng.state,naturalEvents:w.interventions.filter(e=>e.source==='natural'&&e.tick>=initial.tick)};
 };
 return {repeat,seed,change:{key:change.key,from,to,name:change.name},start:initial.tick,requestedSteps:steps,control:finish(control),altered:finish(altered)};
}

export function summarizeComparisons(results,key,side){
 const values=results.map(r=>r[side][key]);
 return {mean:values.reduce((a,b)=>a+b,0)/values.length,min:Math.min(...values),max:Math.max(...values)};
}
