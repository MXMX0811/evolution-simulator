import {diagnoseWorld} from './diagnostics.js';
import {TRAITS,TRAIT_INDEX} from './biology.js';
import {escape} from './views.js';

const cache=new WeakMap();
const number=(value,digits=0)=>value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
const colors={photons:'#9bcea1',redox:'#dbb57b',plankton:'#83c5b8',detritus:'#bba487',prey:'#e39c90',radiant:'#b9a5dc',mixed:'#8abacd',unobserved:'#718982',cell:'#99c7b6',colony:'#c9c086',axial:'#8bbace',radial:'#bfacd9'};
const archiveLink=(id,label)=>id===null?'':`<button class="diagnostics-link" data-observe="${id}">${label} #${id} ↗</button>`;
const bar=(label,count,total,color)=>`<div class="diagnostics-bar-row"><div><span><i style="--diagnostics-color:${color}"></i>${escape(label)}</span><strong>${number(count)} <small>· ${total?number(count/total*100,1):0}%</small></strong></div><div class="diagnostics-bar"><i style="--diagnostics-color:${color};width:${total?count/total*100:0}%"></i></div></div>`;
const combinationName=traits=>traits.length?traits.map(id=>TRAITS[TRAIT_INDEX[id]].name).join(' · '):'无已表达附加结构';

function render(report){
 const {diversity,morphology,feeding,traits}=report;
 const observedTraits=traits.rows.filter(row=>row.encodedBirthCarriers||row.mutationGains).sort((a,b)=>b.livingCarriers-a.livingCarriers||b.birthCarriers-a.birthCarriers||a.stage-b.stage);
 const combinations=morphology.combinations.rows;
 return `<section class="diagnostics-panel" aria-label="生态差异与传承观测">
 <header class="diagnostics-heading"><div><span class="eyebrow">DIVERSITY / INHERITANCE</span><h2>世界里，哪些差异正在留下</h2></div><span class="diagnostics-time">采样 T + ${number(report.tick)}</span></header>
 <p class="diagnostics-intro">分群、摄食方式与身体结构各自变化。沿着真实出生记录，观察新的结构是否留下后代。</p>
 <div class="diagnostics-metrics">
  <article><span>存续分群标签</span><strong>${number(diversity.labels.richness)}</strong><small>${number(diversity.population)} 个体 · ${number(diversity.origins.richness)} 个起源体系</small></article>
  <article><span>分群有效数量</span><strong>${number(diversity.labels.effective,2)}</strong><small>数量越均匀，越接近标签总数</small></article>
  <article><span>表达结构组合</span><strong>${number(combinations.length)}</strong><small>有效组合 ${number(morphology.combinations.effective,2)} · 不含连续比例差异</small></article>
  <article><span>细胞群落个体</span><strong>${number(morphology.colonies)}</strong><small>全世界共 ${number(morphology.cells)} 个细胞单元</small></article>
 </div>
 <div class="diagnostics-grid">
  <article class="diagnostics-card"><div class="diagnostics-card-heading"><h3>当前生命怎样获得能量</h3><span>实际摄入 / 个体</span></div>
   ${feeding.strategies.map(strategy=>bar(strategy.name,strategy.population,diversity.population,colors[strategy.id])).join('')||'<p class="diagnostics-empty">等待第一批生命留下摄食记录。</p>'}
   <p class="diagnostics-note">以每个现存个体的近期摄入判断。单一来源超过一半时标为主摄入，否则归为混合；暂无证据表示还没有记录。较早记录按 600 时步指数衰减。</p>
  </article>
  <article class="diagnostics-card"><div class="diagnostics-card-heading"><h3>身体结构的分布</h3><span>当前表达 / 个体</span></div>
   ${morphology.topologies.rows.map(row=>bar(row.name,row.count,diversity.population,colors[row.id])).join('')||'<p class="diagnostics-empty">世界中暂时没有存活个体。</p>'}
   <div class="diagnostics-combinations">${combinations.slice(0,4).map(row=>`<div><span>${escape(combinationName(row.traits))}</span><strong>${number(row.count)}</strong></div>`).join('')}</div>
   ${combinations.length>4?`<details class="diagnostics-details" data-panel="diagnostics-combinations"><summary>查看其余 ${number(combinations.length-4)} 种结构组合</summary><div class="diagnostics-combinations">${combinations.slice(4).map(row=>`<div><span>${escape(combinationName(row.traits))}</span><strong>${number(row.count)}</strong></div>`).join('')}</div></details>`:''}
   <p class="diagnostics-note">细胞单元代表抽象生物量，并非真实细胞数。相同结构仍可有不同的身体比例。这些分类与分群标签使用不同口径，均不直接等同于自然物种。</p>
  </article>
 </div>
 <details class="diagnostics-details diagnostics-inheritance" data-panel="diagnostics-inheritance"><summary><span>结构的出现与传承</span><small>${number(observedTraits.length)} 项结构 · ${number(traits.records)} 份出生档案</small></summary>
  <p class="diagnostics-note">“现存表达”和“现存蓝图”是采样时点的数量；其他列累计到此刻。初始个体计入出生表达，遗传来源可沿档案追溯。子代保留亲本蓝图并表达时计一次“表达传承”，双亲共同携带不会重复计数。获得和丢失按出生变更计数；“出生时潜伏”统计蓝图存在但因前置结构缺失而未表达的子代，连续几代都潜伏会逐代计数，不表示每代新发生一次失活。</p>
  ${observedTraits.length?`<div class="diagnostics-table-scroll"><table class="diagnostics-table"><caption>结构表达、蓝图与真实出生记录</caption><thead><tr><th scope="col">结构</th><th scope="col">出生表达</th><th scope="col">现存表达</th><th scope="col">成为亲本</th><th scope="col">表达传承</th><th scope="col">现存蓝图</th><th scope="col">突变获得</th><th scope="col">分离丢失</th><th scope="col">突变丢失</th><th scope="col">出生时潜伏</th><th scope="col">生命档案</th></tr></thead><tbody>${observedTraits.map(row=>`<tr><th scope="row">${escape(row.name)}<small>初始携带 ${number(row.founderCarriers)}</small></th>${[row.birthCarriers,row.livingCarriers,row.parents,row.transmittedBirths,row.encodedLivingCarriers,row.mutationGains,row.segregationLosses,row.mutationLosses,row.dependencyInactivations].map(value=>`<td>${number(value)}</td>`).join('')}<td class="diagnostics-records">${archiveLink(row.exampleBirth,'首次')}${archiveLink(row.exampleLiving,'现存')}${archiveLink(row.exampleParent,'亲本')||(!row.exampleBirth&&!row.exampleLiving?'—':'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="diagnostics-empty">尚无附加结构的出生记录。</p>'}
  <p class="diagnostics-note">“成为亲本”统计表达该结构且有直接后代的个体，不要求后代也表达；存活个体的生活史尚未结束。这些计数不能单独证明某项结构更有优势。</p>
 </details>
 <p class="diagnostics-footnote">本面板每推进 24 时步重新采样。有效数量使用 exp(Shannon 熵)，同时反映类别数量与数量均匀度。</p>
 </section>`;
}

export function diagnosticsView(world){
 let entry=cache.get(world);
 if(!entry||world.tick-entry.tick>=24||world.tick<entry.tick){entry={tick:world.tick,html:render(diagnoseWorld(world))};cache.set(world,entry);}
 return entry.html;
}
