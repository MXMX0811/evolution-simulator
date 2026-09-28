import dagre from './vendor/dagre.js';
import {TRAITS,TRAIT_INDEX} from './biology.js';
export const LANE_COLORS={energy:'#dfb971',body:'#8ccec3',motion:'#98b9f5',sense:'#c6a4e9',defense:'#cda591',reproduction:'#d29fbd',habitat:'#a8c687',fiction:'#88cddd'};
export function traitRelations(id){
 const ancestors=new Set(),descendants=new Set(),before=new Set(),after=new Set();
 function up(key){for(const p of TRAITS[TRAIT_INDEX[key]].parents){before.add(p+':'+key);if(!ancestors.has(p)){ancestors.add(p);up(p);}}}
 function down(key){for(const t of TRAITS)if(t.parents.includes(key)){after.add(key+':'+t.id);if(!descendants.has(t.id)){descendants.add(t.id);down(t.id);}}}
 up(id);down(id);return {ancestors,descendants,before,after};
}
function layout(nodes,edges){
 const g=new dagre.graphlib.Graph().setGraph({rankdir:'LR',ranker:'network-simplex',nodesep:30,ranksep:84,edgesep:18,marginx:36,marginy:36}).setDefaultEdgeLabel(()=>({}));
 for(const n of nodes)g.setNode(String(n.id),{width:n.width,height:n.height});
 for(const e of edges)g.setEdge(String(e.from),String(e.to));
 dagre.layout(g);
 return {width:g.graph().width,height:g.graph().height,nodes:nodes.map(n=>({...n,...g.node(String(n.id))})),edges:edges.map(e=>({...e,points:g.edge(String(e.from),String(e.to)).points}))};
}
let traitCache=null,forestCache=null;
export function layoutTraits(ids){
 const key=ids.join(',');if(traitCache?.key===key)return traitCache.value;
 const chosen=new Set(ids),value=layout(ids.map(id=>({id,width:196,height:94})),ids.flatMap(id=>TRAITS[TRAIT_INDEX[id]].parents.filter(p=>chosen.has(p)).map(p=>({from:p,to:id}))));traitCache={key,value};return value;
}
export function layoutLineages(world){
 const key=world.lineages.map(n=>`${n.id}:${n.children.join(',')}`).join(';');if(forestCache?.key===key)return forestCache.value;
 const map=new Map(world.lineages.map(n=>[n.id,n])),roots=[];let top=0,width=600;const nodes=[],edges=[];
 for(const root of world.lineages.filter(n=>n.parent===null)){
  const ids=[];function visit(n){ids.push(n.id);n.children.forEach(id=>visit(map.get(id)));}visit(root);
  const result=layout(ids.map(id=>({id,width:map.get(id).children.length?156:202,height:map.get(id).children.length?72:94})),ids.flatMap(id=>map.get(id).children.map(to=>({from:id,to}))));
  roots.push({id:root.id,species:root.species,y:top+18,width:result.width,height:result.height+45});
  nodes.push(...result.nodes.map(n=>({...n,y:n.y+top+40})));edges.push(...result.edges.map(e=>({...e,points:e.points.map(p=>({x:p.x,y:p.y+top+40}))})));top+=result.height+64;width=Math.max(width,result.width);
 }
 const value={nodes,edges,roots,width,height:Math.max(240,top)};forestCache={key,value};return value;
}
export const edgePath=points=>points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
export function graphControls(kind,zoom){return `<div class="graph-controls"><div><button data-graph-action="focus" data-graph-target="${kind}">定位所选</button><button data-graph-action="path" data-graph-target="${kind}">适配路径</button><button data-graph-action="fit" data-graph-target="${kind}">全景</button></div><div><button data-graph-action="out" data-graph-target="${kind}" aria-label="缩小图谱">−</button><output data-graph-zoom="${kind}">${Math.round(zoom*100)}%</output><button data-graph-action="in" data-graph-target="${kind}" aria-label="放大图谱">＋</button></div></div>`;}
export function graphSurface(kind,layout,zoom,html){return `<div class="graph-viewport" data-graph="${kind}" tabindex="0" aria-label="${kind==='traits'?'性状前置关系':'实际亲缘分支'}，拖动空白处平移，使用按钮缩放"><div class="graph-space" style="width:${layout.width*zoom}px;height:${layout.height*zoom}px"><div class="graph-content" data-width="${layout.width}" data-height="${layout.height}" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${zoom})">${html}</div></div></div>`;}
export function arrows(prefix){return `<defs>${[['before','#97e3c1'],['after','#c5aff0'],['neutral','#617776']].map(([name,color])=>`<marker id="${prefix}-${name}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${color}" stroke-width="1.5"/></marker>`).join('')}</defs>`;}
