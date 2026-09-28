import {W,H,COLS,ROWS,clamp} from './engine.js';
import {has} from './biology.js';
export class WorldRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.terrain=document.createElement('canvas');this.terrain.width=COLS;this.terrain.height=ROWS;this.tc=this.terrain.getContext('2d');this.lastTerrain=-1;this.layer='life';this.selected=null;this.world=null;}
 resize(){const box=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);if(this.canvas.width!==Math.round(box.width*dpr)||this.canvas.height!==Math.round(box.height*dpr)){this.canvas.width=Math.round(box.width*dpr);this.canvas.height=Math.round(box.height*dpr);}}
 draw(world){
  this.resize();const c=this.ctx,cw=this.canvas.width,ch=this.canvas.height,sx=cw/W,sy=ch/H;c.setTransform(sx,0,0,sy,0,0);
  if(this.world!==world||world.tick-this.lastTerrain>=8||this.lastLayer!==this.layer){this.world=world;this.lastTerrain=world.tick;this.lastLayer=this.layer;const img=this.tc.createImageData(COLS,ROWS);
   world.fields.forEach((f,i)=>{let r,g,b;
    if(this.layer==='resources'){const n=clamp(f.nutrient/.75);r=14+n*140;g=27+n*154;b=32+n*64;}
    else if(this.layer==='chemical'){const n=clamp(f.redox/4);r=35+n*164;g=26+n*116;b=37+n*42;}
    else if(this.layer==='food'){const p=clamp(f.plankton/.7),d=clamp(f.detritus/4);r=15+d*175;g=36+p*135+d*32;b=34+p*35;}
    else if(this.layer==='heat'){const t=clamp((f.temp+15)/75);r=25+t*155;g=65+t*25;b=119-t*80;}
    else{const deep=clamp((world.environment.sea-f.height)*4),land=f.land;
     r=land?42+(f.height-world.environment.sea)*65:14+deep*1+f.vent*7;
     g=land?55+(f.height-world.environment.sea)*32:51-deep*25+f.vent*12;
     b=land?43:47-deep*12;}
    img.data[i*4]=r;img.data[i*4+1]=g;img.data[i*4+2]=b;img.data[i*4+3]=255;
   });this.tc.putImageData(img,0,0);
  }
  c.imageSmoothingEnabled=true;c.drawImage(this.terrain,0,0,W,H);
  // Contours are generated directly from habitat elevation, not a decorative background.
  c.lineWidth=.65;for(let level=.32;level<.72;level+=.045){c.strokeStyle=level>world.environment.sea?'#a6b88615':'#8abbaa12';c.beginPath();for(let y=0;y<ROWS-1;y++)for(let x=0;x<COLS-1;x++){
   const f=world.fields[y*COLS+x],r=world.fields[y*COLS+x+1],b=world.fields[(y+1)*COLS+x];
   if((f.height-level)*(r.height-level)<0){const xx=f.x+(r.x-f.x)*(level-f.height)/(r.height-f.height);c.moveTo(xx,f.y-7);c.lineTo(xx,f.y+7);}
   if((f.height-level)*(b.height-level)<0){const yy=f.y+(b.y-f.y)*(level-f.height)/(b.height-f.height);c.moveTo(f.x-7,yy);c.lineTo(f.x+7,yy);}
  }c.stroke();}
  c.fillStyle='#b4ddc318';for(let x=30;x<W;x+=40)for(let y=30;y<H;y+=40)c.fillRect(x,y,.9,.9);
  for(const p of world.vents){c.strokeStyle='#d4be7670';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,7,0,6.29);c.stroke();c.beginPath();c.moveTo(p.x-3,p.y);c.lineTo(p.x+3,p.y);c.moveTo(p.x,p.y-3);c.lineTo(p.x,p.y+3);c.stroke();c.strokeStyle='#d4be7618';c.beginPath();c.arc(p.x,p.y,18+Math.sin(world.tick*.03)*3,0,6.29);c.stroke();}
  const colors=new Map(world.species.map(s=>[s.id,s.color]));
  for(const a of world.agents){
   c.globalAlpha=this.selected&&a.species!==this.selected?.18:(a.sleeping?.35:.92);const color=colors.get(a.species);const radius=2+Math.min(2,a.age/130)+(has(a,'tissue')?1.1:0);
   c.fillStyle=color;c.strokeStyle=color;c.lineWidth=.8;
   c.save();c.translate(a.x,a.y);c.rotate(a.angle);const r=radius,dev=a.development;
   if(has(a,'flagella')){c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(-r-4,Math.sin(world.tick*.15+a.id)*2,-r-8,0);c.stroke();}
   if(has(a,'vascular')||has(a,'mycelium')){for(let j=0;j<5;j++){const phi=j*1.256;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(phi)*r*2,Math.sin(phi)*r*2);c.stroke();if(has(a,'canopy')){c.beginPath();c.ellipse(Math.cos(phi)*r*1.5,Math.sin(phi)*r*1.5,r,.5*r,phi,0,6.29);c.fill();}}}
   if(has(a,'radial')){for(let j=0;j<dev.repeats;j++){const phi=j*Math.PI*2/dev.repeats;c.beginPath();c.ellipse(Math.cos(phi)*r*.7,Math.sin(phi)*r*.7,r,.45*r,phi,0,6.29);c.fill();}}
   else if(has(a,'segments')){for(let j=0;j<4;j++){c.beginPath();c.ellipse((j-1.5)*r*.7,Math.sin(j+world.tick*.08)*.5,r*.65,r*.72,0,0,6.29);c.fill();}}
   else{c.beginPath();c.ellipse(0,0,r*dev.length,r*(.65+dev.width),0,0,6.29);c.fill();}
   for(const [id,offset,span] of [['flight',.4,2.5],['fins',-.5,1.5]])if(has(a,id))for(const side of [-1,1]){c.beginPath();c.moveTo(r*(offset+.5),0);c.lineTo(r*(offset-.3),side*r*span*dev.appendage);c.lineTo(r*(offset-.6),0);c.closePath();c.fill();}
   if(has(a,'limbs')){for(const side of [-1,1])for(let j=0;j<dev.repeats;j++){const x=(j/(dev.repeats-1)-.5)*r*2;c.beginPath();c.moveTo(x,side*r*.4);c.lineTo(x-r*.4,side*r*1.8*dev.appendage);c.stroke();}}
   if(has(a,'shell')){c.globalAlpha*=.5;c.beginPath();c.ellipse(0,0,r*1.45+1,r+1,0,0,6.29);c.stroke();}
   c.restore();
  }
  c.globalAlpha=1;
  const tracked=world.agents.find(a=>a.id===this.tracked);
  if(tracked){c.strokeStyle='#defbe9';c.lineWidth=1.3;c.beginPath();c.arc(tracked.x,tracked.y,10,0,Math.PI*2);c.stroke();c.font='11px monospace';c.fillStyle='#defbe9';c.fillText('#'+tracked.id,Math.min(W-65,tracked.x+14),Math.max(16,tracked.y-10));}
  if(world.impact?.until>world.tick){c.strokeStyle='#edb47780';c.lineWidth=2;c.beginPath();c.arc(world.impact.x,world.impact.y,210,0,6.29);c.stroke();}
 }
 hit(clientX,clientY,world){const b=this.canvas.getBoundingClientRect(),x=(clientX-b.left)/b.width*W,y=(clientY-b.top)/b.height*H;let best=null,dist=24;for(const a of world.agents){const d=Math.hypot(a.x-x,a.y-y);if(d<dist){best=a;dist=d;}}return best;}
}
export function drawHistory(canvas,world,selected){
 const box=canvas.getBoundingClientRect();if(!box.width)return;const dpr=Math.min(devicePixelRatio,2);canvas.width=box.width*dpr;canvas.height=box.height*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);const w=box.width,h=box.height,left=34,right=w-5,top=10,bottom=h-14;const history=world.history;if(!history.length)return;
 const max=Math.max(20,...history.flatMap(p=>Object.values(p.counts)));c.font='10px IBM Plex Mono, monospace';c.textAlign='left';
 for(let i=0;i<3;i++){const y=top+(bottom-top)*i/2;c.strokeStyle='#233638';c.setLineDash([3,5]);c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillStyle='#759088';c.fillText(String(Math.round(max*(1-i/2))),0,y+3);}c.setLineDash([]);
 const first=history[0].tick,span=Math.max(24,history.at(-1).tick-first);
 for(const s of world.species){c.globalAlpha=selected&&selected!==s.id?.22:.9;c.strokeStyle=s.color;c.lineWidth=selected===s.id?2.2:1.5;c.beginPath();history.forEach((p,i)=>{const x=left+(p.tick-first)/span*(right-left),y=bottom-(p.counts[s.id]||0)/max*(bottom-top);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();}c.globalAlpha=1;
}
