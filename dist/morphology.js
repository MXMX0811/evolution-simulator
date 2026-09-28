import * as THREE from './vendor/three.module.min.js';
import {has,TRAITS,TRAIT_INDEX,STAGES,traitClosure,PALETTE} from './biology.js';
import {escape} from './views.js';
import {buildOrganism,disposeOrganism,focusOrganism} from './anatomy.js';
import {SHAPE_GENES,develop,combinationSample,compatibleTraits} from './development.js';
export {buildOrganism} from './anatomy.js';
export const MORPHOLOGY=Object.fromEntries(TRAITS.map(t=>[t.id,t.shape]));
let samplePage=0,lab=combinationSample(1);
export function nextCombinations(){samplePage++;}
export function useCombination(seed){lab=combinationSample(seed);}
export function setShape(index,value){lab.shape[index]=value;}
export function setStructure(id){
 if(lab.traits.includes(id)){const keep=lab.traits.filter(t=>t!==id);lab.traits=[];for(const t of TRAITS)if(keep.includes(t.id)&&t.parents.every(p=>lab.traits.includes(p)))lab.traits.push(t.id);}
 else if(compatibleTraits([...lab.traits,id]))lab.traits=traitClosure([...lab.traits,id]);
}
export function previewSpecimen(key){
 if(key==='workshop')return lab;
 if(key.startsWith('sample:'))return combinationSample(+key.slice(7));
 return {id:key,traits:traitClosure([key.slice(6)]),genes:Array(12).fill(.62),shape:Array(8).fill(.5),generation:0};
}
function workshopView(){
 const d=develop(lab);
 return `<section class="combination-lab"><div class="lab-model"><span class="eyebrow">MORPHOLOGY WORKSHOP</span><h3>组合一副身体</h3><button class="specimen-window" data-preview="workshop" data-inspect="workshop" aria-label="放大观察自由组合标本"><span class="specimen-scale">独立实验台 · 点击放大 ↗</span></button><p>${d.label} · ${lab.traits.length} 项结构<br>加入结构时补齐前置，移除前置时收回依赖器官。</p><div class="lab-shapes">${SHAPE_GENES.map((name,i)=>`<label>${name}<output id="shape-value-${i}">${Math.round(lab.shape[i]*100)}</output><input type="range" data-shape="${i}" aria-label="${name}" min="0" max="100" value="${Math.round(lab.shape[i]*100)}"></label>`).join('')}</div></div><div class="lab-structures"><h3>相容的结构，一起表达</h3><p>鳍、翼、步足可以并存；两侧与辐射主轴在当前模型中互斥。这里的编辑只改变观察样本。</p>${Object.entries(Object.groupBy(TRAITS,t=>t.lane)).map(([lane,traits])=>`<details open><summary>${({energy:'摄食与代谢',body:'身体结构',motion:'运动器官',sense:'感知',defense:'防御',reproduction:'繁殖',habitat:'栖息',fiction:'科幻结构'})[lane]}</summary><div class="structure-options">${traits.map(t=>{const active=lab.traits.includes(t.id),allowed=active||compatibleTraits([...lab.traits,t.id]);return `<button data-structure="${t.id}" class="${active?'active':''}" aria-pressed="${active}" ${allowed?'':'disabled'} title="${allowed?t.shape:'与当前身体主轴冲突，先移除冲突的对称结构'}">${active?'✓ ':''}${t.name}</button>`;}).join('')}</div></details>`).join('')}</div></section>`;
}
export function morphologyView(world,selected,mode='living'){
 const living=world.species.filter(s=>s.specimen),possible=mode==='possible';
 const cards=possible?Array.from({length:9},(_,i)=>{const seed=samplePage*9+i,a=combinationSample(seed),d=develop(a);return `<article class="specimen-card"><div class="specimen-head"><span>组合 ${String(seed+1).padStart(3,'0')}</span><span>规则生成</span></div><button class="specimen-window" data-preview="sample:${seed}" data-inspect="sample:${seed}" aria-label="观察组合 ${seed+1}"><span class="specimen-stage">${d.label} · ${a.traits.length} 项结构</span><span class="specimen-scale">独立样本 · 未加入世界</span></button><div class="specimen-info"><div class="specimen-traits">${a.traits.filter(id=>!a.traits.some(other=>TRAITS[TRAIT_INDEX[other]].parents.includes(id))).map(id=>`<button data-explore="${id}">${TRAITS[TRAIT_INDEX[id]].name}</button>`).join('')}</div><button class="text-button" data-use-sample="${seed}">带入组合台 ↗</button></div></article>`;}).join(''):living.map(s=>{
 const a=s.specimen,traits=TRAITS.filter(t=>has(a,t.id)),stage=Math.max(0,...traits.map(t=>t.stage));
 return `<article class="specimen-card ${s.extinct!==null?'extinct':''} ${selected===s.id?'selected':''}"><div class="specimen-head"><span style="color:${s.color}">${escape(s.name)}</span><span>${s.extinct!==null?'已灭绝':`${s.count} 个体`}</span></div><button class="specimen-window" data-model="${s.id}" data-inspect="species:${s.id}" aria-label="放大观察 ${escape(s.name)} 的三维形态"><span class="specimen-stage">${STAGES[stage]}</span><span class="specimen-scale">个体 ${a.id} / G${a.generation} · 点击放大 ↗</span></button><div class="specimen-info"><div class="specimen-traits">${traits.length?traits.map(t=>`<button data-explore="${t.id}" title="${t.shape}">${t.name}</button>`).join(''):'<span>原始复制结构</span>'}</div><p>${s.extinct!==null?'保存最后一次观测到的形态':`此性状组合占种群 ${Math.round(a.cohort/Math.max(1,s.count)*100)}%`}。</p><div class="morphology-dna"><span>体长 ${Math.round(a.shape[0]*100)}</span><span>体宽 ${Math.round(a.shape[1]*100)}</span><span>附肢 ${Math.round(a.shape[2]*100)}</span></div>${s.parent?`<small>分化自 ${escape(world.species.find(p=>p.id===s.parent).name)}</small>`:''}</div></article>`;}).join('');
 return `<div class="view-intro"><div><span class="eyebrow">FORM FOLLOWS SURVIVAL · 72 STRUCTURES</span><h2>生命，逐渐有了形状</h2><p>${possible?'性状决定有哪些器官，遗传参数决定怎样生长。组合样本从规则生成，不设固定的物种外形名单。':'实时模型取自各分群最常见性状组合中的真实代表个体，遗传差异改变体制与器官。'}</p></div></div><div class="morphology-toolbar"><div class="journal-tabs"><button data-morph="living" class="${possible?'':'active'}">世界标本 · ${living.length}</button><button data-morph="possible" class="${possible?'active':''}">组合实验台</button></div><span>三维标本 · 点击放大与旋转 · 外观 / 解剖</span></div>${possible?workshopView()+'<div class="section-heading"><h3>形态空间切片</h3><button class="button subtle" data-next-combinations>生成下一组 ↗</button></div>':''}<div class="specimen-grid">${cards||'<p class="empty-copy">等待复制者诞生，或切换到“组合实验台”探索结构。</p>'}</div><details class="morphology-key"><summary>查看 ${TRAITS.length} 项结构与形态的对应</summary><p>模型根据对称性生成主轴，再在独立连接位置长出器官。8 个形态参数随个体交叉、突变，改变体形、重复数量、器官尺度和色纹；长度、厚度、附肢负担也参与运动与维护成本。成熟体制的基础细胞结构收纳到内部，可在放大窗口中切换解剖观察。遗传基因改变比例与细节；模型用于解释遗传差异，未模拟真实发育过程。</p><div>${TRAITS.map(t=>`<span><b>${t.name}</b>${t.shape}</span>`).join('')}</div></details>`;
}
export function specimenDialog(world,key){
 const isSpecies=key.startsWith('species:'),isAncestor=key.startsWith('ancestor:'),isIndividual=key.startsWith('individual:'),species=isSpecies?world.species.find(s=>s.id===+key.slice(8)):null,node=isAncestor?world.lineages.find(n=>n.id===+key.slice(9)):null,a=isSpecies?species.specimen:isAncestor?node.snapshot:isIndividual?world.records[+key.slice(11)]:previewSpecimen(key),title=species?.name||(isIndividual?'个体 '+a.id:isAncestor?'分叉前的祖支 L'+node.id:key==='workshop'?'自由组合标本':key.startsWith('sample:')?'规则生成组合 '+(+key.slice(7)+1):TRAITS[TRAIT_INDEX[key.slice(6)]].name),record=isSpecies||isIndividual,modelAttributes=record?`data-individual="${a.id}"`:isAncestor?`data-ancestor="${node.id}"`:`data-preview="${key}"`;
 return `<div class="dialog-top"><div><span class="eyebrow">ANATOMICAL OBSERVATORY</span><h2>${escape(title)}</h2><p>${develop(a).label} · ${record?'固定个体 '+a.id:isAncestor?'T + '+node.split+' 的祖先观测快照':'形态设想 · 未加入模拟世界'}</p></div><button class="close-button" data-close aria-label="关闭标本观察">×</button></div><div class="anatomy-controls"><div><button data-anatomy="false" class="active">完整外观</button><button data-anatomy="true">解剖透视</button></div><div><button data-orbit="auto" class="active">自动转动</button><button data-orbit="in" aria-label="放大标本">＋</button><button data-orbit="out" aria-label="缩小标本">−</button><button data-orbit="reset">重置视角</button></div></div><div class="specimen-window large-model" ${modelAttributes} data-interactive="true" tabindex="0" aria-label="三维标本观察区域，拖动旋转，滚轮缩放"><span class="specimen-stage">拖动旋转 · 滚轮缩放</span><span class="specimen-scale">${record||isAncestor?'出生结构重建 · 等大展示':'示意结构，非真实物种解剖'}</span></div><div class="anatomy-caption"><span>${a.traits.length} 项遗传结构</span><p>${a.traits.map(id=>TRAITS[TRAIT_INDEX[id]].name).join(' · ')||'原始复制结构'}</p></div>`;
}

