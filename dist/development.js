import {GENES,has,TRAITS,traitClosure} from './biology.js';

// The same inherited parameters drive mesh proportions and ecological tradeoffs.
export const SHAPE_GENES=['轴向延伸','躯体厚度','附肢伸长','结构重复','分枝密度','曲面弯度','体色偏移','斑纹对比'];
const PROPULSION=['flagella','cilia','jet','fins','limbs','flight','tubeFeet','bell'];
const PROTECTION=['shell','carapace','spines','chamber','silica'];
const round=value=>Math.round(value*1000)/1000;
export function develop(a,cells=1){
 const s=a.shape,axial=has(a,'bilateral'),radial=has(a,'radial'),tissue=has(a,'tissue');
 const topology=axial?'axial':radial?'radial':has(a,'colony')?'colony':'cell';
 const length=.72+s[0]*.95,width=.23+s[1]*.31,appendage=.65+s[2]*.85,repeats=3+Math.round(s[3]*7),branches=3+Math.round(s[4]*6),bend=.035+s[5]*.15;
 const modules=a.traits.filter(id=>['fins','limbs','flight','tentacles','bell','chamber','canopy','mycelium','root','livingReef','aerostat','camera','gills','carapace'].includes(id));
 const propulsion=a.traits.filter(id=>PROPULSION.includes(id)),protection=a.traits.filter(id=>PROTECTION.includes(id));
 // Relative dimensions, not metres or measured hydrodynamics. The middle genotype is the reference.
 const extension=appendage/1.075,thickness=.014+s[1]*.022,coverage=has(a,'shell')?.92:has(a,'carapace')?.78:0;
 const propDimensions={flagella:extension*Math.max(1,Math.round(repeats/3))/2,cilia:extension,jet:extension*extension,fins:extension*extension,limbs:extension*repeats/7,flight:extension*extension,tubeFeet:extension*repeats/7,bell:((.62+length*.18)/(.62+1.195*.18))**2};
 const propArea=propulsion.length?propulsion.reduce((v,id)=>v+propDimensions[id],0)/propulsion.length:0;
 const defenseBase=protection.reduce((v,id)=>v+(TRAITS.find(t=>t.id===id).mods.defense||0),0);
 const defense=defenseBase*((thickness/.025-1)*.22+(has(a,'spines')?(extension-1)*.08:0));
 const trunkMass=length*width*width/.177;
 const surfaceScale=length*width/(1.195*.385);
 const propulsionMass=propulsion.length*.018*propArea,protectionMass=protection.length*.035*(thickness/.025)*surfaceScale;
 const supportMass=modules.filter(id=>!PROPULSION.includes(id)&&!PROTECTION.includes(id)).length*.012*extension;
 const structureMass=propulsionMass+protectionMass+supportMass;
 const bodyCost=.0015+s[0]*s[1]*.005;
 const moduleCost=modules.length*(.45+s[2]*.55)*(2+s[3])*.00035;
 const propulsionCost=propulsion.length*.00032*propArea;
 const protectionCost=protection.length*.00025*(thickness/.025)*(length*width/(1.195*.385));
 const speed=1+(s[0]-.5)*.12-(s[1]-.5)*.09+Math.min(3,propulsion.length)*(propArea-1)*.025-defense*.15;
 const movementCost=1+Math.min(3,propulsion.length)*(propArea-1)*.045+protection.length*(thickness/.025-1)*.018;
 return {topology,tissue,micro:!tissue,length,width,appendage,repeats,branches,bend,modules,
  mass:(trunkMass+structureMass)*cells,unitMass:trunkMass+structureMass,trunkMass,structureMass,cells,surface:Math.pow(cells,tissue?.85:2/3),scale:Math.cbrt(cells),
  hue:(s[6]-.5)*.30,pattern:s[7],cost:bodyCost+moduleCost+propulsionCost+protectionCost,
  speed:speed/Math.pow(cells,.22),turn:1-(s[0]-.5)*.16-(propArea?propArea-1:0)*.025,defense,movementCost,
  propulsion:{traits:propulsion,area:propArea,cost:propulsionCost},
  protection:{traits:protection,thickness,coverage,cost:protectionCost},
  bodyCost:bodyCost+moduleCost,
  label:({axial:'两侧主轴',radial:'辐射主轴',colony:tissue?'群落组织':'细胞群落',cell:'单体结构'})[topology]};
}

// Costs below are geometry maintenance only; fixed trait costs are accounted by phenotype().
export function bodyReport(a){
 const d=develop(a,a.cells),names=ids=>ids.map(id=>TRAITS.find(t=>t.id===id).name).join('、');
 const note='模型中的相对尺度与功能近似；躯干体积和外置结构代理量共同决定材料成本，未计算真实流体力学。体色与斑纹参数只影响外观。';
 return [
  {id:'body',name:'身体比例',summary:`${d.label}，体积影响身体材料、维护及体型相关捕食。`,metrics:[{label:'轴长',value:round(d.length*2),unit:'相对单位'},{label:'厚度',value:round(d.width*2),unit:'相对单位'},{label:'细胞单元',value:d.cells,unit:'个'},{label:'总材料代理',value:round(d.mass),unit:'相对单位'},{label:'外置结构材料',value:round(d.structureMass),unit:'相对单位'}],cost:d.bodyCost,note},
  {id:'propulsion',name:'推进结构',summary:d.propulsion.traits.length?`${names(d.propulsion.traits)}：附肢尺度及适用结构的重复数量共同改变推进、转向和负担。`:'未携带专门推进结构；基础移动仍由可遗传活动参数决定。',metrics:[{label:'结构面积指数',value:round(d.propulsion.area),unit:''},{label:'体形速度修正',value:round(d.speed),unit:'×'},{label:'运动支出修正',value:round(d.movementCost),unit:'×'}],cost:d.propulsion.cost,note:'结构面积为功能代理量，不是网格逐面面积；更多、更长的结构同时承担维护与运动成本。'},
  {id:'protection',name:'保护结构',summary:d.protection.traits.length?`${names(d.protection.traits)}：保护层厚度和棘刺伸长影响防御修正与维护。`:'未携带表面保护结构；基础防御仍由可遗传参数决定。',metrics:[{label:'保护层厚度',value:d.protection.traits.length?round(d.protection.thickness):0,unit:'相对单位'},{label:'表面覆盖',value:Math.round(d.protection.coverage*100),unit:'%'},{label:'尺寸防御修正',value:round(d.defense),unit:''}],cost:d.protection.cost,note:'这里显示尺寸带来的增减；结构本身的固定防御和维护另计。防御收益由实际捕食接触决定。'}
 ];
}

export function compatibleTraits(ids){
 const traits=traitClosure(ids);
 return !traits.some(id=>TRAITS.find(t=>t.id===id).excludes?.some(p=>traits.includes(p)));
}

// Samples explore the grammar; no species recipes or named target forms are used.
export function combinationSample(seed){
 let state=(seed+1)*2654435761>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 let traits=[];const shuffled=TRAITS.map(t=>({t,key:random()})).sort((a,b)=>a.key-b.key);
 const target=4+Math.floor(random()*9);
 for(const {t} of shuffled){if(compatibleTraits([...traits,t.id]))traits=traitClosure([...traits,t.id]);if(traits.length>=target)break;}
 const genes=GENES.map(()=>.35+random()*.5),shape=SHAPE_GENES.map(()=>.15+random()*.7);
 return {id:'sample:'+seed,genes,shape,traits,cells:traits.includes('colony')?2+Math.round(shape[3]*4):1,generation:0};
}
