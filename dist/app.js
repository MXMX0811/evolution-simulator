import {ecosystemView} from './ecology-view.js';
import {World,clamp} from './engine.js';
import {GENES,TRAITS,STAGES,DEFAULTS,SOURCES} from './biology.js';
import {WorldRenderer,drawHistory} from './renderer.js';
import {escape,direction,inspector,traitView,lineageView,journalView,guideView} from './views.js';
import {SpecimenRenderer,morphologyView,specimenDialog,nextCombinations,useCombination,setShape,setStructure} from './morphology.js';
import {observationView,snapshotView} from './observation-view.js';
import {diagnosticsView} from './diagnostics-view.js';
const $=id=>document.getElementById(id);
let world=new World(),running=true,speed=1,selected=null,view='world',selectedTrait='pigment',traitLane='all',traitQuery='',morphMode='living',pathMode='path',selectedLineage=null,journalFilter='all',journalLimit=80,lastRendered=-1,toastTimer;
let graphDragging=false;
let individualId=null,comparisonId=null,bodyRegion='body',bodySize='equal',comparisonWorker=null;
const checkpoint={snapshot:null,results:null,change:'cooling',busy:false,completed:0,error:null};
const graphState={traits:{zoom:1,x:0,y:0},lineage:{zoom:1,x:0,y:0}};
const renderer=new WorldRenderer($('world-canvas'));
const specimens=new SpecimenRenderer($('specimen-canvas'));
const bounds={temperature:[-15,60],light:[0,2],resources:[.1,3],sea:[.25,.85],mutation:[0,.3],volatility:[0,1]};
const parameterInfo=[
 ['temperature','基础温度',-15,60,1,'°C','周期波动与事件会叠加在此值上'],
 ['light','光照强度',0,2,.05,'×','光合收益与同格拥挤度共同决定'],
 ['resources','地质补给',.1,3,.05,'×','补充溶解养分与热泉化学能源'],
 ['sea','海平面',.25,.85,.01,'','低于此高度的地形处于水下'],
 ['mutation','基因突变率',0,.3,.01,'%','每个连续基因在出生时发生突变的概率'],
 ['volatility','自然环境波动',0,1,.05,'%','决定周期温度幅度与自然事件发生率'],
];
function formatted(key,value){if(['mutation','volatility'].includes(key))return Math.round(value*100)+'%';return value.toFixed(key==='temperature'?0:2)+(parameterInfo.find(p=>p[0]===key)?.[5]||'');}
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
function setRunning(value){
 if(value&&world.saturated){notify('已达到计算上限。可以导出世界，或施加陨石干预释放空间。');value=false;}
 if(value&&world.originDone&&!world.agents.length){notify('这个世界的生命已经灭绝。创建新世界可开始另一条历史。');value=false;}
 running=value;$('pause-button').textContent=running?'Ⅱ 暂停':'▷ 继续';$('pause-button').setAttribute('aria-label',running?'暂停模拟':'继续模拟');$('live-label').textContent=world.originDone&&!world.agents.length?'生命已终结':running?'自主演化中':'观测已暂停';
}
function selectSpecies(id){if(selected!==id){individualId=null;comparisonId=null;renderer.tracked=null;}selected=id;selectedLineage=world.species.find(s=>s.id===id)?.lineage??null;renderer.selected=id;update(true);}
function observeIndividual(id,open=true){
 const record=world.records[id];if(!record)return;
 individualId=id;renderer.tracked=id;selected=world.agents.find(a=>a.id===id)?.species??record.birthSpecies;
 selectedLineage=world.species.find(s=>s.id===selected).lineage;
 comparisonId=record.parents[0]??world.agents.filter(a=>a.id!==id&&a.origin===record.origin).sort((a,b)=>a.shape.reduce((n,v,i)=>n+(v-record.shape[i])**2,0)-b.shape.reduce((n,v,i)=>n+(v-record.shape[i])**2,0))[0]?.id??null;
 bodyRegion='body';if(open)changeView('observation');else update(true);
}
function changeView(next){view=next;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view+'-view'));update(true);}
function setEnvironment(patch){
 for(const [key,value] of Object.entries(patch))if(!(key in bounds)||!Number.isFinite(value)||value<bounds[key][0]||value>bounds[key][1])throw new Error(`参数 ${key} 超出允许范围`);
 const changed=Object.entries(patch).filter(([k,v])=>world.config[k]!==v);if(!changed.length)return;
 world.setEnvironment(patch);renderer.lastTerrain=-1;update(true);
}
function advance(steps){setRunning(false);world.step(steps);world.census();update(true);return world.summary();}
$('pause-button').onclick=()=>setRunning(!running);
$('step-button').onclick=()=>advance(24);
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{speed=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});});
document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{renderer.layer=b.dataset.layer;document.querySelectorAll('[data-layer]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});$('map-hint').textContent=renderer.layer==='heat'?'蓝色较冷，橙色较热':renderer.layer==='resources'?'颜色越亮，溶解养分越丰富':renderer.layer==='food'?'绿色表示浮游物，暖色表示残骸':renderer.layer==='chemical'?'颜色越亮，可利用的化学能源越丰富':'点击生命，追踪它的谱系';renderer.draw(world);});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{world.trigger(b.dataset.event);notify(world.events[0].title);update(true);});
$('world-canvas').onclick=e=>{const agent=renderer.hit(e.clientX,e.clientY,world);if(agent)observeIndividual(agent.id,false);else{individualId=null;renderer.tracked=null;selectSpecies(null);}};
$('world-canvas').onkeydown=e=>{if(e.key==='Escape')selectSpecies(null);};
$('clear-selection').onclick=()=>selectSpecies(null);
$('species-list').onclick=e=>{const b=e.target.closest('[data-species]');if(b)selectSpecies(+b.dataset.species);};
$('tree-content').onclick=e=>{const b=e.target.closest('[data-trait]'),lane=e.target.closest('[data-lane]'),mode=e.target.closest('[data-path-mode]');if(b){selectedTrait=b.dataset.trait;traitQuery='';traitLane='all';renderView();graphAction('focus','traits');}if(lane){traitLane=lane.dataset.lane;renderView();graphAction('focus','traits');}if(mode){pathMode=mode.dataset.pathMode;renderView();graphAction('focus','traits');}};
$('tree-content').oninput=e=>{if(e.target.id==='trait-search'){const caret=e.target.selectionStart;traitQuery=e.target.value;renderView();$('trait-search').focus();$('trait-search').setSelectionRange(caret,caret);}};
$('morphology-content').oninput=e=>{if(e.target.matches('[data-shape]')){setShape(+e.target.dataset.shape,+e.target.value/100);$('shape-value-'+e.target.dataset.shape).textContent=e.target.value;}};
$('morphology-content').onclick=e=>{if(e.target.closest('[data-next-combinations]')){nextCombinations();renderView();}const sample=e.target.closest('[data-use-sample]'),structure=e.target.closest('[data-structure]');if(sample){useCombination(+sample.dataset.useSample);renderView();$('morphology-content').querySelector('.combination-lab').scrollIntoView({behavior:'smooth'});}if(structure){setStructure(structure.dataset.structure);renderView();}const b=e.target.closest('[data-track]'),m=e.target.closest('[data-morph]'),t=e.target.closest('[data-explore]');if(b)selectSpecies(+b.dataset.track);if(m){morphMode=m.dataset.morph;renderView();}if(t){selectedTrait=t.dataset.explore;traitLane='all';traitQuery='';changeView('tree');}};
$('journal-content').onclick=e=>{if(e.target.closest('[data-more-events]')){journalLimit+=80;renderView();}const filter=e.target.closest('[data-filter]'),follow=e.target.closest('[data-follow]');if(filter){journalFilter=filter.dataset.filter;journalLimit=80;renderView();}if(follow){selectSpecies(+follow.dataset.follow);changeView('lineage');}};
$('observation-content').onclick=e=>{
 const region=e.target.closest('button[data-region]'),size=e.target.closest('[data-size]'),explore=e.target.closest('[data-explore]');
 if(region){bodyRegion=region.dataset.region;renderView();}if(size?.tagName==='BUTTON'){bodySize=size.dataset.size;renderView();}
 if(explore){selectedTrait=explore.dataset.explore;traitLane='all';traitQuery='';changeView('tree');}
};
$('observation-content').onsubmit=e=>{
 if(e.target.id!=='find-individual-form')return;e.preventDefault();const id=+$('individual-search').value;
 if(!world.records[id]){notify('这个世界尚无该编号的生命档案。');return;}observeIndividual(id);
};
document.addEventListener('click',e=>{
 const observe=e.target.closest('[data-observe]'),locate=e.target.closest('[data-locate]');
 if(observe)observeIndividual(+observe.dataset.observe);
 if(locate)changeView(world.agents.some(a=>a.id===+locate.dataset.locate)?'world':'journal');
});
$('ecosystem-content').onclick=e=>{const b=e.target.closest('[data-eco-species]');if(b)selectSpecies(b.dataset.ecoSpecies==='all'?null:+b.dataset.ecoSpecies);};
$('lineage-content').onclick=e=>{const b=e.target.closest('[data-follow]'),node=e.target.closest('[data-lineage-node]');if(b)selectSpecies(+b.dataset.follow);if(node){selectedLineage=+node.dataset.lineageNode;renderView();graphAction('focus','lineage');}};
document.addEventListener('click',e=>{if(e.target.closest('[data-open-lineage]'))changeView('lineage');});
function graphPage(kind,container,html){
 const state=graphState[kind],old=container.querySelector('.graph-viewport');if(old){state.x=old.scrollLeft;state.y=old.scrollTop;}
 const focused=document.activeElement?.dataset?.nodeId;container.innerHTML=html;const viewport=container.querySelector('.graph-viewport');if(!viewport)return;viewport.scrollLeft=state.x;viewport.scrollTop=state.y;
 let drag=null;viewport.onpointerdown=e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button'))return;graphDragging=true;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');};
 viewport.onpointermove=e=>{if(!drag)return;viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;};viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;graphDragging=false;viewport.classList.remove('dragging');};
 viewport.onscroll=()=>{state.x=viewport.scrollLeft;state.y=viewport.scrollTop;};if(focused)viewport.querySelector(`[data-node-id="${focused}"]`)?.focus({preventScroll:true});
}
function graphAction(action,kind){
 const state=graphState[kind],viewport=document.querySelector(`[data-graph="${kind}"]`);if(!viewport)return;
 const content=viewport.querySelector('.graph-content'),space=viewport.querySelector('.graph-space'),old=state.zoom;
 let x=(viewport.scrollLeft+viewport.clientWidth/2)/old,y=(viewport.scrollTop+viewport.clientHeight/2)/old,zoom=old;
 if(action==='in'||action==='out')zoom=clamp(old*(action==='in'?1.2:1/1.2),.01,1.6);
 else{
  const selector=action==='focus'?'.graph-node.selected':action==='path'?'.graph-node.path-node':'.graph-node',nodes=[...content.querySelectorAll(selector)];if(!nodes.length)return;
  const left=Math.min(...nodes.map(n=>+n.dataset.x-+n.dataset.w/2)),right=Math.max(...nodes.map(n=>+n.dataset.x+ +n.dataset.w/2)),top=Math.min(...nodes.map(n=>+n.dataset.y-+n.dataset.h/2)),bottom=Math.max(...nodes.map(n=>+n.dataset.y+ +n.dataset.h/2));x=(left+right)/2;y=(top+bottom)/2;
  if(action==='focus')zoom=Math.max(old,.85);
  if(action!=='focus')zoom=clamp(Math.min((viewport.clientWidth-56)/(right-left),(viewport.clientHeight-56)/(bottom-top)),.01,1.2);
 }
 state.zoom=zoom;content.style.transform=`scale(${zoom})`;space.style.width=+content.dataset.width*zoom+'px';space.style.height=+content.dataset.height*zoom+'px';viewport.scrollLeft=x*zoom-viewport.clientWidth/2;viewport.scrollTop=y*zoom-viewport.clientHeight/2;state.x=viewport.scrollLeft;state.y=viewport.scrollTop;document.querySelector(`[data-graph-zoom="${kind}"]`).textContent=Math.round(zoom*100)+'%';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-graph-action]');if(b)graphAction(b.dataset.graphAction,b.dataset.graphTarget);});
