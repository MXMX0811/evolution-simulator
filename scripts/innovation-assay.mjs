import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Random} from '../dist/engine.js';
import {GENES,TRAITS,DEFAULTS,traitClosure} from '../dist/biology.js';
import {SHAPE_GENES} from '../dist/development.js';

// Controlled inheritance proposals and unselected descent, never added to a product world.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(['out','parents','trials','lineages','generations','seed','cases','since','until']);
const args={};
for(const text of process.argv.slice(2)){const match=/^--([^=]+)=(.+)$/.exec(text);if(!match||!allowed.has(match[1]))throw new Error('Use --name=value: '+[...allowed].join(', '));args[match[1]]=match[2];}
if(!args.out)throw new Error('--out is required, e.g. --out=../v7-study/innovation/synthetic');
const out=path.resolve(args.out),seed=args.seed||'INNOVATION-2026',trials=Number(args.trials||20000),lineages=Number(args.lineages||100),generations=Number(args.generations||300),targets=['colony','tissue','bilateral','radial'];
const since=Number(args.since||0),until=args.until===undefined?null:Number(args.until);
if(!Number.isInteger(since)||since<0||until!==null&&(!Number.isInteger(until)||until<since))throw new Error('Parent sampling window requires nonnegative integer bounds, since <= until');
for(const [key,value] of Object.entries({trials,lineages,generations}))if(!Number.isInteger(value)||value<1)throw new Error(key+' must be a positive integer');
fs.mkdirSync(out,{recursive:true});
const variants=[];
for(const id of ['current','tissue-gate-zero','no-structural-loss']){
 const folder=path.join(out,'models',id);fs.mkdirSync(folder,{recursive:true});
 for(const file of ['biology.js','development.js','heredity.js'])fs.copyFileSync(path.join(project,'dist',file),path.join(folder,file));
 fs.writeFileSync(path.join(folder,'package.json'),'{"type":"module"}\n');
 if(id==='tissue-gate-zero'){
  const file=path.join(folder,'biology.js'),source=fs.readFileSync(file,'utf8'),changed=source.replace(/("id":"tissue"[^\n]+"min":)0\.38/,(_,prefix)=>prefix+'0');
  if(source===changed)throw new Error('Expected tissue gate 0.38 in the experiment copy');fs.writeFileSync(file,changed);
 }
 if(id==='no-structural-loss'){
  const file=path.join(folder,'heredity.js'),source=fs.readFileSync(file,'utf8'),changed=source.replace('if(structureGenes.length&&rng.next()<rate)', 'if(structureGenes.length&&rng.next()<0)');
  if(source===changed)throw new Error('Expected single structural-loss attempt in the experiment copy');fs.writeFileSync(file,changed);
 }
 const heredity=await import(pathToFileURL(path.join(folder,'heredity.js'))),biology=await import(pathToFileURL(path.join(folder,'biology.js')));
 variants.push({id,...heredity,traits:biology.TRAITS});
}
const current=variants[0],reproduction={mode:'facultative',signal:.5,tolerance:.17,socialSignal:.5,socialTolerance:.22};
function addStructures(parent,ids){const supplied=traitClosure(ids),chosen=new Set([...parent.structureGenes,...supplied]);for(const t of TRAITS)if(supplied.includes(t.id))for(const excluded of t.excludes||[])chosen.delete(excluded);const structureGenes=TRAITS.filter(t=>chosen.has(t.id)).map(t=>t.id);return {...parent,structureGenes,traits:current.expressStructures(structureGenes)};}
function synthetic(social){const genes=GENES.map(()=>.6);genes[5]=social;return {id:1,origin:1,genes,shape:SHAPE_GENES.map(()=>.5),structureGenes:[],traits:[],reproduction:{...reproduction},neutralAllele:0};}
const cases=[];
for(const social of [.1,.37,.38,.6])for(const supplied of [[],['colony'],['tissue'],['bilateral','fins','segments']]){
 const a=addStructures(synthetic(social),supplied),name=supplied.length?supplied.join('+'):'no-structures';
 cases.push({id:`synthetic-social-${social}-${name}`,kind:'synthetic',description:'All 14 ecological genes are 0.6 except social; prerequisites supplied only as stated.',supplied,parents:[{parent:a,mate:null}],serial:supplied.length===1&&supplied[0]==='colony'});
}
const parentFiles=(args.parents?args.parents.split(','):[]).map(file=>path.resolve(file)),parentSources=[];
for(const file of parentFiles){
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.schema!=='v6-parent-attempts'||!Array.isArray(data.samples)||!data.samples.length)throw new Error('Parent file requires schema v6-parent-attempts and a nonempty samples array');
 const selected=data.samples.filter(row=>row.tick>=since&&(until===null||row.tick<=until));
 if(!selected.length)throw new Error('No sampled parent opportunities in the requested time window: '+file);
 const entries=selected.map(row=>({parent:row.parent,mate:row.mate}));
 for(const {parent,mate} of entries)for(const a of mate?[parent,mate]:[parent])if(!a||a.genes.length!==GENES.length||!Array.isArray(a.structureGenes))throw new Error('Parent rows require complete parent and mate genotypes');
 const prefix=data.seed+'-T'+data.tick;
 parentSources.push({file,seed:data.seed,tick:data.tick,population:data.population,colonyAssociatedAttemptsAtSourceHorizon:data.eligibleAttempts,sampling:data.sampling,sourceSampleSize:data.samples.length,window:{since,until},sampleSize:selected.length,successfulProposals:selected.filter(r=>r.born).length,failedProposals:selected.filter(r=>!r.born).length,distinctPrimaryParents:new Set(selected.map(r=>r.parent.id)).size});
 cases.push({id:prefix+'-recorded-pairs',kind:'recorded',description:'Replay sampled actual parental pairs without ecological selection or resource checks.',source:file,supplied:[],parents:entries,serial:false});
 const colonyParents=entries.map(({parent,mate})=>parent.traits.includes('colony')?parent:mate).filter(a=>a?.traits.includes('colony'));
 if(!colonyParents.length)throw new Error('No expressed-colony parent in '+file);
 for(const supplied of [[],['tissue'],['bilateral','fins','segments']])cases.push({id:prefix+'-clonal-'+(supplied.join('+')||'actual'),kind:'recorded',description:'First colony-carrying parent in each sampled pair, with equal weight per sampled opportunity. Existing genes unchanged; listed prerequisite blueprints supplied.',source:file,supplied,parents:colonyParents.map(parent=>({parent:addStructures(parent,supplied),mate:null})),serial:supplied.length===0});
}
const chosen=args.cases?cases.filter(c=>args.cases.split(',').includes(c.id)):cases;
if(!chosen.length)throw new Error('No cases selected');
const metadata={created:new Date().toISOString(),modelVersion:6,seed,trialsPerCaseVariant:trials,lineagesPerSerialCaseVariant:lineages,generations,parentFiles,parentSources,mutation:DEFAULTS.mutation,fiction:DEFAULTS.fiction,
 variants:variants.map(v=>({id:v.id,changes:v.id==='current'?'None; exact source copy.':v.id==='tissue-gate-zero'?'Only tissue acquisition gene threshold 0.38 → 0.':'Only structural blueprint loss attempt probability 0.09 → 0; continuous-locus mutation unchanged.'})),
 cases:chosen.map(({parents,...c})=>({...c,parentOpportunities:parents.length,parentSocial:{min:Math.min(...parents.map(p=>p.parent.genes[5])),max:Math.max(...parents.map(p=>p.parent.genes[5])),mean:parents.reduce((s,p)=>s+p.parent.genes[5],0)/parents.length}})),
 interpretation:['Birth proposals bypass maturity, energy, mating encounter, survival and resource competition. They establish inheritance reachability, not ecological viability or birth probability.','Recorded pair proposals equally replay reservoir-sampled parent opportunities; multiple entries can contain the same parent.','Supplied structures are explicit counterfactual intermediates and are never counted as naturally evolved discoveries.','Serial descent propagates exactly one clonal child each generation with no selection. Its generations cannot be converted to world time steps.','Each one-step proposal resets paired RNG seeds across rule variants. Different rules can consume later draws differently; serial lineages are not identical random trajectories after divergence.','Wilson intervals describe Monte Carlo sampling conditional on these chosen inputs; they are not biological confidence intervals.']};
fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
fs.writeFileSync(path.join(out,'birth-cases.jsonl'),'');fs.writeFileSync(path.join(out,'serial-lineages.jsonl'),'');
function interval(k,n){const z=1.95996398454,p=k/n,d=1+z*z/n,mid=(p+z*z/(2*n))/d,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return {count:k,n,rate:p,wilson95:[Math.max(0,mid-half),Math.min(1,mid+half)]};}
function randomContext(label){return {config:{mutation:DEFAULTS.mutation,fiction:DEFAULTS.fiction},rng:new Random(label),markerRng:new Random(label+':neutral')};}
function beforeGain(dna){const encoded=new Set(dna.structureGenes);for(const change of dna.inheritance.changes)if(change.cause==='mutation-loss')encoded.add(change.id);for(const change of dna.inheritance.changes)if(change.cause==='mutation-gain')encoded.delete(change.id);return [...encoded];}
function birthCase(c,v){
 const rows=Object.fromEntries(targets.map(id=>[id,{eligible:0,expectedGains:0,gains:0,expressedGains:0,encoded:0,expressed:0,inactive:0,losses:0,segregations:0,conflicts:0,candidateTotal:0}]));
 let proposalsWithGain=0,proposalsWithLoss=0,meanStructureGenes=0,meanExpressed=0;
 for(let i=0;i<trials;i++){
  const {parent,mate}=c.parents[i%c.parents.length],dna=v.inheritGenome(randomContext(`${seed}:${c.id}:${i}`),parent,mate),before=beforeGain(dna),expressed=v.expressStructures(before);
  const available=v.traits.filter(t=>(DEFAULTS.fiction||t.kind!=='fiction')&&!before.includes(t.id)&&dna.genes[t.gene]>=t.min&&t.parents.every(id=>expressed.includes(id))&&!(t.excludes||[]).some(id=>before.includes(id)));
  const gains=dna.inheritance.changes.filter(x=>x.cause==='mutation-gain'),losses=dna.inheritance.changes.filter(x=>x.cause==='mutation-loss');
  proposalsWithGain+=Number(gains.length>0);proposalsWithLoss+=Number(losses.length>0);meanStructureGenes+=dna.structureGenes.length;meanExpressed+=dna.traits.length;
  for(const id of targets){const row=rows[id],eligible=available.some(t=>t.id===id),gain=gains.some(t=>t.id===id),encoded=dna.structureGenes.includes(id),active=dna.traits.includes(id);
   if(eligible){row.eligible++;row.expectedGains+=DEFAULTS.mutation/available.length;row.candidateTotal+=available.length;}
   row.gains+=Number(gain);row.expressedGains+=Number(gain&&active);row.encoded+=Number(encoded);row.expressed+=Number(active);row.inactive+=Number(encoded&&!active);row.losses+=Number(losses.some(t=>t.id===id));
   row.segregations+=Number(dna.inheritance.changes.some(t=>t.id===id&&t.cause==='segregation'));row.conflicts+=Number(dna.inheritance.changes.some(t=>t.id===id&&t.cause==='structural-conflict'));
  }
 }
 const targetsResult=Object.fromEntries(Object.entries(rows).map(([id,row])=>[id,{...row,eligible:interval(row.eligible,trials),gain:interval(row.gains,trials),expressedGain:interval(row.expressedGains,trials),encoded:interval(row.encoded,trials),expressed:interval(row.expressed,trials),inactive:interval(row.inactive,trials),meanCandidatesWhenEligible:row.eligible?row.candidateTotal/row.eligible:null}]));
 return {case:c.id,variant:v.id,trials,parentOpportunities:c.parents.length,proposalsWithGain,proposalsWithLoss,meanStructureGenes:meanStructureGenes/trials,meanExpressed:meanExpressed/trials,targets:targetsResult};
}
function quantiles(values){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return {min:sorted[0],median:sorted[Math.floor((sorted.length-1)*.5)],p90:sorted[Math.floor((sorted.length-1)*.9)],max:sorted.at(-1)};}
function serialCase(c,v){
 const records=[];
 for(let n=0;n<lineages;n++){
  let parent=structuredClone(c.parents[n%c.parents.length].parent),peak=parent.traits.length;const rng=randomContext(`${seed}:serial:${c.id}:${n}`),first=Object.fromEntries(targets.map(id=>[id,parent.traits.includes(id)?0:null]));
  for(let generation=1;generation<=generations;generation++){
   const dna=v.inheritGenome(rng,parent,null);parent={...dna,id:generation+1000000+n*(generations+1),origin:1};peak=Math.max(peak,dna.traits.length);
   for(const id of targets)if(first[id]===null&&dna.traits.includes(id))first[id]=generation;
  }
  records.push({replicate:n,firstExpression:first,peakExpressed:peak,finalExpressed:parent.traits,finalEncoded:parent.structureGenes});
 }
 const result={case:c.id,variant:v.id,lineages,generations,targets:Object.fromEntries(targets.map(id=>{const hits=records.filter(r=>r.firstExpression[id]!==null);return [id,{ever:interval(hits.length,lineages),firstExpressionAmongHits:quantiles(hits.map(r=>r.firstExpression[id])),finalExpressed:interval(records.filter(r=>r.finalExpressed.includes(id)).length,lineages)}];})),peakExpressed:quantiles(records.map(r=>r.peakExpressed)),records};
 return result;
}
const birthResults=[],serialResults=[];
for(const c of chosen)for(const v of variants){const result=birthCase(c,v);birthResults.push(result);fs.appendFileSync(path.join(out,'birth-cases.jsonl'),JSON.stringify(result)+'\n');console.log(JSON.stringify({type:'birth',case:c.id,variant:v.id,tissueGains:result.targets.tissue.gains,tissueEligible:result.targets.tissue.eligible.count,trials}));}
for(const c of chosen.filter(c=>c.serial))for(const v of variants){const result=serialCase(c,v);serialResults.push(result);fs.appendFileSync(path.join(out,'serial-lineages.jsonl'),JSON.stringify(result)+'\n');console.log(JSON.stringify({type:'serial',case:c.id,variant:v.id,tissue:result.targets.tissue.ever.count,axial:result.targets.bilateral.ever.count,radial:result.targets.radial.ever.count,lineages,generations}));}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({metadata,birthResults,serialResults},null,2));
