import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Reciprocal introductions at finite low abundance. Resource treatments run in
// explicit engine copies; this script does not alter ecological mechanisms.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(['out','engine','condition','seeds','resident-steps','invasion-steps','sample']),args={};
for(const argument of process.argv.slice(2)){
 const match=/^--([^=]+)=(.+)$/.exec(argument);
 if(!match||!allowed.has(match[1]))throw new Error('Use --name=value. Arguments: '+[...allowed].join(', '));
 args[match[1]]=match[2];
}
if(!args.out)throw new Error('--out must identify the experiment output directory.');
function positive(value,name){const number=Number(value);if(!Number.isInteger(number)||number<1)throw new Error(name+' must be a positive integer');return number;}
const out=path.resolve(args.out),engine=path.resolve(args.engine||path.join(project,'dist/engine.js')),source=path.dirname(engine);
const condition=args.condition||'standard',seeds=(args.seeds||'ORIGIN-042,DELTA-103').split(',');
const residentSteps=positive(args['resident-steps']||3000,'resident-steps'),invasionSteps=positive(args['invasion-steps']||3000,'invasion-steps'),sampleEvery=positive(args.sample||150,'sample');
if(!['standard','redox3'].includes(condition))throw new Error('condition must be standard or redox3');
if(condition==='redox3'&&!args.engine)throw new Error('redox3 requires an explicit experimental --engine.');
const {World}=await import(pathToFileURL(engine));
const {GENES,DEFAULTS}=await import(pathToFileURL(path.join(source,'biology.js')));
const {balances,injectLife,FOOD_SOURCES,N_RATIO}=await import(pathToFileURL(path.join(source,'ecology.js')));
if(GENES.length!==14)throw new Error('This assay uses the v6 14-parameter genotype.');
const baseGenes=[0,0,0,.35,.15,.4,.46,.5,.5,.45,.1,.6,0,0],shape=Array(8).fill(.5);
const profiles={photo:{genes:baseGenes.map((g,i)=>i===0?.9:g),traits:['pigment']},chemo:{genes:baseGenes.map((g,i)=>i===1?.9:g),traits:['vent']}};
const config={origin:false,founders:0,mutation:0,reproductionMode:'asexual',volatility:0,fiction:false,light:1,resources:1};
const metadata={created:new Date().toISOString(),modelVersion:6,engine,condition,seeds,residentSteps,invasionSteps,sampleEvery,defaults:DEFAULTS,config,profiles,shape,
 design:{residentFounders:52,initialReserve:17,invaderRule:'max(1, floor(0.03 * current resident count))',maximumInitialInvaderShare:.10,establishmentWindow:600,invasionWindows:[[0,600],[600,1500],[1500,3000]],
  placement:'Aquatic field centres selected at equal quantiles over the row-major list, separately for each introduction count. Record exact positions and local habitat at introduction. No strategy-specific habitat is selected.',
  ancestry:'Origins label independent clone ancestry and recognition groups. Every organism is asexual; mutation is disabled. Genotypes match environment-assay.mjs.',
  stopping:'No restocking. Do not introduce if the minimum one invader would exceed 10% of total population. Stop at capacity or total extinction; continue after loss of one origin.',
  treatment:'config.resources remains 1 in both conditions. The redox3 engine copy changes only external chemical energy input ri by a factor of three; dissolved nutrient input remains standard.'},
 limitations:['Three thousand establishment steps do not demonstrate equilibrium; report changes during the last 600 steps.','Small resident populations can make the requested rarity untestable; those runs are not failed invasions.','One or a few founders are vulnerable to demographic chance and the stated introduction site; results do not characterize all habitats.','Same seeds match initial terrain; later trajectories consume biological randomness differently.','Window growth is a finite-time observation; positive reciprocal growth is not proof of stable or indefinite coexistence.','A lineage present at the horizon may still be declining. Count descendants and window births/deaths separately from surviving introduced founders.','Logarithmic rates are null when an endpoint is zero; no pseudocount is used.','All initial body material and reserve are explicit external inputs. No later rescue or complexity reward is added.']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(out,'results.jsonl'),'');