function renderArchive(container,html){
 const panelKey=d=>d.dataset.panel||d.querySelector('summary').textContent;
 const open=new Set([...container.querySelectorAll('details[open]')].map(panelKey));
 const active=container.contains(document.activeElement)?document.activeElement:null;
 const attribute=['id','data-observe','data-region','data-size','data-filter'].find(name=>active?.hasAttribute(name));
 const value=attribute?active.getAttribute(attribute):null;
 const inputValue=active?.tagName==='INPUT'?active.value:null;
 const diagnosticScroll=container.querySelector('.diagnostics-table-scroll')?.scrollLeft||0;
 container.innerHTML=html;
 const diagnosticTable=container.querySelector('.diagnostics-table-scroll');if(diagnosticTable)diagnosticTable.scrollLeft=diagnosticScroll;
 container.querySelectorAll('details').forEach(d=>{d.open=open.has(panelKey(d));});
 if(attribute){const next=container.querySelector(`[${attribute}="${CSS.escape(value)}"]`);if(next&&inputValue!==null)next.value=inputValue;next?.focus({preventScroll:true});}
}
function renderView(){
 if(view==='lineage')graphPage('lineage',$('lineage-content'),lineageView(world,selected,selectedLineage,graphState.lineage.zoom));
 if(view==='tree'){const focused=document.activeElement?.id==='trait-search',caret=focused?document.activeElement.selectionStart:0;graphPage('traits',$('tree-content'),traitView(world,selected,selectedTrait,traitLane,traitQuery,pathMode,graphState.traits.zoom));if(focused){$('trait-search').focus({preventScroll:true});$('trait-search').setSelectionRange(caret,caret);}}
 if(view==='ecosystem'){const container=$('ecosystem-content'),open=[...container.querySelectorAll('details')].map(d=>d.open),old=container.querySelector('.foodweb-scroll'),x=old?.scrollLeft||0,y=old?.scrollTop||0,focus=container.contains(document.activeElement)?document.activeElement?.dataset?.ecoSpecies:null;container.innerHTML=ecosystemView(world,selected);container.querySelectorAll('details').forEach((d,i)=>d.open=!!open[i]);const scroll=container.querySelector('.foodweb-scroll');scroll.scrollLeft=x;scroll.scrollTop=y;if(focus)container.querySelector(`[data-eco-species="${focus}"]`)?.focus({preventScroll:true});}
 if(view==='journal')renderArchive($('journal-content'),snapshotView(checkpoint)+diagnosticsView(world)+journalView(world,journalFilter,journalLimit));
 if(view==='observation')renderArchive($('observation-content'),observationView(world,individualId,comparisonId,bodyRegion,bodySize));
 if(view==='morphology'){const old=$('morphology-content').querySelector('.lab-structures'),scroll=old?.scrollTop||0;$('morphology-content').innerHTML=morphologyView(world,selected,morphMode);const lab=$('morphology-content').querySelector('.lab-structures');if(lab)lab.scrollTop=scroll;}
}
function update(force=false){
 if(!force&&world.tick===lastRendered)return;lastRendered=world.tick;
 if(individualId){const a=world.agents.find(a=>a.id===individualId);if(a&&a.species!==selected){selected=a.species;selectedLineage=world.species.find(s=>s.id===selected).lineage;}}
 $('seed-label').textContent=world.config.seed;$('time-value').textContent=String(world.tick).padStart(6,'0');$('population-value').textContent=world.agents.length.toLocaleString();$('species-value').textContent=new Set(world.agents.map(a=>a.species)).size;$('diversity-value').textContent=world.totalMutations.toLocaleString();$('temp-value').innerHTML=world.environment.temperature.toFixed(1)+'<small> °C</small>';$('light-value').innerHTML=Math.round(world.environment.light*100)+'<small> %</small>';$('oxygen-value').innerHTML=(world.oxygen*100).toFixed(1)+'<small> %</small>';$('generation-value').innerHTML=Math.max(0,...world.species.map(s=>s.generation))+'<small> 代</small>';
 $('origin-caption').hidden=world.originDone;$('origin-progress').style.width=world.originProgress*100+'%';$('era-label').textContent=world.originDone?'生态演替':'生命起源';renderer.selected=selected;
 const liveCounts=new Map();for(const a of world.agents)liveCounts.set(a.species,(liveCounts.get(a.species)||0)+1);
 const observedSpecies=world.species.map(s=>({...s,count:liveCounts.get(s.id)||0})),living=observedSpecies.filter(s=>s.count),chosen=observedSpecies.find(s=>s.id===selected);
 $('species-list').innerHTML=(chosen&&!chosen.count?[chosen,...living]:living).map(s=>`<button class="species-row ${selected===s.id?'selected':''}" data-species="${s.id}" aria-pressed="${selected===s.id}"><i class="dot" style="color:${s.color};background:${s.color}"></i><span class="species-name">${escape(s.name)}<small>${s.count?direction(s):'已灭绝'} · 第 ${s.generation} 代</small></span><span class="species-count">${s.count}<small title="相对上次 24 时步采样的数量变化">${s.trend>=0?'+':''}${s.trend}</small></span><div class="species-bar"><i style="width:${s.count/Math.max(1,world.agents.length)*100}%;background:${s.color}"></i></div></button>`).join('')||`<p class="empty-copy">${world.originDone?'生命已经终结。<br>灭绝也是演化史的一部分。':'第一个生命还未出现。'}</p>`;
 const detailsOpen=$('inspector').querySelector('details')?.open;$('inspector').innerHTML=inspector(world,selected,individualId);if(detailsOpen===false&&$('inspector').querySelector('details'))$('inspector').querySelector('details').open=false;
 const e=world.events[0];$('latest-event').innerHTML=`<h3>${escape(e.title)}</h3><p>${escape(e.detail)}</p><span class="event-time">T + ${e.tick}</span>`;
 $('active-effects').innerHTML=world.effects.map(e=>`<span class="effect-badge">${e.title} <b>${e.until-world.tick}</b></span>`).join('');
 $('history-start').textContent=world.history[0]?.tick?'T + '+world.history[0].tick:'起源';$('history-range').textContent=world.saturated?'已到达计算上限':`最近 ${world.tick-(world.history[0]?.tick||0)} 时步`;
 $('history-legend').innerHTML=world.species.filter(s=>s.count>0).slice(0,7).map(s=>`<span><i class="legend-dot" style="background:${s.color}"></i>${escape(s.name)}</span>`).join('');
 if(view==='world')drawHistory($('history-canvas'),world,selected);if(!graphDragging&&(view!=='morphology'||morphMode==='living'||force))renderView();
 if((world.saturated||world.originDone&&!world.agents.length)&&running)setRunning(false);
}
function openDialog(id,html){const dialog=$(id);dialog.innerHTML=html;dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>dialog.replaceChildren(),{once:true});dialog.showModal();return dialog;}
$('guide-button').onclick=()=>openDialog('guide-dialog',guideView());
document.addEventListener('click',e=>{const button=e.target.closest('[data-inspect]');if(!button)return;let key=button.dataset.inspect;if(key.startsWith('species:'))key='individual:'+world.species.find(s=>s.id===+key.slice(8)).specimen.id;specimens.resetOrbit();specimens.anatomy=false;const dialog=openDialog('specimen-dialog',specimenDialog(world,key));dialog.appendChild($('specimen-canvas'));dialog.addEventListener('close',()=>document.body.appendChild(specimens.canvas),{once:true});const window=dialog.querySelector('.large-model');let drag=null;
 window.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};window.setPointerCapture(e.pointerId);specimens.orbit.auto=false;dialog.querySelector('[data-orbit="auto"]').classList.remove('active');};
 window.onpointermove=e=>{if(!drag)return;specimens.orbit.yaw+=(e.clientX-drag.x)*.009;specimens.orbit.pitch=clamp(specimens.orbit.pitch+(e.clientY-drag.y)*.009,-1.4,1.4);drag={x:e.clientX,y:e.clientY};};window.onpointerup=()=>drag=null;window.onpointercancel=()=>drag=null;
 window.addEventListener('wheel',e=>{e.preventDefault();specimens.orbit.zoom=clamp(specimens.orbit.zoom-e.deltaY*.001,.65,1.9);},{passive:false});
 window.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();specimens.orbit.auto=false;dialog.querySelector('[data-orbit="auto"]').classList.remove('active');if(e.key==='ArrowLeft')specimens.orbit.yaw-=.15;if(e.key==='ArrowRight')specimens.orbit.yaw+=.15;if(e.key==='ArrowUp')specimens.orbit.pitch-=.15;if(e.key==='ArrowDown')specimens.orbit.pitch+=.15;specimens.orbit.pitch=clamp(specimens.orbit.pitch,-1.4,1.4);}};
 dialog.querySelectorAll('[data-anatomy]').forEach(b=>b.onclick=()=>{specimens.anatomy=b.dataset.anatomy==='true';dialog.querySelectorAll('[data-anatomy]').forEach(x=>x.classList.toggle('active',x===b));});
 dialog.querySelectorAll('[data-orbit]').forEach(b=>b.onclick=()=>{const action=b.dataset.orbit;if(action==='auto')specimens.orbit.auto=!specimens.orbit.auto;if(action==='in')specimens.orbit.zoom=clamp(specimens.orbit.zoom+.18,.65,1.9);if(action==='out')specimens.orbit.zoom=clamp(specimens.orbit.zoom-.18,.65,1.9);if(action==='reset')specimens.resetOrbit();dialog.querySelector('[data-orbit="auto"]').classList.toggle('active',specimens.orbit.auto);});
});