export class SpecimenRenderer{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x000000,0);this.renderer.setScissorTest(true);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight('#e0efe2','#34453b',1.2));
  const light=new THREE.DirectionalLight('#fff4db',2.3);light.position.set(-2,3,5);this.scene.add(light);
  const rim=new THREE.DirectionalLight('#9fcdd0',1.7);rim.position.set(3,1,-3);this.scene.add(rim);
  const fill=new THREE.DirectionalLight('#c1d8bb',.65);fill.position.set(-3,-2,2);this.scene.add(fill);
  this.camera=new THREE.PerspectiveCamera(34,1,.1,80);this.camera.position.set(0,0,5.2);this.models=new Map();this.width=0;this.height=0;this.resetOrbit();this.anatomy=false;
 }
 resetOrbit(){this.orbit={yaw:-.3,pitch:.08,zoom:1,auto:true};}
 draw(world,time){
  const w=innerWidth,h=innerHeight;if(w!==this.width||h!==this.height){this.renderer.setSize(w,h,false);this.width=w;this.height=h;}this.renderer.setScissor(0,0,w,h);this.renderer.clear();
  const seen=new Set(),scope=document.querySelector('dialog[open]')||document,entries=[];
  for(const target of scope.querySelectorAll('[data-model],[data-preview],[data-ancestor],[data-individual]')){
   const rect=target.getBoundingClientRect();if(rect.bottom<0||rect.top>h||rect.right<0||rect.left>w||!rect.width)continue;
   const key=target.dataset.preview||(target.dataset.individual?'individual:'+target.dataset.individual:target.dataset.ancestor?'ancestor:'+target.dataset.ancestor:'species:'+target.dataset.model);let a;
   if(target.dataset.preview)a=previewSpecimen(key);
   else if(target.dataset.individual)a=world.records[+target.dataset.individual];
   else if(target.dataset.ancestor)a=world.lineages.find(n=>n.id===+target.dataset.ancestor).snapshot;
   else a=world.species.find(s=>s.id===+target.dataset.model)?.specimen;
   if(!a)continue;
   const interactive=!!target.dataset.interactive,fixed=target.dataset.fixedView==='true',relative=target.dataset.size==='relative',anatomy=interactive&&this.anatomy,cacheKey=key+':'+anatomy+':'+fixed+':'+relative+':'+interactive;
   seen.add(cacheKey);const signature=a.traits.join(',')+':'+[...a.genes,...a.shape].join(',');let model=this.models.get(cacheKey);
   if(!model||model.signature!==signature){if(model)disposeOrganism(model.object);model={signature,object:buildOrganism(a,'#98b99e',{anatomy})};this.models.set(cacheKey,model);}
   const o=model.object;o.rotation.x=(fixed?.25:o.userData.pose)+(interactive&&!fixed?this.orbit.pitch:.08);o.rotation.y=interactive&&!fixed?this.orbit.yaw+(this.orbit.auto?Math.sin(time*.00018)*.35:0):-.3;o.rotation.z=0;
   o.scale.setScalar(relative?1:o.userData.normalization.scale);
   // Archive and comparison specimens have no simulated behaviour. Only living gallery specimens animate with world time.
   const live=target.dataset.model?world.agents.find(x=>x.id===a.id):null,motionTime=target.dataset.preview&&!fixed?time*.001:live&&!live.sleeping&&!fixed?world.tick*.04:0;
   for(const m of o.userData.motions)m.m.rotation[m.axis]=m.base+(motionTime?Math.sin(motionTime*m.speed+m.phase)*m.amp:0);
   const factor=relative?1/o.userData.normalization.scale:1,fit=o.userData.fit,rotation=new THREE.Matrix4().makeRotationFromEuler(o.rotation).elements;
   const rw=(Math.abs(rotation[0])*fit.width+Math.abs(rotation[4])*fit.height+Math.abs(rotation[8])*fit.depth)*factor,rh=(Math.abs(rotation[1])*fit.width+Math.abs(rotation[5])*fit.height+Math.abs(rotation[9])*fit.depth)*factor,rd=(Math.abs(rotation[2])*fit.width+Math.abs(rotation[6])*fit.height+Math.abs(rotation[10])*fit.depth)*factor;
   const distance=Math.max(rw/(rect.width/rect.height),rh)/(2*Math.tan(17*Math.PI/180)*.78)+rd*.5;
   entries.push({target,rect,o,interactive,fixed,relative,distance});
  }
  const sharedDistance=Math.max(2.5,...entries.filter(e=>e.relative).map(e=>e.distance));
  for(const {target,rect,o,interactive,fixed,relative,distance} of entries){
   focusOrganism(o,target.dataset.region||null);
   const left=Math.max(0,rect.left),right=Math.min(w,rect.right),bottom=Math.max(0,h-rect.bottom),top=Math.min(h,h-rect.top);
   this.renderer.setScissor(left,bottom,right-left,top-bottom);this.renderer.setViewport(rect.left,h-rect.bottom,rect.width,rect.height);this.camera.aspect=rect.width/rect.height;this.camera.position.z=(relative?sharedDistance:Math.max(2.5,distance))/(interactive&&!fixed?this.orbit.zoom:1);this.camera.updateProjectionMatrix();this.scene.add(o);this.renderer.render(this.scene,this.camera);this.scene.remove(o);
  }
  for(const [key,model] of this.models)if(!seen.has(key)){disposeOrganism(model.object);this.models.delete(key);}
 }
}