const results=[],ledgerKeys=['intake','maintenance','movement','reproduction','hunting','stress','growth'];
function inoculate(world,strategy,count){
 const profile=profiles[strategy],species=world.createSpecies(profile.genes,null,shape),sites=world.fields.filter(f=>!f.land),identity={strategy,origin:species.origin,founderIds:[],injected:{individuals:count,energy:0,nutrient:0},sites:[]};
 species.discovered=[...profile.traits];
 for(let i=0;i<count;i++){
  const f=sites[Math.floor((i+.5)*sites.length/count)],a=world.makeAgent(species,f.x,f.y,profile.genes,profile.traits,0,17,shape),energy=a.energy+a.bodyEnergy;
  world.agents.push(a);injectLife(world,a);identity.founderIds.push(a.id);identity.injected.energy+=energy;identity.injected.nutrient+=energy*N_RATIO;
  identity.sites.push({x:f.x,y:f.y,vent:f.vent,temperature:f.temp,light:f.light,redox:f.redox,nutrient:f.nutrient});
 }
 world.liveCount=world.agents.length;world.census();world.reindex();return identity;
}
function originState(world,identity){
 const living=world.agents.filter(a=>a.origin===identity.origin),records=Object.values(world.records).filter(r=>r.origin===identity.origin),founders=new Set(identity.founderIds);
 const accounts=Object.fromEntries(ledgerKeys.map(key=>[key,records.reduce((sum,r)=>sum+r.energy[key],0)]));
 const individualSteps=records.reduce((sum,r)=>sum+(r.death?r.death.tick:world.tick)-r.born,0);
 return {origin:identity.origin,strategy:identity.strategy,population:living.length,births:records.length-identity.founderIds.length,deaths:records.filter(r=>r.death).length,aliveFounders:living.filter(a=>founders.has(a.id)).length,aliveDescendants:living.filter(a=>!founders.has(a.id)).length,
  maxGeneration:Math.max(0,...records.map(r=>r.generation)),individualSteps,accounts,sources:Object.fromEntries(FOOD_SOURCES.map(key=>[key,records.reduce((sum,r)=>sum+r.energy.sources[key],0)]))};
}
function stopReason(world){return world.saturated?'capacity':!world.agents.length?'extinction':null;}
function logGrowth(from,to,duration){return from>0&&to>0&&duration>0?Math.log(to/from)/duration:null;}
function windowStats(samples,origin,from,to){
 const a=samples.find(s=>s.tick===from),b=samples.find(s=>s.tick===to);
 if(!a||!b)return {from,to,observed:false,reason:'missing-window-boundary'};
 const start=a.origins.find(g=>g.origin===origin),end=b.origins.find(g=>g.origin===origin),rows=samples.filter(s=>s.tick>=from&&s.tick<=to),counts=rows.map(s=>s.origins.find(g=>g.origin===origin).population),individualSteps=end.individualSteps-start.individualSteps;
 return {from,to,observed:true,populationStart:start.population,populationEnd:end.population,netChange:end.population-start.population,minSampledPopulation:Math.min(...counts),maxSampledPopulation:Math.max(...counts),births:end.births-start.births,deaths:end.deaths-start.deaths,individualSteps,
  birthsPerIndividualStep:individualSteps?(end.births-start.births)/individualSteps:null,deathsPerIndividualStep:individualSteps?(end.deaths-start.deaths)/individualSteps:null,
  logGrowthPerStep:logGrowth(start.population,end.population,to-from),shareStart:start.population/a.population,shareEnd:b.population?end.population/b.population:null,
  descendantsAtEnd:end.aliveDescendants,sources:Object.fromEntries(FOOD_SOURCES.map(key=>[key,end.sources[key]-start.sources[key]]))};
}
function writeResult(result){
 results.push(result);fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(result)+'\n');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({run:results.length,total:seeds.length*2,condition,seed:result.seed,resident:result.resident,invader:result.invader,termination:result.termination,testable:result.introduction.testable,residentBefore:result.introduction.residentBefore,initialInvaders:result.introduction.proposedInvaders,initialShare:result.introduction.proposedShare,final:result.final.origins.map(g=>({strategy:g.strategy,population:g.population,births:g.births,deaths:g.deaths,aliveDescendants:g.aliveDescendants})),seconds:+(result.elapsedMs/1000).toFixed(2)}));
}
for(const seed of seeds)for(const resident of ['photo','chemo']){
 const started=performance.now(),invader=resident==='photo'?'chemo':'photo',world=new World({seed,...config}),residentIdentity=inoculate(world,resident,52),identities=[residentIdentity];
 const audit={samples:0,maxAbsEnergyError:0,maxAbsNutrientError:0,peakPopulation:world.agents.length,nonFinite:0},establishment=[],samples=[],extinctionTicks={resident:null,invader:null};
 function record(destination){
  const balance=balances(world);audit.samples++;audit.maxAbsEnergyError=Math.max(audit.maxAbsEnergyError,Math.abs(balance.energyError));audit.maxAbsNutrientError=Math.max(audit.maxAbsNutrientError,Math.abs(balance.nutrientError));audit.nonFinite+=Object.values(balance).filter(v=>!Number.isFinite(v)).length;
  if(audit.nonFinite||Math.abs(balance.energyError)>.001||Math.abs(balance.nutrientError)>.0001)throw new Error('Resource accounting failed');
  const state={tick:world.tick,population:world.agents.length,origins:identities.map(identity=>originState(world,identity)),balance};destination.push(state);return state;
 }
 record(establishment);
 while(world.tick<residentSteps){
  world.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);
  if(world.tick%sampleEvery===0||world.tick===Math.max(0,residentSteps-600)||world.tick===residentSteps||stopReason(world))record(establishment);
  if(stopReason(world))break;
 }
 const before=establishment.at(-1),residentBefore=before.origins[0].population,proposedInvaders=Math.max(1,Math.floor(.03*residentBefore)),proposedShare=proposedInvaders/(residentBefore+proposedInvaders);
 const introduction={tick:world.tick,residentBefore,proposedInvaders,proposedShare,testable:!stopReason(world)&&proposedShare<=.10,introduced:false};
 const residentLast600=windowStats(establishment,residentIdentity.origin,Math.max(0,residentSteps-600),residentSteps);
 if(!introduction.testable){
  writeResult({seed,condition,resident,invader,config:world.config,residentIdentity,introduction,termination:stopReason(world)?'resident-'+stopReason(world):'untestable-rarity',residentLast600,establishment,samples,final:before,audit,elapsedMs:performance.now()-started});continue;
 }
 const invaderIdentity=inoculate(world,invader,proposedInvaders);identities.push(invaderIdentity);introduction.introduced=true;
 const introductionTick=world.tick,special=new Set([600,1500,3000]),target=introductionTick+invasionSteps;let termination='horizon';record(samples);
 while(world.tick<target){
  world.stepOne();audit.peakPopulation=Math.max(audit.peakPopulation,world.agents.length);
  for(const [role,identity]of [['resident',residentIdentity],['invader',invaderIdentity]])if(extinctionTicks[role]===null&&!world.agents.some(a=>a.origin===identity.origin))extinctionTicks[role]=world.tick;
  if((world.tick-introductionTick)%sampleEvery===0||special.has(world.tick-introductionTick)||world.tick===target||stopReason(world))record(samples);
  if(stopReason(world)){termination=stopReason(world);break;}
 }
 const final=samples.at(-1),windows=Object.fromEntries(identities.map(identity=>[identity.strategy,[[0,600],[600,1500],[1500,3000]].map(([from,to])=>({...windowStats(samples,identity.origin,introductionTick+from,introductionTick+to),relativeFrom:from,relativeTo:to}))]));
 const initialResident=samples[0].origins[0],initialInvader=samples[0].origins[1],finalResident=final.origins[0],finalInvader=final.origins[1],elapsed=world.tick-introductionTick;
 const evidence={elapsed,initialInvaderShare:proposedShare,finalInvaderShare:final.population?finalInvader.population/final.population:null,invaderLogGrowthPerStep:logGrowth(initialInvader.population,finalInvader.population,elapsed),residentLogGrowthPerStep:logGrowth(initialResident.population,finalResident.population,elapsed),
  logOddsChangePerStep:finalInvader.population&&finalResident.population?Math.log((finalInvader.population/finalResident.population)/(initialInvader.population/initialResident.population))/elapsed:null,
  invaderIncreasedAtHorizon:termination==='horizon'&&finalInvader.population>proposedInvaders&&finalInvader.population/final.population>proposedShare,
  hasLivingInvaderDescendants:finalInvader.aliveDescendants>0,extinctionTicks,
  interpretation:'Finite-window evidence. Assess early and late growth, births and deaths, resident variation, ancestry replacement, introduction location and censoring before describing persistence or coexistence.'};
 writeResult({seed,condition,resident,invader,config:world.config,residentIdentity,invaderIdentity,introduction,termination,residentLast600,establishment,samples,windows,evidence,final,audit,elapsedMs:performance.now()-started});
}
const pairs=seeds.map(seed=>{
 const directions=results.filter(r=>r.seed===seed),bothDirectionsTestable=directions.every(r=>r.introduction.testable);
 return {seed,condition,bothDirectionsTestable,bothInvadersIncreasedAtHorizon:bothDirectionsTestable?directions.every(r=>r.evidence.invaderIncreasedAtHorizon):null,directions:directions.map(r=>({resident:r.resident,invader:r.invader,introduction:r.introduction,termination:r.termination,residentLast600:r.residentLast600,windows:r.windows,evidence:r.evidence})),interpretation:'Reciprocal finite introductions; neither final presence nor positive growth proves equilibrium or indefinite coexistence.'};
});
fs.writeFileSync(path.join(out,'pairs.json'),JSON.stringify(pairs,null,2));
