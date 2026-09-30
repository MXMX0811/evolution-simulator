import {growColony,readyToReproduce,propaguleMaterial,releasePropagule,matureCells} from './life-history.js';
import {allocation,uptake,metabolicInvestment,feedingOpportunity,contactPatches} from './metabolism.js';
import {compatible,recognizes,inheritGenome,expressStructures} from './heredity.js';
export {compatible,recognizes} from './heredity.js';
import {initializeEcology,advanceResources,injectLife,spend,synthesize,ingest,recycleBody,preySuitability,eatPrey,balances,recentFlows,N_RATIO,dissipate,emptySources,FOOD_SOURCES} from './ecology.js';
import {SHAPE_GENES,develop} from './development.js';
import {GENES, TRAITS, TRAIT_INDEX, PALETTE, DEFAULTS, has, phenotype} from './biology.js';
export const W=960,H=624,COLS=48,ROWS=32,CELL=W/COLS;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class Random{
 constructor(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}this.state=h>>>0;}
 next(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 normal(){return Math.sqrt(-2*Math.log(Math.max(1e-12,this.next())))*Math.cos(2*Math.PI*this.next());}
 pick(a){return a[Math.floor(this.next()*a.length)];}
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function geneticDistance(a,b){return Math.sqrt(a.reduce((v,g,i)=>v+(g-b[i])**2,0)/a.length);}
export function hereditaryDistance(a,b){return Math.sqrt(.75*geneticDistance(a.genes,b.genes)**2+.25*geneticDistance(a.shape,b.shape)**2);}
export class World{
 constructor(options={}){
  this.config={...DEFAULTS,reproductionMode:'facultative',...options};this.rng=new Random(this.config.seed);this.envRng=new Random(this.config.seed+':environment');this.markerRng=new Random(this.config.seed+':neutral');this.records={};this.interventions=[];this.matingEvidence={};this.pairEvidence={};this.geneFlows=[];this.nextOrigin=1;this.tick=0;this.nextId=1;this.nextSpecies=1;this.nextLineage=1;this.lineages=[];this.agents=[];this.liveCount=0;this.species=[];this.events=[];this.timeline=[];this.history=[];this.effects=[];this.totalBirths=0;this.totalDeaths=0;this.totalMutations=0;this.totalCrossovers=0;this.capacity=2200;this.oxygen=.08;this.originProgress=0;this.originDone=false;this.saturated=false;this.bins=[];
  this.fields=Array.from({length:COLS*ROWS},(_,i)=>{
   const x=(i%COLS+.5)*CELL,y=(Math.floor(i/COLS)+.5)*(H/ROWS);
   return {x,y,height:0,vent:0,nutrient:0,light:0,temp:0,land:false,detritus:0,plankton:0,radiant:0,redox:0,photons:0};
  });
  this.waves=Array.from({length:7},()=>({x:this.envRng.next()*2.4+.6,y:this.envRng.next()*2+.5,p:this.envRng.next()*6.28,a:this.envRng.next()*.1+.035}));
  this.vents=Array.from({length:5},()=>({x:70+this.envRng.next()*(W-140),y:70+this.envRng.next()*(H-140)}));
  for(const f of this.fields){
   f.height=clamp(.5+this.waves.reduce((v,w)=>v+Math.sin(f.x/W*Math.PI*2*w.x+w.p)*Math.cos(f.y/H*Math.PI*2*w.y+w.p)*w.a,0));
   f.vent=this.vents.reduce((v,p)=>Math.max(v,Math.exp(-((p.x-f.x)**2+(p.y-f.y)**2)/5200)),0);
   f.height=clamp(f.height-f.vent*.16);
   f.nutrient=.32+f.vent*.4;f.redox=.5+f.vent*2;f.plankton=.12;
  }
  this.updateEnvironment();initializeEcology(this);this.recordEvent('origin','海洋形成','潮汐、光照与热泉共同补充原始环境的资源。');
  if(!this.config.origin)this.seedLife();
  this.sample();
 }
 fieldAt(x,y){return this.fields[clamp(Math.floor(y/H*ROWS),0,ROWS-1)*COLS+clamp(Math.floor(x/W*COLS),0,COLS-1)];}
 recordEvent(type,title,detail,speciesId=null){const event={tick:this.tick,type,title,detail,speciesId};this.timeline.push(event);this.events.unshift(event);if(this.events.length>180)this.events.length=180;}
 updateEnvironment(){
  const cycle=Math.sin(this.tick/360)*this.config.volatility;
  let temp=this.config.temperature+cycle*9,light=this.config.light,resources=this.config.resources,radiation=0;
  this.effects=this.effects.filter(e=>e.until>this.tick);
  for(const e of this.effects){temp+=e.temp||0;light*=e.light??1;resources*=e.resources??1;radiation+=e.radiation||0;}
  this.environment={temperature:temp,light,resources,radiation,sea:clamp(this.config.sea+Math.sin(this.tick/1500)*this.config.volatility*.05,.25,.85)};
  for(const f of this.fields){
   f.land=f.height>this.environment.sea;
   const depth=clamp((this.environment.sea-f.height)*3);
   f.light=light*(f.land?.9:1-depth*.9)*(.8+.2*Math.sin(f.y/H*3.14));
   
   const season=Math.sin(this.tick/360)*(f.y/H-.5)*this.config.volatility;
   f.temp=temp+(f.vent*12)-(f.y/H-.5)*13-(f.land?0:depth*8)+season*12;
   f.light=Math.max(0,f.light*(1+season*.35));
  }
 }
 createSpecies(genes,parent=null,founderShape=SHAPE_GENES.map(()=>.5)){
  const id=this.nextSpecies++,s={id,origin:parent?parent.origin:this.nextOrigin++,name:parent?`${parent.name.split(' · ')[0]} · ${id}`:`原生族 ${String(id).padStart(2,'0')}`,color:PALETTE[(id-1)%PALETTE.length],parent:parent?.id??null,born:this.tick,extinct:null,founder:[...genes],mean:[...genes],count:0,births:0,deaths:0,traits:[],discovered:[],traitCounts:TRAITS.map(()=>0),generation:0,diversity:0,splitCandidate:0,trend:0,deathCauses:{饥饿:0,衰老:0,捕食:0,灾变:0}};
  s.founderShape=parent?[...parent.meanShape]:[...founderShape];s.meanShape=[...s.founderShape];
  this.species.push(s);
  const node=(speciesId,parentId)=>{const n={id:this.nextLineage++,parent:parentId,species:speciesId,born:this.tick,split:null,children:[],snapshot:null};this.lineages.push(n);return n;};
  if(parent){const ancestor=this.lineages.find(n=>n.id===parent.lineage);ancestor.split=this.tick;ancestor.snapshot=structuredClone(parent.specimen);const continuation=node(parent.id,ancestor.id),child=node(s.id,ancestor.id);ancestor.children=[continuation.id,child.id];parent.lineage=continuation.id;s.lineage=child.id;}
  else s.lineage=node(s.id,null).id;
  return s;
 }
 makeAgent(species,x,y,genes,traits=[],generation=0,energy=13,shape=species.founderShape,birth=null){
  const reproduction=birth?.reproduction||{mode:this.config.reproductionMode,signal:.5,tolerance:.17,socialSignal:.5,socialTolerance:.22};
  const energyLedger={intake:0,maintenance:0,movement:0,reproduction:0,hunting:0,stress:0,growth:0,sources:emptySources()};
  const a={id:this.nextId++,species:species.id,origin:birth?.origin??species.origin,born:this.tick,parents:birth?.parents||[],reproduction:{...reproduction},neutralAllele:birth?birth.neutralAllele:(this.markerRng.next()<.5?0:1),x:clamp(x,1,W-1),y:clamp(y,1,H-1),genes:[...genes],shape:[...shape],development:develop({shape,traits}),traits:[...traits],structureGenes:[...(birth?birth.structureGenes:traits)],form:phenotype(traits),generation,energy,energyLedger,cells:1,feeding:{tick:this.tick,sources:emptySources()},bodyEnergy:2*develop({shape,traits}).mass,handling:0,age:0,angle:this.rng.next()*Math.PI*2,heading:0,cooldown:0,alive:true,lastIntake:0,memory:null,sleeping:false,mutations:birth?.mutations||0};
  a.metabolismBudget=allocation(a);
  this.records[a.id]={id:a.id,born:this.tick,parents:[...a.parents],genes:[...genes],shape:[...shape],traits:[...traits],structureGenes:[...a.structureGenes],generation,origin:a.origin,reproduction:{...reproduction},neutralAllele:a.neutralAllele,mode:birth?.mode||'founder',inheritance:birth?.inheritance||null,birthSpecies:species.id,initialEnergy:{reserve:energy,body:a.bodyEnergy},cells:1,lifeHistory:{peakCells:1,divisions:0,releases:0,matureAt:null,materialFromParent:0},position:{x:a.x,y:a.y},death:null,offspring:[],energy:energyLedger};
  for(const id of a.parents)this.records[id].offspring.push(a.id);
  return a;
 }
 matingRecord(a,b){const labels=[a.species,b.species].sort((x,y)=>x-y),key=labels.join(':');if(!this.matingEvidence[key])this.matingEvidence[key]={species:labels,encounters:0,eligible:0,compatible:0,births:0,lastTick:this.tick};return this.matingEvidence[key];}
 recordMating(a,b,stage){
  const aggregate=this.matingRecord(a,b),ids=[a.id,b.id].sort((x,y)=>x-y),key=ids.join(':');
  if(!this.pairEvidence[key])this.pairEvidence[key]={parents:ids,encounters:0,eligible:0,compatible:0,births:0,firstTick:this.tick,lastTick:this.tick};
  for(const record of [aggregate,this.pairEvidence[key]]){record[stage]++;record.lastTick=this.tick;}
 }
 setEnvironment(patch){const labels={temperature:'温度',light:'光照',resources:'资源补给',sea:'海平面',volatility:'环境波动',mutation:'随机突变概率'},bounds={temperature:[-15,60],light:[0,2],resources:[.1,3],sea:[.25,.85],mutation:[0,.3],volatility:[0,1]};for(const [key,value]of Object.entries(patch))if(!Object.hasOwn(bounds,key)||!Number.isFinite(value)||value<bounds[key][0]||value>bounds[key][1])throw new Error('环境参数无效');const before=Object.fromEntries(Object.keys(patch).map(key=>[key,this.config[key]]));Object.assign(this.config,patch);this.interventions.push({tick:this.tick,type:'parameters',source:'player',before,after:{...patch}});this.updateEnvironment();this.recordEvent('environment','环境参数改变',Object.entries(patch).map(([key,value])=>`${labels[key]}: ${before[key]} → ${value}`).join('；'));}
 seedLife(){
  if(this.originDone)return;
  this.originDone=true;this.originProgress=1;
  for(let i=0;i<this.config.founders;i++){
   const genes=GENES.map((g,j)=>j===6?.4+this.rng.next()*.2:.16+this.rng.next()*.38);
   if(this.config.initialGenes?.[i])genes.splice(0,genes.length,...this.config.initialGenes[i]);
   const s=this.createSpecies(genes,null,SHAPE_GENES.map(()=>.25+this.rng.next()*.5));
   for(let n=0;n<26;n++){
    const p=this.vents[(i+(n<13?0:2))%this.vents.length];
    const g=genes.map(v=>clamp(v+this.rng.normal()*.045));
    this.agents.push(this.makeAgent(s,p.x+this.rng.normal()*45,p.y+this.rng.normal()*45,g,[],0,14+this.rng.next()*5,s.founderShape.map(v=>clamp(v+this.rng.normal()*.025))));
   }
  }
  for(const a of this.agents)injectLife(this,a);
  this.recordEvent('origin','第一批复制者诞生',`${this.config.founders} 个独立谱系从热泉周围出现。它们的初始基因随机生成，各自具有独立的繁殖体系。分类名称不决定交配。`);
  this.liveCount=this.agents.length;this.census();
 }
 reindex(){
  this.bins=Array.from({length:COLS*ROWS},()=>[]);
  for(const a of this.agents)if(a.alive){const f=this.fieldAt(a.x,a.y);this.bins[Math.floor(f.y/H*ROWS)*COLS+Math.floor(f.x/W*COLS)].push(a);}
 }
 neighbors(a,radius){
  const x=Math.floor(a.x/W*COLS),y=Math.floor(a.y/H*ROWS),span=Math.ceil(radius/Math.min(CELL,H/ROWS)),result=[];
  for(let yy=Math.max(0,y-span);yy<=Math.min(ROWS-1,y+span);yy++)for(let xx=Math.max(0,x-span);xx<=Math.min(COLS-1,x+span);xx++){
   for(const b of this.bins[yy*COLS+xx]||[])if(b.alive&&a.id!==b.id&&Math.abs(a.x-b.x)<radius&&Math.abs(a.y-b.y)<radius&&distance(a,b)<radius)result.push(b);
  }
  return result;
 }
 comfort(a,f){
  const g=a.genes,p=a.form,tolerance=8+g[7]*24+p.tolerance;
  const delta=f.temp-(g[6]*65-6),protection=delta<0?p.cold:p.hot;
  const thermal=Math.abs(delta)/tolerance*Math.max(.18,1-protection);
  const land=clamp(g[10]+p.land);
  return thermal*.027+(f.land?(1-land)*.16:land*.006);
 }
 armor(a,kinCount=0){return a.genes[4]*.6+a.form.defense+a.development.defense+Math.min(.3,kinCount*a.form.kinDefense)+(a.age<35?a.form.juvenile:0);}
 chooseHeading(a,near){
  const g=a.genes,budget=a.metabolismBudget,range=(22+g[9]*70)*(1+a.form.sense);let best=-Infinity,angle=a.angle;
  const kin=near.filter(b=>recognizes(a,b));
  let target=has(a,'memory')&&a.memory&&a.memory.expires>this.tick?a.memory:null;
  if(has(a,'hive'))for(const b of kin)if(b.memory&&b.memory.expires>this.tick&&(!target||b.memory.value>target.value))target=b.memory;
  for(let k=0;k<7;k++){
   const theta=k===0?a.angle:this.rng.next()*Math.PI*2;
   const x=clamp(a.x+Math.cos(theta)*range,2,W-2),y=clamp(a.y+Math.sin(theta)*range,2,H-2),f=this.fieldAt(x,y);
   const crowd=this.bins[Math.floor(f.y/H*ROWS)*COLS+Math.floor(f.x/W*COLS)].length;
   const demand=uptake(a,f,this.environment.sea,0,budget);
   let value=Math.min(f.photons,demand.photons)*(1+a.form.photosense)/(1+crowd*.25)+Math.min(f.redox,demand.redox)*(1+a.form.chemical)+Math.min(f.plankton,demand.plankton)+Math.min(f.detritus,demand.detritus)-this.comfort(a,f)*3;
   for(const b of near){const d=Math.max(12,Math.hypot(x-b.x,y-b.y));
    value+=budget.prey*preySuitability(a,b)*(recognizes(a,b)?.1:1)*Math.max(0,1-a.energy/30)*18/d;value-=b.metabolismBudget.prey*preySuitability(b,a)*(recognizes(b,a)?.1:1)*(1-clamp(this.armor(a),0,.94))*15/d;
    if(recognizes(a,b))value+=(g[5]+a.form.attract)*3/d+(a.energy>22?3/d:0);
   }
   if(target)value+=(1-Math.hypot(x-target.x,y-target.y)/W)*g[11]*.5;
   value+=this.rng.next()*.12*(1-g[11]);
   if(value>best){best=value;angle=Math.atan2(y-a.y,x-a.x);}
  }
  a.heading=angle;
 }
 inherit(a,b){return inheritGenome(this,a,b);}
 reproduce(a,near){
  if(!readyToReproduce(a)||a.cooldown>0||a.age<18||a.energy<25-a.genes[8]*5+Math.max(0,a.form.birthCost)||this.liveCount>=this.capacity)return null;
  let mate=null;
  for(const b of near){if(!b.alive||distance(a,b)>=24)continue;this.recordMating(a,b,'encounters');const eligible=readyToReproduce(b)&&b.age>=18&&b.energy>13&&b.cooldown<=0;if(!eligible)continue;this.recordMating(a,b,'eligible');if(compatible(a,b)){this.recordMating(a,b,'compatible');if(!mate)mate=b;}}
  if(a.reproduction.mode==='asexual')mate=null;
  if(!mate&&a.reproduction.mode==='sexual')return null;
  const dna=this.inherit(a,mate),s=this.species.find(s=>s.id===a.species);
  const childEnergy=9+a.form.childEnergy,childBody=2*develop(dna).mass,respiration=Math.max(.2,1.2+Math.min(0,a.form.birthCost)),material=propaguleMaterial(a,childBody),cost=childEnergy+childBody-material.transferred+respiration,partner=mate?cost*.44:0;
  if(a.energy<cost-partner+2||mate&&mate.energy<partner+2)return null;
  const child=this.makeAgent(s,a.x+this.rng.normal()*(9+a.form.dispersal),a.y+this.rng.normal()*(9+a.form.dispersal),dna.genes,dna.traits,Math.max(a.generation,mate?.generation??0)+1,childEnergy,dna.shape,{...dna,origin:a.origin,parents:mate?[a.id,mate.id]:[a.id],mode:mate?'sexual':'asexual'});
  releasePropagule(this,a,material,child);
  a.energy-=cost-partner;a.energyLedger.reproduction+=cost-partner;a.cooldown=Math.max(4,Math.round(22-a.genes[8]*11+a.form.cooldown));
  if(mate){mate.energy-=partner;mate.energyLedger.reproduction+=partner;mate.cooldown=18;this.totalCrossovers++;this.recordMating(a,mate,'births');if(a.species!==mate.species)this.geneFlows.push({tick:this.tick,parents:[a.id,mate.id],species:[a.species,mate.species],child:child.id});}
  dissipate(this,this.fieldAt(a.x,a.y),respiration);
  this.agents.push(child);this.liveCount++;s.births++;this.totalBirths++;this.totalMutations+=dna.mutations;
  const novel=dna.traits.filter(id=>!s.discovered.includes(id));
  if(novel.length){s.discovered.push(...novel);const names=novel.map(id=>TRAITS[TRAIT_INDEX[id]].name).join('、');this.recordEvent('trait',`${s.name} 出现${names}`,'新性状来自随机遗传变异；是否扩散取决于携带者能否留下后代。',s.id);}
  return child;
 }
 kill(a,cause){
  if(!a.alive)return;a.alive=false;this.totalDeaths++;this.records[a.id].death={tick:this.tick,cause,x:a.x,y:a.y};
  const s=this.species.find(s=>s.id===a.species);s.deaths++;s.deathCauses[cause]++;
  recycleBody(this,a);this.liveCount--;
 }
 step(times=1){for(let n=0;n<times;n++)this.stepOne();}
 stepOne(){
  if(this.saturated)return;
  this.tick++;this.updateEnvironment();const photoBefore=this.ecology.photo,heatBefore=this.ecology.heat;advanceResources(this,COLS,ROWS);
  if(!this.originDone){this.originProgress=clamp(this.originProgress+.009+this.envRng.next()*.009);if(this.originProgress>=1)this.seedLife();if(this.tick%12===0)this.sample();return;}
  if(this.tick%900===0&&this.envRng.next()<this.config.volatility)this.trigger(this.envRng.pick(['winter','bloom','volcano']),'自然事件');
  // Recompute once per step so interventions to inherited parameters are immediately visible.
  for(const a of this.agents)a.metabolismBudget=allocation(a);
  this.reindex();this.liveCount=this.agents.length;const current=[...this.agents];
  // Rotating iteration order avoids consistently giving the same founders first access to food.
  const offset=Math.floor(this.rng.next()*current.length);
  for(let i=0;i<current.length;i++){
   const a=current[(i+offset)%current.length];if(!a.alive)continue;
   const g=a.genes,p=a.form; a.age++;a.cooldown--;a.handling--;let f=this.fieldAt(a.x,a.y);
   a.sleeping=has(a,'spore')&&a.energy<5&&contactPatches(this,a,COLS,ROWS).reduce((sum,part)=>sum+feedingOpportunity(a,part.field,this.environment.sea,0,a.metabolismBudget)*part.weight,0)<.12+p.sleepThreshold+this.comfort(a,f);
   const radius=(22+g[9]*45)*(1+p.sense);
   const near=this.neighbors(a,radius),kinCount=near.filter(b=>recognizes(a,b)&&distance(a,b)<34).length;
   if(!a.sleeping){
    if((a.id+this.tick)%7===0)this.chooseHeading(a,near);
    const speed=(.18+g[3]*1.25)*Math.max(.06,1+p.speed+(f.land?p.landSpeed:p.swim))*(1-g[4]*.32)*a.development.speed;
    let turn=(a.heading-a.angle+Math.PI*3)%(Math.PI*2)-Math.PI;a.angle+=turn*clamp((.35+p.turn)*a.development.turn,.08,.95);
    a.x=clamp(a.x+Math.cos(a.angle)*speed,1,W-1);a.y=clamp(a.y+Math.sin(a.angle)*speed,1,H-1);
    f=this.fieldAt(a.x,a.y);
    const crowd=this.bins[Math.floor(f.y/H*ROWS)*COLS+Math.floor(f.x/W*COLS)].length;
    const budget=a.metabolismBudget;let intake=0;
    for(const {field:patch,weight,coverage} of contactPatches(this,a,COLS,ROWS)){
     const demand=uptake(a,patch,this.environment.sea,kinCount,budget);
     const respiration=clamp(.64+(has(a,'oxygen')?this.oxygen*.22:0)+(patch.land?p.air:p.water)*this.oxygen,.3,.96);
     intake+=synthesize(this,a,patch,'photons',Math.min(patch.photons*coverage,demand.photons*weight/(1+crowd*.13)),.86);
     intake+=synthesize(this,a,patch,'redox',Math.min(patch.redox*coverage,demand.redox*weight),respiration);
     intake+=ingest(this,a,patch,'plankton',Math.min(patch.plankton*coverage,demand.plankton*weight),respiration);
     intake+=ingest(this,a,patch,'detritus',Math.min(patch.detritus*coverage,demand.detritus*weight),respiration);
     if(has(a,'radiant'))intake+=synthesize(this,a,patch,'radiant',Math.min(patch.radiant*coverage,.12*weight),.65);
    }

    if(budget.prey>.04&&a.handling<=0&&a.energy<26&&(a.id+this.tick)%5===0){
     const prey=near.filter(b=>b.alive&&distance(a,b)<8+g[2]*5+p.reach).sort((b,c)=>preySuitability(a,c)-preySuitability(a,b))[0];
     if(prey){spend(this,a,.1,'hunting');const chance=clamp((budget.prey*.5+p.hunt*budget.prey*4)*preySuitability(a,prey)*(recognizes(a,prey)?.1:1)*(1-clamp(this.armor(prey,this.neighbors(prey,30).filter(b=>recognizes(prey,b)).length),0,.94)),0,.25);
      spend(this,a,prey.form.poison,'stress');
      if(a.energy>0&&this.rng.next()<chance*(1-clamp(prey.form.conceal,0,.8))){intake+=eatPrey(this,a,prey);a.handling=Math.ceil(8+prey.development.mass*10);this.kill(prey,'捕食');}
     }
    }
    a.lastIntake=intake;
    if(has(a,'memory')&&intake>.19&&(!a.memory||intake>a.memory.value||a.memory.expires<this.tick))a.memory={x:a.x,y:a.y,value:intake,expires:this.tick+160};

   }else{a.lastIntake=0;}
   const traitCost=p.cost+a.development.cost;
   const thermal=this.comfort(a,f);
   const cost=.047+metabolicInvestment(a,a.metabolismBudget)+g[4]**2*.016+g[5]**2*.012+g[7]**2*.02+g[9]**2*.013+g[11]**2*.011+g[8]**2*.014+traitCost;
   const metabolicScale=(.8+.2*Math.pow(a.development.unitMass,.75))*a.cells;
   spend(this,a,cost*(a.sleeping?.18:1)*metabolicScale,'maintenance');
   if(!a.sleeping)spend(this,a,g[3]**2*.027*a.development.movementCost*metabolicScale,'movement');
   spend(this,a,(thermal+this.environment.radiation*(has(a,'radiant')?.005:.035))*(a.sleeping?.18:1)*metabolicScale,'stress');
   if(a.energy<=0){this.kill(a,'饥饿');continue;}
   if(a.age>350+g[7]*260+p.lifespan&&this.rng.next()<.012){this.kill(a,'衰老');continue;}
   if(!a.sleeping){growColony(this,a);this.reproduce(a,near);}
  }
  this.agents=this.agents.filter(a=>a.alive);this.saturated=this.agents.length>=this.capacity;
  if(this.saturated)this.recordEvent('capacity','达到计算容量','模拟在 2,200 个体处暂停。这是计算上限，不能当作生态平衡。可导出存档或施加陨石干预后继续。');
  this.oxygen=clamp(this.oxygen+(this.ecology.photo-photoBefore)*.000003-(this.ecology.heat-heatBefore)*.000002-.00002,.015,.98);
  if(this.tick%24===0){this.census();this.sample();}
  if(this.tick%144===0)this.speciate();
 }
 census(){
  for(const s of this.species){
   const group=this.agents.filter(a=>a.species===s.id);const prev=s.count;s.count=group.length;s.trend=s.count-prev;
   if(!group.length){s.traits=[];s.traitCounts=TRAITS.map(()=>0);if(s.extinct===null){s.extinct=this.tick;this.recordEvent('extinction',`${s.name} 灭绝`,'这一登记支系已无存活个体。分类标签不会阻止后代通过其他支系延续；亲子档案仍保留。',s.id);}continue;}
   s.mean=GENES.map((_,j)=>group.reduce((v,a)=>v+a.genes[j],0)/group.length);
   s.meanShape=SHAPE_GENES.map((_,j)=>group.reduce((v,a)=>v+a.shape[j],0)/group.length);
   s.diversity=group.reduce((v,a)=>v+hereditaryDistance(a,{genes:s.mean,shape:s.meanShape}),0)/group.length;
   s.generation=Math.max(...group.map(a=>a.generation));s.traits=[];s.traitCounts=TRAITS.map(()=>0);
   for(const a of group)for(const id of a.traits)s.traitCounts[TRAIT_INDEX[id]]++;
   s.traits=TRAITS.filter((t,i)=>s.traitCounts[i]>0).map(t=>t.id);
   s.energy=group.reduce((v,a)=>v+a.energy,0)/group.length;
   const combinations=new Map();for(const a of group)combinations.set(a.traits.join(','),(combinations.get(a.traits.join(','))||0)+1);
   let common='',most=0;for(const [traits,n] of combinations)if(n>most){common=traits;most=n;}
   let representative=null,best=Infinity;for(const a of group)if(a.traits.join(',')===common){const d=hereditaryDistance(a,{genes:s.mean,shape:s.meanShape});if(d<best){representative=a;best=d;}}
   s.specimen={id:representative.id,genes:[...representative.genes],shape:[...representative.shape],traits:[...representative.traits],structureGenes:[...representative.structureGenes],cells:representative.cells,generation:representative.generation,cohort:most,sleeping:representative.sleeping};
  }
 }
 speciate(){
  if(this.species.length>=40)return;
  this.reindex();
  const mean=group=>({genes:GENES.map((_,i)=>group.reduce((sum,a)=>sum+a.genes[i],0)/group.length),shape:SHAPE_GENES.map((_,i)=>group.reduce((sum,a)=>sum+a.shape[i],0)/group.length)});
  for(const s of [...this.species]){
   const group=this.agents.filter(a=>a.species===s.id);
   if(group.length<16){s.splitCandidate=0;continue;}
   const pending=new Set(group.map(a=>a.id)),candidates=[];
   for(const origin of group){
    if(!pending.delete(origin.id))continue;
    const cluster=[origin];
    for(let i=0;i<cluster.length;i++)for(const b of this.neighbors(cluster[i],24)){
     if(b.species===s.id&&(cluster[i].reproduction.mode==='asexual'||compatible(cluster[i],b))&&hereditaryDistance(cluster[i],b)<=.14&&pending.delete(b.id))cluster.push(b);
    }
    if(cluster.length<8||group.length-cluster.length<8)continue;
    const ids=new Set(cluster.map(a=>a.id)),rest=group.filter(a=>!ids.has(a.id)),dna=mean(cluster),gap=hereditaryDistance(dna,mean(rest));
    if(gap<.10)continue;
    candidates.push({cluster,...dna,gap,x:cluster.reduce((sum,a)=>sum+a.x,0)/cluster.length,y:cluster.reduce((sum,a)=>sum+a.y,0)/cluster.length});
   }
   if(!candidates.length){s.splitCandidate=0;continue;}
   const matches=c=>s.splitCandidate>0&&s.splitAnchor&&hereditaryDistance(s.splitAnchor,c)<.08&&Math.hypot(c.x-s.splitX,c.y-s.splitY)<130;
   const candidate=candidates.find(matches)||candidates.reduce((best,c)=>c.gap>best.gap?c:best,candidates[0]);
   const continuing=matches(candidate);
   if(!continuing){s.splitCandidate=1;s.splitFirstTick=this.tick;s.splitBirthCutoff=this.nextId;}else if(s.splitLastTick!==this.tick)s.splitCandidate++;
   s.splitLastTick=this.tick;
   s.splitAnchor={genes:[...candidate.genes],shape:[...candidate.shape]};s.splitX=candidate.x;s.splitY=candidate.y;
   const newborns=candidate.cluster.filter(a=>a.id>=s.splitBirthCutoff&&a.parents.length),contributors=new Set(newborns.flatMap(a=>a.parents));
   if(s.splitCandidate<3||this.tick-s.splitFirstTick<288||newborns.length<4||contributors.size<2)continue;
   const groupIds=new Set(group.map(a=>a.id)),candidateIds=new Set(candidate.cluster.map(a=>a.id)),rest=group.filter(a=>!candidateIds.has(a.id));let compatiblePairs=0;
   for(const a of candidate.cluster)for(const b of rest)if(compatible(a,b))compatiblePairs++;
   const encounterCounts={encounters:0,eligible:0,compatible:0,births:0};
   for(const evidence of Object.values(this.pairEvidence)){const [left,right]=evidence.parents;if(!groupIds.has(left)||!groupIds.has(right)||candidateIds.has(left)===candidateIds.has(right))continue;for(const key of Object.keys(encounterCounts))encounterCounts[key]+=evidence[key];}
   const child=this.createSpecies(candidate.genes,s);
   child.founderShape=[...candidate.shape];child.meanShape=[...candidate.shape];
   child.speciationEvidence={kind:'divergent-lineage',gap:candidate.gap,cohort:candidate.cluster.length,tick:this.tick,since:s.splitFirstTick,newborns:newborns.length,contributors:contributors.size,compatiblePairs,totalPairs:candidate.cluster.length*rest.length,encounters:encounterCounts,encounterWindow:'lifetimes-of-current-members',status:candidate.cluster.every(a=>a.reproduction.mode==='asexual')?'无性分化支系':compatiblePairs===0?'识别屏障':'分化支系'};
   for(const a of candidate.cluster){a.species=child.id;for(const id of a.traits)if(!child.discovered.includes(id))child.discovered.push(id);}
   s.splitCandidate=0;
   this.recordEvent('speciation','一条分化支系被记录',`${s.name} 的支系在 ${this.tick-s.splitFirstTick} 时步及 ${newborns.length} 个存活新生个体中保持差异（均值距离 ${candidate.gap.toFixed(3)}），登记为 ${child.name}。分类不改变繁殖规则；重新相遇后仍按遗传识别性状决定能否交流。`,child.id);
   if(this.species.length>=40){this.recordEvent('capacity','谱系记录达到上限','已记录 40 个历史分群。生态仍继续运行，但后续分化不再登记为新支系；这不是自然分化停止。');break;}
  }
  this.census();
 }
 sample(){
  const counts=Object.fromEntries(this.species.map(s=>[s.id,this.agents.filter(a=>a.species===s.id).length]));
  this.history.push({tick:this.tick,counts,total:this.agents.length,oxygen:this.oxygen,temperature:this.environment.temperature,ecosystem:balances(this)});if(this.history.length>500)this.history.shift();
 }
 trigger(type,prefix='干预'){
  const definitions={
   winter:{title:'漫长寒冬',detail:'接下来 450 时步，气温降低 18°C，光照减弱 48%。',temp:-18,light:.52,duration:450},
   volcano:{title:'火山活动',detail:'接下来 350 时步，气温升高 13°C，矿物补给增至 1.8 倍。',temp:13,resources:1.8,duration:350},
   bloom:{title:'营养涌流',detail:'接下来 400 时步，环境资源补给增至 2.4 倍。',resources:2.4,duration:400},
   radiation:{title:'辐射风暴',detail:'接下来 320 时步，辐射代谢获得额外能量；普通个体承担代谢压力。',radiation:1,temp:8,duration:320},
   drought:{title:'海退',detail:'海平面降低 0.13；原本的浅海成为陆地。调整海平面可以重新淹没它们。'},
   meteor:{title:'陨石撞击',detail:'一个随机撞击区内的大部分生命消失，随后进入 300 时步的弱光时期。',light:.55,duration:300},
  };
  const d=definitions[type];if(!d)throw new Error('未知环境事件');const seaBefore=this.config.sea;
  if(type==='drought')this.config.sea=clamp(this.config.sea-.13,.25,.85);
  if(type==='meteor'){
   const p={x:this.envRng.next()*W,y:this.envRng.next()*H},impactSeed=this.envRng.next();this.impact={...p,until:this.tick+80};
   for(const a of this.agents)if(distance(a,p)<210&&new Random(`${impactSeed}:${a.id}`).next()<.82)this.kill(a,'灾变');this.agents=this.agents.filter(a=>a.alive);this.saturated=this.agents.length>=this.capacity;this.census();
  }
  if(d.duration)this.effects.push({type,...d,until:this.tick+d.duration});
  this.interventions.push({tick:this.tick,type,source:prefix==='自然事件'?'natural':'player',duration:d.duration||null,effect:{...d},seaBefore,seaAfter:this.config.sea,impact:type==='meteor'?{x:this.impact.x,y:this.impact.y}:null});this.recordEvent('environment',`${prefix} · ${d.title}`,d.detail);this.updateEnvironment();
 }
 summary(){return {version:6,ecosystem:balances(this),foodWeb:recentFlows(this),seed:this.config.seed,tick:this.tick,population:this.agents.length,livingSpecies:this.species.filter(s=>s.count>0).length,births:this.totalBirths,deaths:this.totalDeaths,mutations:this.totalMutations,crossovers:this.totalCrossovers,oxygen:this.oxygen,temperature:this.environment.temperature,species:this.species.map(s=>({id:s.id,name:s.name,count:s.count,generation:s.generation,mean:s.mean,shape:s.meanShape,lineage:s.lineage,parent:s.parent,traits:TRAITS.filter((t,i)=>s.traitCounts[i]>0).map(t=>({id:t.id,name:t.name,count:s.traitCounts[TRAIT_INDEX[t.id]]})),extinct:s.extinct})),lineages:this.lineages,events:this.events.slice(0,12)};}
 serialize(){return JSON.stringify({version:6,world:{...this,rng:{state:this.rng.state},envRng:{state:this.envRng.state},markerRng:{state:this.markerRng.state},bins:[]}});}
 static restore(text){
  const data=JSON.parse(text),d=data.world;
  if(data.version!==6||!d||!Array.isArray(d.agents)||!Array.isArray(d.species)||d.fields?.length!==COLS*ROWS||!Number.isFinite(d.tick)||!Number.isFinite(d.rng?.state)||!Number.isFinite(d.envRng?.state)||!Number.isFinite(d.markerRng?.state)||!d.records||!Array.isArray(d.interventions)||!Array.isArray(d.geneFlows)||!d.matingEvidence||!d.pairEvidence||!d.config||!Array.isArray(d.effects)||!Array.isArray(d.events)||!Array.isArray(d.timeline)||!Array.isArray(d.history)||!d.ecology||!d.foodWeb)throw new Error('需要源海 v6 存档；旧实验请在对应的原离线版本中打开');
  const ids=new Set(d.species.map(s=>s.id));
  const validSources=sources=>sources&&FOOD_SOURCES.every(key=>Number.isFinite(sources[key])&&sources[key]>=0);
  const validBlueprint=a=>Array.isArray(a.structureGenes)&&new Set(a.structureGenes).size===a.structureGenes.length&&a.structureGenes.every(id=>id in TRAIT_INDEX)&&a.traits.length===expressStructures(a.structureGenes).length&&expressStructures(a.structureGenes).every(id=>a.traits.includes(id));

  const ledgerKeys=['energyIn','nutrientIn','heat','energyOut','nutrientOut','photo','chemical','recycled'];
  if(d.fields.some(f=>['nutrient','redox','plankton','detritus','photons','radiant','temp','height','vent','light','x','y'].some(k=>!Number.isFinite(f[k])))||ledgerKeys.some(k=>!Number.isFinite(d.ecology[k])||d.ecology[k]<0)||['organic','redox','energy','nutrient'].some(k=>!Number.isFinite(d.ecology.initial?.[k])))throw new Error('存档中的生态库存或收支记录无效');

  const foodSources=new Set(['photons','redox','plankton','detritus','radiant',...d.species.map(s=>String(s.id))]);if(Object.values(d.foodWeb).some(f=>!foodSources.has(f.source)||!ids.has(Number(f.consumer))||!Number.isFinite(f.amount)||f.amount<0||!Number.isFinite(f.tick)||f.tick>d.tick))throw new Error('存档中的食物网络记录无效');
  if(d.agents.length>2200||d.species.length>40||d.agents.some(a=>!ids.has(a.species)||!d.records[a.id]||!Number.isInteger(a.origin)||![0,1].includes(a.neutralAllele)||!['asexual','sexual','facultative'].includes(a.reproduction?.mode)||['signal','tolerance','socialSignal','socialTolerance'].some(k=>!Number.isFinite(a.reproduction[k])||a.reproduction[k]<0||a.reproduction[k]>1)||['intake','maintenance','movement','reproduction','hunting','stress','growth'].some(k=>!Number.isFinite(a.energyLedger?.[k])||a.energyLedger[k]<0)||a.genes?.length!==GENES.length||a.shape?.length!==SHAPE_GENES.length||a.shape.some(v=>!Number.isFinite(v)||v<0||v>1)||a.genes.some(g=>!Number.isFinite(g)||g<0||g>1)||![a.x,a.y,a.energy,a.age,a.bodyEnergy,a.handling].every(Number.isFinite)||!Array.isArray(a.traits)||a.traits.some(id=>!(id in TRAIT_INDEX))||new Set(a.traits).size!==a.traits.length||a.traits.some(id=>!TRAITS[TRAIT_INDEX[id]].parents.every(p=>a.traits.includes(p))||(TRAITS[TRAIT_INDEX[id]].excludes||[]).some(p=>a.traits.includes(p)))||!validBlueprint(a)||!Number.isInteger(a.cells)||a.cells<1||a.cells>matureCells(a)||Math.abs(a.bodyEnergy-2*develop(a).unitMass*a.cells)>1e-8||!Number.isFinite(a.feeding?.tick)||a.feeding.tick>d.tick||!validSources(a.feeding.sources)||!validSources(a.energyLedger.sources)))throw new Error('存档中的个体数据无效');
  if(!Array.isArray(d.lineages)||!Number.isInteger(d.nextLineage))throw new Error('存档缺少谱系分叉记录');
  const nodes=new Map(d.lineages.map(n=>[n.id,n]));
  if(nodes.size!==d.lineages.length||d.lineages.some(n=>!Number.isInteger(n.id)||n.id<1||n.id>=d.nextLineage||n.parent!==null&&(!nodes.has(n.parent)||n.parent>=n.id)||![0,2].includes(n.children.length)||n.children.some(id=>nodes.get(id)?.parent!==n.id)||n.parent!==null&&!nodes.get(n.parent).children.includes(n.id))||d.species.some(s=>!nodes.has(s.lineage)||nodes.get(s.lineage).species!==s.id||nodes.get(s.lineage).children.length||s.meanShape?.length!==SHAPE_GENES.length))throw new Error('存档中的谱系结构无效');
  const energyKeys=['intake','maintenance','movement','reproduction','hunting','stress','growth'],reproductionKeys=['mode','signal','tolerance','socialSignal','socialTolerance'],livingIds=new Set(d.agents.map(a=>a.id));
  const same=(left,right)=>Array.isArray(left)&&left.length===right.length&&left.every((value,index)=>value===right[index]);
  if(livingIds.size!==d.agents.length)throw new Error('存档中的个体身份重复');
  // Check the archive schema before dereferencing parents or rendering historical bodies.
  for(const [key,record]of Object.entries(d.records)){
   if(!record||Number(key)!==record.id||!Number.isInteger(record.id)||record.id<1||record.id>=d.nextId||!Number.isFinite(record.born)||record.born<0||record.born>d.tick||!Number.isInteger(record.generation)||record.generation<0||!Number.isInteger(record.origin)||record.origin<1||!ids.has(record.birthSpecies)||![0,1].includes(record.neutralAllele)||![record.position?.x,record.position?.y,record.initialEnergy?.reserve,record.initialEnergy?.body].every(Number.isFinite)||record.initialEnergy.reserve<0||record.initialEnergy.body<0)throw new Error('存档中的个体历史身份无效');
   if(record.genes?.length!==GENES.length||record.shape?.length!==SHAPE_GENES.length||!Array.isArray(record.genes)||!Array.isArray(record.shape)||[...record.genes,...record.shape].some(v=>!Number.isFinite(v)||v<0||v>1)||!Array.isArray(record.traits)||new Set(record.traits).size!==record.traits.length||record.traits.some(id=>!(id in TRAIT_INDEX))||record.traits.some(id=>!TRAITS[TRAIT_INDEX[id]].parents.every(p=>record.traits.includes(p))||(TRAITS[TRAIT_INDEX[id]].excludes||[]).some(p=>record.traits.includes(p))))throw new Error('存档中的历史身体性状无效');
   if(!validBlueprint(record)||record.cells!==1||!record.lifeHistory||['peakCells','divisions','releases'].some(k=>!Number.isInteger(record.lifeHistory[k])||record.lifeHistory[k]<0)||!Number.isFinite(record.lifeHistory.materialFromParent)||record.lifeHistory.peakCells<1||record.lifeHistory.peakCells>matureCells(record)||record.lifeHistory.matureAt!==null&&(!Number.isFinite(record.lifeHistory.matureAt)||record.lifeHistory.matureAt<record.born||record.lifeHistory.matureAt>d.tick)||!validSources(record.energy?.sources))throw new Error('存档中的身体发育或摄入记录无效');
   if(!['sexual','asexual','facultative'].includes(record.reproduction?.mode)||reproductionKeys.slice(1).some(k=>!Number.isFinite(record.reproduction[k])||record.reproduction[k]<0||record.reproduction[k]>1)||energyKeys.some(k=>!Number.isFinite(record.energy?.[k])||record.energy[k]<0))throw new Error('存档中的历史繁殖或能量记录无效');
   if(!['founder','sexual','asexual'].includes(record.mode)||!Array.isArray(record.parents)||!Array.isArray(record.offspring)||new Set(record.parents).size!==record.parents.length||new Set(record.offspring).size!==record.offspring.length||record.parents.length!==({founder:0,sexual:2,asexual:1})[record.mode]||record.parents.some(id=>!d.records[id]||id>=record.id)||record.offspring.some(id=>!d.records[id]))throw new Error('存档中的亲本与后代身份无效');
   if(record.death!==null&&(!record.death||!Number.isFinite(record.death.tick)||record.death.tick<record.born||record.death.tick>d.tick||!['饥饿','衰老','捕食','灾变'].includes(record.death.cause)||![record.death.x,record.death.y].every(Number.isFinite))||livingIds.has(record.id)!==(record.death===null))throw new Error('存档中的生命状态与死亡记录不一致');
  }
  for(const record of Object.values(d.records)){
   if(record.parents.some(id=>!d.records[id].offspring.includes(record.id)||d.records[id].born>record.born||d.records[id].death&&d.records[id].death.tick<record.born)||record.offspring.some(id=>!d.records[id].parents.includes(record.id)))throw new Error('存档中的亲缘关系不是双向一致的记录');
   if(record.mode==='founder'){if(record.inheritance!==null)throw new Error('初始个体不应有亲本遗传记录');continue;}
   const inherited=record.inheritance;
   if(!inherited||!Array.isArray(inherited.changes))throw new Error('存档缺少出生变更记录');
   for(const field of ['genes','shape'])if(!Array.isArray(inherited[field])||inherited[field].length!==record[field].length||inherited[field].some((entry,index)=>!entry||entry.index!==index||!record.parents.includes(entry.parent)||entry.before!==d.records[entry.parent][field][index]||entry.after!==record[field][index]||entry.mutated!==(entry.before!==entry.after)))throw new Error('存档中的遗传位点来源不一致');
   if(!Array.isArray(inherited.reproduction)||inherited.reproduction.length!==reproductionKeys.length||inherited.reproduction.some((entry,index)=>!entry||entry.id!==reproductionKeys[index]||!record.parents.includes(entry.parent)||entry.before!==d.records[entry.parent].reproduction[entry.id]||entry.after!==record.reproduction[entry.id]||entry.mutated!==(entry.before!==entry.after)))throw new Error('存档中的繁殖性状来源不一致');
   const marker=inherited.neutralAllele;
   if(!marker||!record.parents.includes(marker.parent)||marker.before!==d.records[marker.parent].neutralAllele||marker.after!==record.neutralAllele||marker.mutated!==(marker.before!==marker.after))throw new Error('存档中的中性标记来源不一致');
   if(!Array.isArray(inherited.traits)||inherited.traits.some(entry=>!entry||!(entry.id in TRAIT_INDEX)||!Array.isArray(entry.parents)||entry.parents.some(id=>!record.parents.includes(id)||!d.records[id].structureGenes.includes(entry.id))||entry.retained!==record.traits.includes(entry.id)||entry.encoded!==record.structureGenes.includes(entry.id))||new Set(inherited.traits.map(t=>t.id)).size!==inherited.traits.length||[...record.structureGenes,...record.parents.flatMap(id=>d.records[id].structureGenes)].some(id=>!inherited.traits.some(t=>t.id===id)))throw new Error('存档中的结构继承记录无效');
  }
  for(const a of d.agents){const record=d.records[a.id];if(!a.alive||a.cells>record.lifeHistory.peakCells||a.cells!==1+record.lifeHistory.divisions-record.lifeHistory.releases||a.born!==record.born||a.origin!==record.origin||a.generation!==record.generation||a.neutralAllele!==record.neutralAllele||!same(a.parents,record.parents)||!same(a.genes,record.genes)||!same(a.shape,record.shape)||!same(a.traits,record.traits)||!same(a.structureGenes,record.structureGenes)||FOOD_SOURCES.some(k=>a.energyLedger.sources[k]!==record.energy.sources[k])||reproductionKeys.some(k=>a.reproduction[k]!==record.reproduction[k])||energyKeys.some(k=>a.energyLedger[k]!==record.energy[k]))throw new Error('存活个体与出生档案不一致');}
  const w=Object.assign(Object.create(World.prototype),d);w.rng=Object.assign(Object.create(Random.prototype),d.rng);w.envRng=Object.assign(Object.create(Random.prototype),d.envRng);w.markerRng=Object.assign(Object.create(Random.prototype),d.markerRng);for(const a of w.agents){w.records[a.id].energy=a.energyLedger;a.form=phenotype(a.traits);a.development=develop(a,a.cells);a.metabolismBudget=allocation(a);}w.reindex();return w;
 }
}
