import {has} from './biology.js';

export const PATHWAYS=[{id:'photons',gene:0,name:'光能合成'},{id:'redox',gene:1,name:'化能合成'},{id:'prey',gene:2,name:'捕食'},{id:'plankton',gene:12,name:'浮游物摄食'},{id:'detritus',gene:13,name:'残骸摄食'}];
// Squared enzyme investment shares a unit budget. Below saturation, reducing all
// genes reduces uptake as well as cost; normalization cannot grant free activity.
export function allocation(a){
 const weights=PATHWAYS.map(p=>a.genes[p.gene]**2),total=weights.reduce((s,v)=>s+v,0),denominator=Math.max(1,total);
 return Object.fromEntries(PATHWAYS.map((p,i)=>[p.id,weights[i]/denominator]));
}
export function uptake(a,f,sea,kinCount=0,b=allocation(a)){
 const p=a.form,surface=a.development.surface;
 return {photons:b.photons*.85*f.light*(1+p.photo)*(has(a,'canopy')&&(f.land||f.height>sea-.1)?1.6:1)*(has(a,'symbiosis')?1+Math.min(.6,kinCount*.09):1)*surface,
  redox:b.redox*.65*Math.max(.1,1+p.mineral+Math.min(.5,kinCount*p.kinMineral))*(1+f.vent*.45)*surface,
  plankton:b.plankton*(.8+p.filter*4)*(f.land?.15:1)*surface,
  detritus:b.detritus*(.8+p.detritus*4)*surface};
}
export function metabolicInvestment(a,b=allocation(a)){return Object.values(b).reduce((sum,value)=>sum+value,0)*.025;}
export function feedingOpportunity(a,f,sea,kinCount=0,b=allocation(a)){const demand=uptake(a,f,sea,kinCount,b);return Math.min(f.nutrient/.035,Math.min(f.photons,demand.photons)+Math.min(f.redox,demand.redox))+Math.min(f.plankton,demand.plankton)+Math.min(f.detritus,demand.detritus);}

// A square projected footprint is an explicit geometry approximation. Coverage
// fractions cap access to each finite pool; weights divide one uptake budget.
export function contactPatches(world,a,cols,rows){
 const dx=world.fields[1].x-world.fields[0].x,dy=world.fields[cols].y-world.fields[0].y;
 const side=Math.sqrt(dx*dy)*Math.cbrt(a.development.mass),x0=a.x-side/2,x1=a.x+side/2,y0=a.y-side/2,y1=a.y+side/2,result=[];
 const left=Math.max(0,Math.floor(x0/dx)),right=Math.min(cols-1,Math.floor(x1/dx)),top=Math.max(0,Math.floor(y0/dy)),bottom=Math.min(rows-1,Math.floor(y1/dy));
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const area=Math.max(0,Math.min(x1,(x+1)*dx)-Math.max(x0,x*dx))*Math.max(0,Math.min(y1,(y+1)*dy)-Math.max(y0,y*dy));
  if(area>0)result.push({field:world.fields[y*cols+x],weight:area/(side*side),coverage:area/(dx*dy)});
 }
 return result;
}