function parameterFields(config){return parameterInfo.map(([key,label,min,max,step,unit,help])=>`<div class="parameter"><label for="param-${key}">${label}<output for="param-${key}">${formatted(key,config[key])}</output></label><input type="range" id="param-${key}" name="${key}" min="${min}" max="${max}" step="${step}" value="${config[key]}"><small>${help}</small></div>`).join('');}
function bindOutputs(dialog){dialog.querySelectorAll('input[type="range"][name]').forEach(input=>input.oninput=()=>{input.closest('.parameter').querySelector('output').textContent=formatted(input.name,+input.value);});}
$('settings-button').onclick=()=>{
 const dialog=openDialog('settings-dialog',`<div class="dialog-top"><h2>改变世界的条件</h2><button data-close class="close-button" aria-label="关闭环境设置">×</button></div><p>这些条件会作用于每一个谱系。正在发生的环境事件继续叠加。</p><form id="settings-form">${parameterFields(world.config)}<div class="dialog-actions"><button type="button" data-close class="button subtle">取消</button><button class="button primary" type="submit">应用环境</button></div></form>`);bindOutputs(dialog);
 $('settings-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);setEnvironment(Object.fromEntries(parameterInfo.map(([k])=>[k,+data.get(k)])));dialog.close();notify('环境已改变，新的选择压力开始生效。');};
};
$('new-button').onclick=()=>{
 const defaults={...DEFAULTS,seed:world.config.seed};
 const dialog=openDialog('new-dialog',`<div class="dialog-top"><h2>另一种生命的可能</h2><button data-close class="close-button" aria-label="关闭新世界">×</button></div><p>相同种子与设置可以重现起源。每个初始谱系具有独立繁殖体系，未来路线由遗传与生存结果决定。</p><form id="new-form"><div class="form-field"><label for="world-seed">世界种子</label><div class="input-row"><input id="world-seed" name="seed" value="${escape(defaults.seed)}" maxlength="48" required><button class="button subtle" type="button" id="random-seed">随机</button></div></div><div class="form-field"><label for="founders">初始谱系数量</label><select id="founders" name="founders">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n===4?'selected':''}>${n} 个独立谱系</option>`).join('')}</select></div><div class="form-field"><label for="reproduction-mode">起始繁殖方式</label><select id="reproduction-mode" name="reproductionMode"><option value="facultative">兼性 · 有配偶交叉，也能单亲复制</option><option value="sexual">有性 · 需要兼容配偶</option><option value="asexual">无性 · 单亲复制</option></select></div><label class="check-row"><input type="checkbox" name="origin" checked>从生命起源开始</label><label class="check-row"><input type="checkbox" name="fiction" checked>允许科幻性状参与演化</label><details class="setup-details"><summary>初始环境</summary>${parameterFields(defaults)}</details><details class="setup-details" id="initial-genes"><summary>初始基因 · 可自行调整</summary><p>只设置起点，不指定后续进化方向。所有基因采用 0–100 的相对值。</p><button id="gene-preview-button" class="button subtle" type="button">生成并调整各谱系基因</button><div id="gene-editor"></div></details><div class="new-warning">创建后会结束当前世界；需要保留时，请先导出存档。</div><div class="dialog-actions"><button class="button subtle" type="button" data-close>取消</button><button class="button primary" type="submit">让生命诞生 ↗</button></div></form>`);
 bindOutputs(dialog);let initialGenes=null;
 const clearGenes=()=>{initialGenes=null;$('gene-editor').innerHTML='';};
 $('random-seed').onclick=()=>{$('world-seed').value='ORIGIN-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();clearGenes();};
 $('world-seed').oninput=clearGenes;$('founders').onchange=clearGenes;
 $('gene-preview-button').onclick=()=>{const sample=new World({seed:$('world-seed').value,founders:+$('founders').value,origin:false});initialGenes=sample.species.map(s=>[...s.founder]);$('gene-editor').innerHTML=sample.species.map((s,n)=>`<details class="gene-editor-species"><summary style="color:${s.color}">${s.name}</summary><div class="gene-editor-grid">${GENES.map((g,i)=>`<label>${g.name}<input aria-label="${s.name} ${g.name}" type="number" min="0" max="100" step="1" value="${Math.round(s.founder[i]*100)}" data-gene="${i}" data-founder="${n}"></label>`).join('')}</div></details>`).join('');$('gene-editor').querySelectorAll('input').forEach(input=>input.oninput=()=>{initialGenes[+input.dataset.founder][+input.dataset.gene]=clamp(+input.value/100);});};
 $('new-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);const config={seed:String(data.get('seed')).trim(),founders:+data.get('founders'),reproductionMode:String(data.get('reproductionMode')),origin:data.has('origin'),fiction:data.has('fiction'),...Object.fromEntries(parameterInfo.map(([k])=>[k,+data.get(k)]))};if(!config.seed)return;if(initialGenes)config.initialGenes=initialGenes;world=new World(config);clearObservation();selected=null;selectedLineage=null;renderer.lastTerrain=-1;lastRendered=-1;dialog.onclose=null;dialog.close();setRunning(true);changeView('world');notify('一个新的世界开始了。');};
};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearObservation(){
 individualId=null;comparisonId=null;renderer.tracked=null;comparisonWorker?.terminate();comparisonWorker=null;
 Object.assign(checkpoint,{snapshot:null,results:null,busy:false,completed:0,error:null});
}
document.addEventListener('change',e=>{if(e.target.id==='comparison-change')checkpoint.change=e.target.value;});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-checkpoint]')){
  comparisonWorker?.terminate();comparisonWorker=null;const text=world.serialize();
  Object.assign(checkpoint,{snapshot:{text,tick:world.tick,seed:world.config.seed,population:world.agents.length,bytes:new Blob([text]).size},results:null,busy:false,completed:0,error:null});
  renderView();notify('世界快照已保存在本次会话中；可继续观察或运行对照。');
 }
 if(e.target.closest('[data-cancel-comparison]')){comparisonWorker.terminate();comparisonWorker=null;checkpoint.busy=false;renderView();}
 if(e.target.closest('[data-compare]')&&checkpoint.snapshot&&!checkpoint.busy){
  checkpoint.busy=true;checkpoint.completed=0;checkpoint.results=null;checkpoint.error=null;
  comparisonWorker=new Worker(new URL('./comparison-worker.js',import.meta.url),{type:'module'});
  comparisonWorker.onmessage=({data})=>{
   if(data.type==='progress')checkpoint.completed=data.completed;
   else{checkpoint.busy=false;if(data.type==='complete')checkpoint.results=data.results;else checkpoint.error=data.message;comparisonWorker.terminate();comparisonWorker=null;}
   if(view==='journal')renderView();
  };
  comparisonWorker.onerror=()=>{checkpoint.busy=false;checkpoint.error='对照计算未能完成，请重新保存快照后尝试。';comparisonWorker.terminate();comparisonWorker=null;if(view==='journal')renderView();};
  comparisonWorker.postMessage({snapshot:checkpoint.snapshot.text,change:checkpoint.change});renderView();
 }
 if(e.target.closest('[data-export-comparison]'))download(`源海-v6-配对对照-T${checkpoint.snapshot.tick}.json`,JSON.stringify({version:6,snapshot:JSON.parse(checkpoint.snapshot.text),results:checkpoint.results,interpretation:'三次配对重复，生物随机状态在重复间改变；不是置信区间或普遍因果结论。'},null,2),'application/json');
});
$('save-button').onclick=()=>{download(`源海-v6-T${world.tick}.json`,world.serialize(),'application/json');notify('完整世界与生命档案已导出，可从同一时步继续演化。');};
$('load-button').onclick=()=>$('load-input').click();
$('load-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>128000000)throw new Error('存档不能大于 128 MB');const restored=World.restore(await file.text());world=restored;clearObservation();selected=null;selectedLineage=null;renderer.lastTerrain=-1;lastRendered=-1;setRunning(false);changeView('world');notify('存档已载入，点击继续即可恢复演化。');}catch(error){notify('读取失败：'+error.message);}e.target.value='';};
$('report-button').onclick=()=>{
 world.census();const text=`# 源海 · 演化实验报告\n\n世界种子：${world.config.seed}\n观测时步：${world.tick}\n模式：${world.config.fiction?'现实与科幻':'现实性状'}\n\n## 环境与总体结果\n\n${parameterInfo.map(([k,label])=>`- ${label}：${formatted(k,world.config[k])}`).join('\n')}\n- 当前实际温度：${world.environment.temperature.toFixed(1)}°C\n- 氧气丰度：${(world.oxygen*100).toFixed(1)}%\n- 存活个体：${world.agents.length}\n- 累计出生：${world.totalBirths}\n- 累计死亡：${world.totalDeaths}\n- 双亲交叉：${world.totalCrossovers}\n- 遗传变异：${world.totalMutations}\n${world.saturated?'\n注意：已达到计算容量，结果不能解释为生态平衡。\n':''}\n## 谱系\n\n${world.species.map(s=>`### ${s.name}\n\n- 当前谱系节点：L${s.lineage}\n- 祖先：${s.parent?'谱系 '+s.parent:'独立起源'}\n- 存活：${s.count}；最高世代：${s.generation}\n- 出生：${s.births}；死亡：${s.deaths}\n- 当前性状：${TRAITS.filter((t,i)=>s.traitCounts[i]>0).map(t=>t.name).join('、')||'无'}\n\n| 基因 | 初始 | 当前均值 | 变化 |\n|---|---:|---:|---:|\n${GENES.map((g,i)=>`| ${g.name} | ${(s.founder[i]*100).toFixed(1)} | ${(s.mean[i]*100).toFixed(1)} | ${((s.mean[i]-s.founder[i])*100).toFixed(1)} |`).join('\n')}`).join('\n\n')}\n\n## 最近事件\n\n${world.events.map(e=>`- T + ${e.tick}：${e.title}。${e.detail}`).join('\n')}\n\n## 解释边界\n\n这是有限的基因和性状空间中的人工生命实验。生命起源、复杂结构及生殖隔离采用抽象规则，时步不对应真实地质年代。种群趋势是该模型的结果，不能直接推断现实生物。死亡谱系的基因均值是最后一次非空采样值。\n\n## 来源\n\n${SOURCES.map(s=>`- [${s.title}](${s.url})：${s.note}`).join('\n')}\n`;
 download(`源海-实验报告-T${world.tick}.md`,text,'text/markdown;charset=utf-8');notify('实验报告已导出。');
};
document.addEventListener('keydown',e=>{if(e.target.matches('[data-eco-species]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}if(e.code==='Space'&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();setRunning(!running);}});
let last=performance.now(),acc=0,lastUpdate=0;
function frame(now){acc+=Math.min(now-last,150);last=now;if(running){let count=0;while(acc>80&&count<3){world.step(speed);acc-=80;count++;}}else acc=0;if(view==='world')renderer.draw(world);if(now-lastUpdate>400){update();lastUpdate=now;}specimens.draw(world,now);requestAnimationFrame(frame);}
update(true);requestAnimationFrame(frame);
// Page tools call the same world actions used by visible controls.
if(document.modelContext?.registerTool){
 const controller=new AbortController();const tools=[
  {name:'read_evolution_world',title:'读取演化世界',description:'读取当前沙盒的种群、环境、遗传变异和最近事件。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>world.summary()},
  {name:'advance_evolution_world',title:'推进演化实验',description:'暂停自动播放，并将当前世界向前模拟 1–1200 个时步。会改变种群与历史。',inputSchema:{type:'object',properties:{steps:{type:'integer',minimum:1,maximum:1200}},required:['steps'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!Number.isInteger(input.steps)||input.steps<1||input.steps>1200)throw new Error('steps 必须是 1–1200 的整数');return advance(input.steps);}},
  {name:'set_evolution_environment',title:'设置演化环境',description:'立即设置当前世界的环境参数并记录干预。未提供的参数保持当前数值。',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(bounds).map(([key,[min,max]])=>[key,{type:'number',minimum:min,maximum:max}])),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('请输入环境参数对象');setEnvironment(input);return world.summary();}},
 ];
 for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:controller.signal})).catch(()=>notify('当前浏览器无法启用沙盒操作工具。'));}catch{notify('当前浏览器无法启用沙盒操作工具。');}
 window.addEventListener('pagehide',()=>controller.abort(),{once:true});
}
