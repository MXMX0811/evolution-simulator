import * as THREE from './vendor/three.module.min.js';
import {has} from './biology.js';
import {develop} from './development.js';
const TAU=Math.PI*2;
const sphere=new THREE.SphereGeometry(1,40,26);
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
const grainData=new Uint8Array(128*128*4);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=105+noise(x,y)*110,i=(y*128+x)*4;grainData[i]=grainData[i+1]=grainData[i+2]=n;grainData[i+3]=255;}
const grain=new THREE.DataTexture(grainData,128,128);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(4,2);grain.needsUpdate=true;
const scaleData=new Uint8Array(256*256*4);
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const row=Math.floor(y/16),xx=((x+(row%2)*8)%16-8)/8,yy=(y%16)/16,r=Math.sqrt(xx*xx+(yy-.12)**2),ridge=Math.exp(-(((r-.86)/.065)**2)),v=120+ridge*75+noise(x,y)*12,i=(y*256+x)*4;scaleData[i]=scaleData[i+1]=scaleData[i+2]=v;scaleData[i+3]=255;}
const scales=new THREE.DataTexture(scaleData,256,256);scales.wrapS=scales.wrapT=THREE.RepeatWrapping;scales.repeat.set(2,1);scales.needsUpdate=true;
// Curved surfaces and tapered appendages are generated with Three.js geometry primitives.
export function buildOrganism(a,color,{anatomy=false}={}){
 const dev=develop(a,a.cells),root=new THREE.Group(),motions=[],g=a.genes,plan=dev.topology,micro=dev.micro,flora=!has(a,'bilateral')&&!has(a,'radial')&&has(a,'root'),base=new THREE.Color('#98b99e').offsetHSL(dev.hue,.03,0),L=dev.length,B=dev.width;
 const pale=base.clone().lerp(new THREE.Color('#e7dfc2'),.5),dark=base.clone().multiplyScalar(.43);
 const materials=[],attachments=[];let region='body';
 const bellR=.62+L*.18,bellH=.35+B;
 const profilePoints=[.045,.10,.20,.29,.37,.4,.4,.35,.26,.14,.015];
 function axialRadius(x){const u=Math.max(0,Math.min(1,(x/L+1)/2)),n=u*10,i=Math.min(9,Math.floor(n)),t=n-i,p0=profilePoints[Math.max(0,i-1)],p1=profilePoints[i],p2=profilePoints[i+1],p3=profilePoints[Math.min(10,i+2)];return .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*(B/.4)*(has(a,'segments')?1-.035*Math.cos(u*dev.repeats*TAU):1);}
 // Each visible envelope is one paid cell. The compact cluster stays connected as it grows.
 const cells=Array.from({length:dev.cells},(_,i)=>{
  if(dev.cells===1)return {p:[0,0,0],s:1};
  const s=1/dev.scale,y=1-2*(i+.5)/dev.cells,r=Math.sqrt(1-y*y),angle=i*2.399963229728653;
  return {p:[Math.cos(angle)*r*L*s*.92,y*B*s*.92,Math.sin(angle)*r*B*.8*s*.92],s};
 });
 function mount(q){
  if(micro){let best=null,score=Infinity;for(const c of cells){const d=q.map((v,i)=>v-c.p[i]),r=[L*c.s,B*c.s,B*.8*c.s],n=Math.sqrt(d.reduce((v,x,i)=>v+(x/r[i])**2,0))||1,p=d.map((v,i)=>c.p[i]+v/n*.97),dist=p.reduce((v,x,i)=>v+(x-q[i])**2,0);if(dist<score){score=dist;best=p;}}return best;}
  if(plan==='radial'){
   const t=Math.atan2(q[2],q[0]),R=has(a,'bell')?bellR:.32+.56*dev.appendage*Math.pow((Math.cos(t*dev.repeats)+1)/2,1.8),v=Math.min(.96,Math.hypot(q[0],q[2])/R),r=v*R;
   const y=has(a,'bell')?(q[1]<0?-.025:Math.sqrt(1-v*v)*bellH):(q[1]<0?-.065*(1-v):.12*Math.sin(v*Math.PI)+.08*(1-v));const rr=has(a,'bell')&&q[1]<0?Math.min(r,.21):r;return [Math.cos(t)*rr,y,Math.sin(t)*rr];
  }
  const len=plan==='axial'?L:L*.57,x=Math.max(-len*.97,Math.min(len*.97,q[0])),u=x/len,theta=Math.atan2(q[2]/(B*.72),q[1]/B),shape=(.92+.12*Math.cos(u*1.8))*(1-.09*u),groove=has(a,'segments')?1-.035*Math.pow((Math.cos((u+1)*Math.PI*dev.repeats)+1)/2,6):1;
  if(plan==='axial'&&has(a,'notochord')){const r=axialRadius(x);return [x,Math.cos(theta)*r*.98,Math.sin(theta)*r*.72*.98];}
  const r=Math.sqrt(1-u*u)*shape*groove;return [x,Math.cos(theta)*r*B*(plan==='axial'?.78:1)*.98+.035*Math.sin(u*3),Math.sin(theta)*r*B*(plan==='axial'?.72:.8)*.98];
 }
 function joint(q,label){const p=mount(q);attachments.push({label,region,point:[...p]});return p;}
 function coating(q){const p=mount(q),h=dev.protection.thickness;if(plan==='radial')return [p[0],p[1]+h,p[2]];const r=Math.hypot(p[1],p[2])||1;return [p[0],p[1]+p[1]/r*(h+B*.025),p[2]+p[2]/r*(h+B*.025)];}

 function material(c,extra={}){const m=new THREE.MeshPhysicalMaterial({color:c,side:THREE.DoubleSide,roughness:.53,metalness:0,clearcoat:.22,clearcoatRoughness:.4,sheen:.12,sheenColor:pale,bumpMap:grain,bumpScale:.007,...extra});materials.push(m);return m;}
 const skin=material(base,{transparent:anatomy&&!micro,opacity:anatomy&&!micro?.2:1,depthWrite:!anatomy});
 const soft=material(pale,{roughness:.6}),hard=material(base.clone().lerp(new THREE.Color('#a7a78c'),.28),{roughness:.38,clearcoat:.55,bumpScale:.004});
 const clear=material(pale,{transparent:true,opacity:.22,depthWrite:false,roughness:.12,clearcoat:1,side:THREE.DoubleSide,bumpScale:.009});
 const eyeMat=material('#101e1c',{roughness:.08,clearcoat:1,bumpMap:null}),white=material('#e1efce',{roughness:.2,bumpMap:null});
 function add(geometry,mat=skin,position=[0,0,0]){const m=new THREE.Mesh(geometry,mat);m.position.set(...position);m.userData.region=region;root.add(m);return m;}
 function ellipsoid(x,y,z,rx,ry,rz,m=skin){const o=add(sphere,m,[x,y,z]);o.scale.set(rx,ry,rz);return o;}
 function moving(o,axis,amplitude,speed,phase=0){if(o.userData.anchor){const p=o.userData.anchor;o.geometry.translate(-p[0],-p[1],-p[2]);o.position.add(new THREE.Vector3(...p));delete o.userData.anchor;}motions.push({m:o,axis,amp:amplitude,speed,phase,base:o.rotation[axis]});return o;}
 function path(points,radius=.03,tip=.002,mat=skin,segments=40){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),pos=[],uv=[],indices=[],sides=9;
  for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPointAt(t),r=tip+(radius-tip)*Math.pow(1-t,.75);for(let j=0;j<=sides;j++){const phi=j/sides*TAU,v=p.clone().addScaledVector(frames.normals[i],Math.cos(phi)*r).addScaledVector(frames.binormals[i],Math.sin(phi)*r);pos.push(...v.toArray());uv.push(t,j/sides);if(i<segments&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}}}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.setIndex(indices);geom.computeVertexNormals();const result=add(geom,mat);result.userData.anchor=points[0];return result;
 }
 function surface(fn,nu,nv,mat=skin){const p=[],uv=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);if(i<nu&&j<nv){const n=i*(nv+1)+j;idx.push(n,n+nv+1,n+1,n+1,n+nv+1,n+nv+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return add(geo,mat);}
 function armorPlate(point,nu,nv){surface((u,v)=>point(u,v,true),nu,nv,hard);for(const side of [0,1])for(const axis of [0,1])surface((t,h)=>{const u=axis?t:side,v=axis?side:t,inner=point(u,v,false),outer=point(u,v,true);return inner.map((n,i)=>n+(outer[i]-n)*h);},axis?nu:nv,2,hard);}
 function body(length,height,depth,segments=0,at=[0,0,0]){
  const geom=new THREE.SphereGeometry(1,64,40),pos=geom.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),groove=segments?1-.035*Math.pow((Math.cos((x+1)*Math.PI*segments)+1)/2,6):1,shape=(.92+.12*Math.cos(x*1.8))*(1-.09*x),yy=y*height*shape*groove+.035*Math.sin(x*3);pos.setXYZ(i,x*length,yy,z*depth*shape*groove);const c=base.clone().lerp(pale,Math.max(0,-y)*.38).multiplyScalar(.92+noise(i,4)*.06-dev.pattern*.08*(.5+.5*Math.sin(x*dev.repeats*4)));colors.push(c.r,c.g,c.b);}
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geom.computeVertexNormals();const m=skin.clone();m.color.set('#ffffff');m.vertexColors=true;materials.push(m);const mesh=add(geom,m,at);mesh.userData.core=true;return mesh;
 }
 function leaf(origin,length,width,angle,mat=soft,bend=.13){
  const o=surface((u,v)=>{const x=u*length,y=(v-.5)*2*width*Math.pow(Math.sin(u*Math.PI),.8),z=Math.sin(u*Math.PI)*bend-Math.pow((v-.5)*2,2)*bend*.75;return [x,y,z];},28,14,mat);o.position.set(...origin);o.rotation.z=angle;return o;
 }
 function eye(x,y,z,r=.095){const start=root.children.length;ellipsoid(0,0,0,r,r*.9,r*.65,material(pale,{roughness:.35}));ellipsoid(0,0,r*.5,r*.66,r*.66,r*.4,eyeMat);ellipsoid(r*.2,r*.22,r*.85,r*.12,r*.12,r*.06,white);const parts=root.children.slice(start),socket=new THREE.Group();root.add(socket);socket.position.set(x,y,z);const normal=plan==='radial'?new THREE.Vector3(x,.5,z).normalize():new THREE.Vector3(x*.1,y/B,z/(B*.72)).normalize();socket.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);parts.forEach(part=>socket.add(part));}
 function antenna(x,y,z,side,crystal=false){const start=root.children.length,p=joint([x,y,z],'antenna'),pts=[p,[p[0]+.27,p[1]+.22,p[2]+side*.14],[p[0]+.54,p[1]+.38,p[2]+side*.24],[p[0]+.61,p[1]+.32,p[2]+side*.28]];path(pts,.019,.003,soft);if(crystal){const quartz=add(new THREE.OctahedronGeometry(.1,0),material('#adcddd',{metalness:.12,roughness:.12,transparent:true,opacity:.8}),pts.at(-1));quartz.scale.set(.6,2.6,.6);}const parts=root.children.slice(start),group=new THREE.Group();root.add(group);group.position.set(...p);parts.forEach(m=>group.attach(m));moving(group,'y',.035,1.2,side);}
 function suckers(points,count=8){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));for(let i=0;i<count;i++){const t=.1+i/count*.7,p=curve.getPoint(t),r=.014*(1-t)+.004;const ring=add(new THREE.TorusGeometry(r,.004,6,12),soft,[p.x,p.y,p.z+.035*(1-t)]);ring.scale.y=.8;}}
 function tentacle(points,r=.075,phase=0,cups=false){const start=root.children.length;points[0]=joint(points[0],'tentacle');path(points,r,.004,skin,56);if(cups)suckers(points);const parts=root.children.slice(start),o=new THREE.Group();root.add(o);o.position.set(...points[0]);parts.forEach(m=>o.attach(m));moving(o,'z',.023,1.2,phase);return o;}
 function membraneMaterial(c,opacity=.6){return material(c,{transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,roughness:.32,clearcoat:.75,bumpScale:.008});}
 function internal(origin=[0,0,0],scale=1){
  const first=root.children.length,x=origin[0],y=origin[1],z=origin[2];
  if(micro||anatomy){
   // An abstract genome coil, rather than a nucleus shared by every life form.
   const coil=Array.from({length:48},(_,i)=>{const t=i/47*TAU*2.4;return [x+Math.cos(t)*.16*scale,y+Math.sin(t)*.12*scale,z+(i/47-.5)*.2*scale];});path(coil,.014*scale,.01*scale,material(pale,{roughness:.5}));
   if(has(a,'pigment'))for(let i=0;i<7;i++){const t=i*2.4;const m=ellipsoid(x+Math.cos(t)*.46*scale,y+Math.sin(t)*.24*scale,z+.09*scale,.09*scale,.037*scale,.035*scale,material('#799467',{roughness:.54}));m.rotation.z=t;}
   if(has(a,'oxygen')||has(a,'vent'))for(let i=0;i<4;i++){const t=i*2.1;const o=ellipsoid(x+Math.cos(t)*.4*scale,y+Math.sin(t)*.2*scale,z-.02*scale,.075*scale,.028*scale,.03*scale,material('#bd9567'));o.rotation.z=t;}
   if(has(a,'symbiosis')){ellipsoid(x+.23*scale,y+.12*scale,z,.12*scale,.085*scale,.075*scale,material('#899c6a',{transparent:true,opacity:.66}));for(let i=0;i<3;i++)ellipsoid(x+(.18+i*.038)*scale,y+.12*scale,z+.04*scale,.02*scale,.035*scale,.018*scale,soft);}
   if(has(a,'vacuole'))ellipsoid(x-.27*scale,y-.06*scale,z,.18*scale,.14*scale,.12*scale,clear);
   if(micro&&has(a,'nerve')){path([[x-.36*scale,y,z+.07*scale],[x,y+.03*scale,z+.08*scale],[x+.37*scale,y,z+.06*scale]],.005*scale,.003*scale,material('#7eabb2'));for(let i=0;i<(has(a,'memory')?8:4);i++)ellipsoid(x+(i*.07-.25)*scale,y+.025*scale,z+.07*scale,.014*scale,.014*scale,.014*scale,soft);}
   if(has(a,'toxin'))for(let i=0;i<3;i++)ellipsoid(x+.17*scale,y+(i-1)*.1*scale,z+.09*scale,.04*scale,.04*scale,.04*scale,material('#b596ac',{roughness:.4}));
  }
  const parts=root.children.slice(first),group=new THREE.Group();root.add(group);group.position.set(...origin);parts.forEach(m=>group.attach(m));group.scale.set(L/1.195,B/.385,B/.385);
 }
 if(micro){
  const cellMat=material('#ffffff',{vertexColors:true,transparent:true,opacity:.44,depthWrite:false,roughness:.3,clearcoat:.65,iridescence:.08});

  for(const {p,s} of cells){const geom=new THREE.SphereGeometry(1,64,40),v=geom.attributes.position,colors=[];for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),r=1+.012*Math.sin(x*12+y*9)*Math.sin(z*11);v.setXYZ(i,x*L*r*s,y*B*r*s,z*B*.8*r*s);const band=Math.pow((Math.cos(x*dev.repeats*Math.PI+y*2)+1)/2,5),c=base.clone().lerp(pale,.12+.18*Math.max(0,-y)).multiplyScalar(1-dev.pattern*.22*band);colors.push(c.r,c.g,c.b);}geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geom.computeVertexNormals();add(geom,cellMat,p).userData.core=true;internal(p,s);if(has(a,'shell')){region='protection';const h=dev.protection.thickness,wire=ellipsoid(...p,L*s+h,B*s+h,B*.8*s+h,material(pale,{transparent:true,opacity:.13+s*.04,depthWrite:false,roughness:.34,clearcoat:.5}));wire.userData.shell=true;region='body';}}
  for(let i=1;i<cells.length;i++){const c=cells[i],near=cells.slice(0,i).reduce((best,b)=>new THREE.Vector3(...b.p).distanceTo(new THREE.Vector3(...c.p))<new THREE.Vector3(...best.p).distanceTo(new THREE.Vector3(...c.p))?b:best,cells[0]);path([near.p,c.p],B*.16,B*.14,material(base,{transparent:true,opacity:.3,depthWrite:false,roughness:.3}),20);}
  region='propulsion';
  if(has(a,'flagella'))for(let i=0;i<Math.max(1,Math.round(dev.repeats/3));i++)moving(path([joint([-L*.8,(i-1)*.1,0],'flagellum'),[-L-.25*dev.appendage,(i-1)*.12+.1,.05],[-L-.55*dev.appendage,(i-1)*.14-.09,.12],[-L-.9*dev.appendage,(i-1)*.14+.08,.15]],.013,.001,soft,60),'y',.12,3,i);
  if(has(a,'cilia')||has(a,'filter'))for(let i=0;i<40;i++){const t=i/40*TAU;moving(path([joint([Math.cos(t)*L,Math.sin(t)*B,0],'cell surface'),[Math.cos(t)*(L+.12*dev.appendage),Math.sin(t)*(B+.18*dev.appendage),.01],[Math.cos(t)*(L+.14*dev.appendage),Math.sin(t)*(B+.22*dev.appendage),.03]],.004,.0007,soft,12),'z',.03,4,i);}
  region='body';
  if(has(a,'eyespot'))ellipsoid(...joint([L*.62,B*.4,B*.6],'eyespot'),.045,.035,.023,material('#a87865'));
  if(has(a,'filter'))for(let i=0;i<17;i++){const t=(i-8)*.13;path([joint([L*.79,0,0],'filter'),[L+.2,Math.sin(t)*.3,Math.cos(t)*.08],[L+.36,Math.sin(t)*.44,Math.cos(t)*.12]],.007,.001,soft,28);}
  region='propulsion';
  if(has(a,'jet')){const nozzle=add(new THREE.LatheGeometry([new THREE.Vector2(.04,0),new THREE.Vector2(.065,.07),new THREE.Vector2(.045,.14)],24),soft,joint([-L*.7,-.12,0],'jet'));nozzle.scale.setScalar(dev.appendage/1.075);nozzle.rotation.z=1.1;}
  region='body';
  if(has(a,'engulf')){const m=add(new THREE.TorusGeometry(.085,.018,10,32),soft,joint([L*.94,0,0],'mouth'));m.rotation.y=Math.PI/2;}
  if(has(a,'chemoreceptor'))for(let i=0;i<3;i++)antenna(L*.75,(i-1)*.1,.02,1);
  region='protection';
  if(has(a,'mucus'))ellipsoid(0,0,0,L*1.05,B*1.08,B*.9,material('#afc4b6',{transparent:true,opacity:.055,depthWrite:false}));
  if(has(a,'spines'))for(let i=0;i<12;i++){const t=i*TAU/12;path([joint([Math.cos(t)*L,Math.sin(t)*B,0],'cell surface'),[Math.cos(t)*(L+.16),Math.sin(t)*(B+.18),0]],.012*(dev.protection.thickness/.025),.001,hard,10);}
  region='body';
  if(has(a,'osmotic'))for(const side of [-1,1])ellipsoid(...mount([-.4,side*.18,.06]),.045,.025,.03,clear);
  if(has(a,'spore'))for(let i=0;i<16;i++){const t=i*2.4;ellipsoid(...mount([Math.cos(t)*L*.92,Math.sin(t)*B*.9,.09]),.008,.013,.008,soft);}
  // Buds are represented by actual colony cells, rather than an extra uncounted cell mesh.
  if(has(a,'detritus'))for(let i=0;i<9;i++)path([mount([L*.7,(i-4)*.024,.02]),mount([L*.85,(i-4)*.025,.03])],.004,.001,soft,8);
  if(has(a,'root'))for(let i=0;i<6;i++)path([joint([0,-B,0],'root'),[(i-2.5)*.18,-.65,.08],[(i-2.5)*.3,-.95,.04]],.012,.001,soft,24);
 }
 // Only the body symmetry chooses a core surface. Organs are independent modules.
 if(!micro){
  if(plan==='axial'){
   if(has(a,'notochord')){
    const mat=material('#ffffff',{vertexColors:true,roughness:.5,clearcoat:.5,bumpMap:scales,bumpScale:.01,transparent:anatomy,opacity:anatomy?.18:1,depthWrite:!anatomy});
    const trunk=surface((u,v)=>{const theta=v*TAU,r=axialRadius((u*2-1)*L);return [(u*2-1)*L,Math.cos(theta)*r,Math.sin(theta)*r*.72];},90,48,mat);
    const colors=[];for(let i=0;i<trunk.geometry.attributes.position.count;i++){const y=trunk.geometry.attributes.position.getY(i),u=trunk.geometry.attributes.uv.getX(i),light=Math.max(0,Math.min(1,(B-y)/(B*2))),c=base.clone().multiplyScalar(.58).lerp(pale,Math.pow(light,1.4)*.85);c.multiplyScalar(1-dev.pattern*.1*(.5+.5*Math.cos(u*TAU*dev.repeats)));colors.push(c.r,c.g,c.b);}trunk.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));trunk.userData.core=true;
   }else body(L,B*.78,B*.72,has(a,'segments')?dev.repeats:0);
  }else if(plan==='radial'&&!has(a,'bell')){
   surface((u,v)=>{const t=u*TAU,r=v*(.32+.56*dev.appendage*Math.pow((Math.cos(t*dev.repeats)+1)/2,1.8));return [Math.cos(t)*r,.12*Math.sin(v*Math.PI)+.08*(1-v),Math.sin(t)*r];},120,26,skin).userData.core=true;
   surface((u,v)=>{const t=u*TAU,r=v*(.32+.56*dev.appendage*Math.pow((Math.cos(t*dev.repeats)+1)/2,1.8));return [Math.cos(t)*r,-.065*(1-v),Math.sin(t)*r];},120,26,skin).userData.core=true;

  }else if(!has(a,'bell'))body(L*.57,B,B*.8,0,[0,0,0]);
 }
 region='propulsion';
 if(has(a,'bell')){
  const jellymat=membraneMaterial(base,.36),count=dev.repeats*2,R=bellR,height=bellH;
  const bell=surface((u,v)=>{const theta=u*TAU,phi=v*Math.PI*.5,r=Math.sin(phi)*(R+.015*Math.cos(theta*count)*v*v);return [Math.cos(theta)*r,Math.cos(phi)*height,Math.sin(theta)*r];},96,40,jellymat);bell.userData.core=true;
  const rim=[];for(let i=0;i<=96;i++){const t=i/96*TAU;rim.push([Math.cos(t)*R,0,Math.sin(t)*R]);}path(rim,.013,.013,soft,96);
  for(let i=0;i<count;i++){const t=i/count*TAU;path(Array.from({length:12},(_,j)=>{const q=j/11;return [Math.cos(t)*Math.sin(q*Math.PI*.5)*R,Math.cos(q*Math.PI*.5)*height,Math.sin(t)*Math.sin(q*Math.PI*.5)*R];}),.006,.003,soft,28);}
  path([[0,height*.98,0],[0,height*.3,0],[0,-.025,0]],.065,.07,soft,28);ellipsoid(0,-.025,0,.24,.065,.24,soft).userData.core=true;
  for(let i=0;i<count*2;i++){const t=i/(count*2)*TAU,x=Math.cos(t)*R,z=Math.sin(t)*R;moving(path([[x,0,z],[x*.97,-.3,z],[x*.9+Math.sin(i)*dev.bend,-.65*dev.appendage,z*.94],[x*.78,-1.12*dev.appendage,z*.8]],.007,.001,soft,48),'z',.025,1.3,i);}
 }
 region='protection';
 // The inherited membrane follows the mature core rather than disappearing at tissue formation.
 if(!micro&&has(a,'shell')){const cores=root.children.filter(m=>m.userData.core);for(const core of cores){const geometry=core.geometry.clone(),pos=geometry.attributes.position,norm=geometry.attributes.normal;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)+norm.getX(i)*dev.protection.thickness,pos.getY(i)+norm.getY(i)*dev.protection.thickness,pos.getZ(i)+norm.getZ(i)*dev.protection.thickness);geometry.computeVertexNormals();const coat=add(geometry,material(pale,{transparent:true,opacity:anatomy?.035:.1,depthWrite:false,roughness:.4,clearcoat:.5}),core.position.toArray());coat.scale.copy(core.scale);coat.userData.shell=true;}}
 // Dorsal armor follows the trunk; it does not select an arthropod template.
 if(!micro&&has(a,'carapace')&&plan==='axial')for(let i=0;i<dev.repeats;i++){armorPlate((u,v,outer)=>{const x=((i+u*.98)/dev.repeats*1.9-.95)*L,phi=(v-.5)*Math.PI*1.3,q=[x,Math.cos(phi)*B,Math.sin(phi)*B*.72],p=outer?coating(q):mount(q);return [p[0],p[1]+(outer?dev.protection.thickness*.35*Math.sin(u*Math.PI):0),p[2]];},12,24);}
 if(!micro&&has(a,'carapace')&&plan!=='axial')armorPlate((u,v,outer)=>{const t=u*TAU,r=v*(plan==='radial'?(has(a,'bell')?bellR:.32+.56*dev.appendage*Math.pow((Math.cos(t*dev.repeats)+1)/2,1.8)):L*.57),q=[Math.cos(t)*r,B,Math.sin(t)*r*(plan==='radial'?1:.64)];return outer?coating(q):mount(q);},100,28);
 region='propulsion';
 if(!micro&&has(a,'tubeFeet'))for(let arm=0;arm<dev.repeats;arm++)for(let i=1;i<9;i++){
  const t=arm*TAU/dev.repeats,r=i/9*(has(a,'bell')?.75:.65),x=Math.cos(t)*r,z=Math.sin(t)*r,y=has(a,'bell')?.07:.025;moving(path([joint([x,-.1,z],'tube feet'),[x,mount([x,-.1,z])[1]-.12*dev.appendage,z]],.008,.004,soft,10),'x',.05,1.8,i);
 }
 region='protection';
 if(!micro&&has(a,'spines')&&plan!=='axial')for(let i=0;i<dev.repeats*2;i++){
  const t=i/(dev.repeats*2)*TAU,r=plan==='radial'?.6:L*.45,x=Math.cos(t)*r,z=Math.sin(t)*r,y=has(a,'bell')?.64:B*.6;path([joint([x,y,z],'spine'),[x*1.12,mount([x,y,z])[1]+.15*dev.appendage,z*1.12]],.014*(dev.protection.thickness/.025),.001,hard,14);
 }
 region='body';
 if(!micro&&has(a,'filter'))for(let i=0;i<dev.repeats*3;i++){
  const t=i/(dev.repeats*3)*TAU,axial=plan==='axial',start=joint(axial?[L*.88,Math.cos(t)*B*.23,Math.sin(t)*B*.23]:[Math.cos(t)*.18,-B*.6,Math.sin(t)*.18],'filter'),end=axial?[L+.38*dev.appendage,Math.cos(t)*.3,Math.sin(t)*.3]:[Math.cos(t)*.44,-B-.35*dev.appendage,Math.sin(t)*.44];moving(path([start,[(start[0]+end[0])*.5,(start[1]+end[1])*.5,(start[2]+end[2])*.5],end],.006,.001,soft,24),'z',.018,2,i);
 }
 region='propulsion';
 if(has(a,'fins')){
  const finmat=membraneMaterial(pale,.7),reach=.53*dev.appendage;
  for(const side of [-1,1]){
   const anchor=joint([-.27*L,-B*.16,side*B*.6],'pectoral fin'),startFin=root.children.length,fin=leaf([0,0,0],reach,.22*dev.appendage,0,finmat,dev.bend);ellipsoid(0,0,0,.045,.027,.04,skin);for(let rib=0;rib<7;rib++){const v=rib/6;path(Array.from({length:12},(_,j)=>{const u=j/11;return [u*reach,(v-.5)*.44*dev.appendage*Math.pow(Math.sin(u*Math.PI),.8),Math.sin(u*Math.PI)*dev.bend-Math.pow((v-.5)*2,2)*dev.bend*.75];}),.0025,.0005,soft,20);}const finParts=root.children.slice(startFin),finJoint=new THREE.Group();root.add(finJoint);finJoint.position.set(...anchor);finJoint.rotation.set(0,side*.9,Math.PI+.17);for(const part of finParts)finJoint.add(part);moving(finJoint,'x',.09,2.2,side);
   const tailRoot=joint([-L*.97,0,0],'tail fin'),start=root.children.length,angle=Math.PI-side*.57;leaf(tailRoot,reach*1.3,.23*dev.appendage,angle,finmat,dev.bend*.2);
   for(let j=0;j<9;j++){const v=j/8;path(Array.from({length:10},(_,i)=>{const u=i/9,x=u*reach*1.3,y=(v-.5)*.46*dev.appendage*Math.pow(Math.sin(u*Math.PI),.8);return [tailRoot[0]+x*Math.cos(angle)-y*Math.sin(angle),tailRoot[1]+x*Math.sin(angle)+y*Math.cos(angle),tailRoot[2]+.003+Math.sin(u*Math.PI)*dev.bend*.2];}),.003,.0006,soft,20);}
   const parts=root.children.slice(start),tail=new THREE.Group();root.add(tail);tail.position.set(...tailRoot);parts.forEach(m=>tail.attach(m));moving(tail,'y',.1,2.2,side);
  }
  surface((u,v)=>{const x=(u*1.4-.7)*L,p=mount([x,B,0]);return [x,p[1]+Math.sin(u*Math.PI)*.36*dev.appendage*v,(v-.5)*.015];},40,8,finmat);
 }
 if(has(a,'limbs'))for(const side of [-1,1])for(let i=0;i<dev.repeats;i++){
  const x=((i+.5)/dev.repeats*1.5-.75)*L,spread=.48*dev.appendage,p0=joint([x,-B*.25,side*B*.57],'limb'),p1=[x-.04,-B*.5,side*(B*.72+spread*.55)],p2=[x-.18,-B-.28,side*(B*.72+spread)],p3=[x-.04,-B-.33,side*(B*.72+spread+.07)];
  const parts=[ellipsoid(...p0,.037,.03,.034,skin),path([p0,p1],.028,.021,hard,14),path([p1,p2],.021,.009,hard,16),path([p2,p3],.01,.001,soft,12),ellipsoid(...p1,.035,.035,.035,hard)],leg=new THREE.Group();root.add(leg);leg.position.set(...p0);parts.forEach(m=>leg.attach(m));moving(leg,'y',.045,2,i*.9+side);
 }
 if(has(a,'flight'))for(const side of [-1,1]){
  const start=root.children.length,span=dev.appendage*1.05,origin=joint([L*.13,B*.5,side*B*.5],'wing'),mat=membraneMaterial('#ffffff',has(a,'poweredFlight')?.96:.72);mat.vertexColors=true;mat.roughness=.72;
  const wingPoint=(u,v)=>{const theta=(v*.88-.44)*Math.PI,r=u*span*(1.08+.25*Math.sin(v*Math.PI)+.12*Math.sin(v*TAU*2));return [origin[0]+Math.sin(theta)*r*.72,origin[1]+Math.sin(u*Math.PI)*dev.bend,origin[2]+side*Math.cos(theta)*r];};
  ellipsoid(...origin,.07,.045,.065,skin);const wing=surface(wingPoint,44,52,mat),colors=[];
  for(let i=0;i<wing.geometry.attributes.position.count;i++){const u=wing.geometry.attributes.uv.getX(i),v=wing.geometry.attributes.uv.getY(i),edge=Math.exp(-(((u-.9)/.065)**2)),r=Math.min(Math.hypot((u-.67)/.09,(v-.25)/.08),Math.hypot((u-.71)/.09,(v-.73)/.08)),c=base.clone().lerp(new THREE.Color('#c8a077'),.45);c.lerp(dark,Math.min(.8,(edge*.55+Math.exp(-r*r*2)*.7)*dev.pattern));c.lerp(pale,Math.exp(-(((r-1)/.18)**2))*.6);colors.push(c.r,c.g,c.b);}wing.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  for(let i=0;i<14;i++)path([wingPoint(0,i/13),wingPoint(.5,i/13),wingPoint(1,i/13)],.004,.0007,soft,28);
  const parts=root.children.slice(start),group=new THREE.Group();root.add(group);group.position.set(...origin);parts.forEach(m=>group.attach(m));moving(group,'x',has(a,'poweredFlight')?.16:.05,has(a,'poweredFlight')?2.5:1,side);
 }
 region='body';
 if(has(a,'tentacles'))for(let i=0;i<dev.repeats;i++){
  const t=i/dev.repeats*TAU,A=dev.appendage;
  const points=plan==='axial'?[[L*.86,Math.cos(t)*B*.4,Math.sin(t)*B*.4],[L+.26*A,Math.cos(t)*.2,Math.sin(t)*.2],[L+.56*A,Math.cos(t)*.42,Math.sin(t)*.42],[L+.67*A,Math.cos(t)*.34-dev.bend,Math.sin(t)*.5]]:[[Math.cos(t)*.2,-.025,Math.sin(t)*.2],[Math.cos(t)*.4,-.34*A,Math.sin(t)*.4],[Math.cos(t)*.55,-.8*A,Math.sin(t)*.55],[Math.cos(t)*.43+dev.bend,-.95*A,Math.sin(t)*.43]];
  tentacle(points,.032,i,true);
 }
 region='protection';
 if(has(a,'chamber')){
  const curve=new THREE.CatmullRomCurve3(Array.from({length:100},(_,i)=>{const t=i/99,theta=t*TAU*(2.1+a.shape[5])+.45,r=.7*Math.exp((t-1)*TAU*2.4*.14);return new THREE.Vector3(Math.cos(theta)*r-L*.22,Math.sin(theta)*r+B*.66,0);})),frames=curve.computeFrenetFrames(160,false),mat=material('#c7bea4',{vertexColors:true,roughness:.28,clearcoat:.8});
  const shell=surface((u,v)=>{const p=curve.getPointAt(u),j=Math.min(160,Math.round(u*160)),r=.022+.29*Math.pow(u,1.3),t=v*TAU;return p.clone().addScaledVector(frames.normals[j],Math.cos(t)*r).addScaledVector(frames.binormals[j],Math.sin(t)*r*.8).toArray();},160,40,mat),colors=[];
  for(let i=0;i<shell.geometry.attributes.position.count;i++){const u=shell.geometry.attributes.uv.getX(i),v=shell.geometry.attributes.uv.getY(i),stripe=Math.pow((Math.cos(u*TAU*(18+dev.repeats)+Math.sin(v*TAU)*.6)+1)/2,6),c=pale.clone().lerp(dark,stripe*(.2+dev.pattern*.45));colors.push(c.r,c.g,c.b);}shell.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const opening=curve.getPointAt(.96).toArray(),basePoint=joint([opening[0],B,0],'mantle');path([basePoint,[(basePoint[0]+opening[0])*.5,(basePoint[1]+opening[1])*.5,0],opening],.12,.2,skin,32);
 }
 region='body';
 // Photosynthetic and fungal structures grow at their own anchors on any compatible core.
 if(has(a,'root')&&!micro){for(let i=0;i<dev.branches;i++){const t=i*2.4,x=Math.cos(t)*L*.4,z=Math.sin(t)*B;path([joint([x,-B*.5,z],'root'),[x*1.3,-B-.27,z*1.7],[x*1.65,-B-.55,z*2.2]],.012,.001,soft,28);}}
 if(has(a,'canopy')||has(a,'mycelium')||has(a,'livingReef')){
  const stem=material(base.clone().lerp(new THREE.Color('#7d8060'),.4),{roughness:.7}),leafmat=material(base.clone().lerp(new THREE.Color('#779568'),.4),{roughness:.64});
  for(let i=0;i<dev.branches;i++){
   const u=(i+.5)/dev.branches,t=i*2.4,x=plan==='axial'?(u*1.4-.7)*L:Math.cos(t)*.24,z=Math.sin(t)*B*.5,y=micro?-.1:B*.4,height=(.3+.36*a.shape[4])*(.72+.28*Math.sin(t)**2),tip=[x+.07*Math.cos(t),y+height,z+.07*Math.sin(t)];
   path([joint([x,y,z],'stem'),[x,y+height*.55,z],tip],has(a,'livingReef')?.055:.016,.007,stem,30);
   if(has(a,'canopy'))for(const side of [-1,1]){const start=root.children.length,angle=side>0?.55:Math.PI-.55,len=.38*dev.appendage,blade=leaf([0,0,0],len,.11,0,leafmat,dev.bend*.45);path(Array.from({length:16},(_,j)=>{const u=j/15;return [u*len,0,Math.sin(u*Math.PI)*dev.bend*.45+.001];}),.003,.0005,soft,24);const parts=root.children.slice(start),group=new THREE.Group();root.add(group);group.position.set(...tip);group.rotation.z=angle;group.rotation.y=Math.sin(t)*.5;parts.forEach(m=>group.add(m));moving(group,'y',.025,1,i);}
   if(has(a,'mycelium')){const r=.11+dev.bend*.4;surface((u,v)=>{const phi=u*TAU,rr=Math.sin(v*Math.PI*.53)*r;return [tip[0]+Math.cos(phi)*rr,tip[1]+Math.cos(v*Math.PI*.53)*r*.65,tip[2]+Math.sin(phi)*rr];},40,20,skin);for(let j=0;j<18;j++){const phi=j/18*TAU;path([tip,[tip[0]+Math.cos(phi)*r,tip[1]-.01,tip[2]+Math.sin(phi)*r]],.002,.0005,soft,12);}}
   if(has(a,'livingReef'))for(let j=0;j<dev.repeats;j++){const phi=j/dev.repeats*TAU;path([tip,[tip[0]+Math.cos(phi)*.12,tip[1]+.2,tip[2]+Math.sin(phi)*.12]],.016,.002,soft,20);}
   if(has(a,'thermalBloom')&&i===dev.branches-1)for(let j=0;j<9;j++){const phi=j/9*TAU;leaf(tip,.25,.05,phi,material('#bf9366'),dev.bend);}
  }
 }
 if(has(a,'aerostat'))for(let i=0;i<Math.max(2,Math.round(dev.branches/2));i++){
  const n=Math.max(2,Math.round(dev.branches/2)),x=((i+.5)/n*1.5-.75)*L,y=B+.55;
  path([joint([x,B*.6,0],'gas bladder'),[x,y-.35,0]],.018,.014,soft,16);ellipsoid(x,y,0,.24,.45+.16*a.shape[1],.26,membraneMaterial(pale,.38));
  for(let j=0;j<8;j++){const t=j/8*TAU;path([[x,y-.43,0],[x+Math.cos(t)*.24,y,Math.sin(t)*.26],[x,y+.43,0]],.003,.002,soft,24);}
 }
 if(!micro){
  if(has(a,'gills'))for(const side of [-1,1])for(let i=0;i<4;i++){const x=L*.5-i*.04;path([mount([x,B*.5,side*B*.5]),mount([x+.025,.01,side*B*.76]),mount([x-.02,B*.12,side*B*.52])],.006,.003,soft,20);}
  if(has(a,'camera')||has(a,'compound')){const count=plan==='radial'?dev.repeats:2;for(let i=0;i<count;i++){const t=i/count*TAU;eye(...joint([plan==='axial'?L*.74:Math.cos(t)*.58,B*.2,plan==='axial'?(i?1:-1)*B*.61:Math.sin(t)*.58],'eye'),.058+(has(a,'compound')?.02:0));}}
  else if(has(a,'eyespot'))ellipsoid(...joint([L*.7,B*.3,B*.55],'eyespot'),.024,.022,.017,eyeMat);
  if(has(a,'antennae')||has(a,'chemoreceptor'))for(const side of [-1,1])antenna(L*.83,B*.1,side*B*.36,side,has(a,'crystalSense'));
  if(has(a,'jaws'))for(const side of [-1,1])path([joint([L*.92,-.03,side*.06],'jaw'),[L+.09,-.03,side*.06],[L+.14,-.015,side*.012]],.018,.002,hard,20);
  region='propulsion';
  if(has(a,'jet')){const tube=add(new THREE.LatheGeometry([new THREE.Vector2(.03,0),new THREE.Vector2(.065,.1),new THREE.Vector2(.04,.2)],24),soft,joint([L*.4,-B*.65,0],'jet'));tube.scale.setScalar(dev.appendage/1.075);tube.rotation.z=.8;}
  region='protection';
  if(has(a,'spines')&&plan==='axial')for(let i=0;i<dev.repeats;i++){const x=((i+.5)/dev.repeats*1.7-.85)*L;path([joint([x,B,0],'spine'),[x-.025,mount([x,B,0])[1]+.15*dev.appendage,0]],.016*(dev.protection.thickness/.025),.001,hard,16);}
  region='body';
  if(has(a,'biolum'))for(let i=0;i<dev.repeats;i++){const x=((i+.5)/dev.repeats*1.6-.8)*L;ellipsoid(...joint([x,B*.56,B*.48],'light organ'),.016,.015,.012,material('#d4e4a6',{emissive:'#b9ce85',emissiveIntensity:1}));}
 }
 const anatomyStart=root.children.length;
 // Macroscopic organs share anatomical landmarks; inherited cell structures are internalized.
 if(!micro&&!flora&&anatomy){internal([0,-.04,0],.48);if(has(a,'nerve')||has(a,'memory')){path([[-L*.65,0,.1],[0,.015,.1],[L*.55,.04,.06]],.014,.007,material('#a3bec4',{emissive:'#648d9b',emissiveIntensity:.2}));for(let i=0;i<(has(a,'memory')?9:6);i++)ellipsoid(i*.13-.5,0,.1,.017,.025,.019,soft);}if(has(a,'endoskeleton')||has(a,'notochord'))for(let i=0;i<10;i++){const x=i*.17-.75;ellipsoid(x,0,0,.045,.065,.06,soft);for(const k of [-1,1])path([[x,0,0],[x+.05,-.08,k*.16],[x+.08,-.19,k*.2]],.008,.003,soft,22);}}
 if(anatomy&&!micro){
  const organs=[['toxin','#aa829d',.12,.1],['ink','#67556f',-.15,-.04],['lungs','#b99085',-.22,-.09],['vacuole','#9fc2b4',-.4,-.03],['endothermy','#c79b73',.14,-.06],['osmotic','#9cbcc6',-.55,.03],['pheromone','#c2b190',.4,.1]];
  for(const [id,c,x,y] of organs)if(has(a,id))ellipsoid(x,y,.07,.045,.064,.04,material(c,{transparent:true,opacity:.65}));
  if(has(a,'eggs')||has(a,'brood'))for(let i=0;i<(has(a,'brood')?6:3);i++)ellipsoid(-.24+i*.04,-.11,.06,.023,.03,.024,soft);
  if(has(a,'echolocation'))for(const k of [-1,1])leaf([.5,k*.05,.1],.15,.075,k*.55,clear,.025);
 }
 if(anatomy&&!micro){const parts=root.children.slice(anatomyStart),group=new THREE.Group();root.add(group);parts.forEach(m=>group.add(m));group.scale.set(L/1.195,plan==='radial'?.45:B/.385,B/.385);}
 if(!micro&&!flora&&has(a,'insulation'))for(let i=0;i<65;i++){const t=i/65*TAU,x=Math.cos(t)*L*.8,y=Math.sin(t)*B*.75;path([mount([x,y,.08]),mount([x,y,.08]).map((v,k)=>v+(k===1?.025:.004))],.0017,.0002,soft,5);}
 if(!micro&&has(a,'regeneration'))for(let i=0;i<6;i++){const x=(i-2.5)*L*.14;path([mount([x,-B*.2,B*.6]),mount([x,B*.4,B*.6])],.002,.001,material(pale),12);}
 if(!micro&&!flora&&has(a,'dormancy'))for(let i=0;i<5;i++)path([mount([(i-2)*L*.13,-B*.3,B*.6]),mount([(i-2)*L*.13,B*.4,B*.6])],.003,.001,soft,12);
 if(has(a,'camouflage')&&!micro&&!flora&&plan==='axial')for(let i=0;i<50;i++){const x=(noise(i,3)*1.7-.85)*L,y=(noise(i,7)-.5)*B*1.1,q=1-(x/L)**2-(y/B)**2;if(q>.2)ellipsoid(...mount([x,y,B*.72*Math.sqrt(q)]),.02+noise(i,9)*.025,.012,.003,material(dark,{roughness:.8}));}
 region='protection';
 if(has(a,'silica'))for(let i=0;i<16;i++){const x=(i/15*1.7-.85)*L;const crystal=add(new THREE.OctahedronGeometry(.065,0),material(base.clone().lerp(new THREE.Color('#c6dce4'),.6),{roughness:.14,metalness:.12,transparent:true,opacity:.88}),joint([x,B,.07],'silica'));crystal.scale.set(.7,1.6,.9);crystal.rotation.z=.15*Math.sin(i);}
 region='body';
 if(has(a,'radiant')){for(let i=0;i<24;i++){const t=i/24*TAU;ellipsoid(...mount([Math.cos(t)*L*.6,Math.sin(t)*B,.035]),.009,.009,.009,material('#ccbb80',{emissive:'#ccbb80',emissiveIntensity:.8}));}}
 if(has(a,'hive')||has(a,'schooling'))for(let i=0;i<9;i++)ellipsoid(...mount([(i-4)*L*.08,flora?-.1:B*.5,B*.55]),.008,.009,.007,material('#a3cdd2',{emissive:'#679fa8',emissiveIntensity:.5}));
 // Apply growth to the entire assembly so organ roots and animated groups remain attached.
 for(const child of root.children){child.position.multiplyScalar(dev.scale);child.scale.multiplyScalar(dev.scale);}
 for(const attachment of attachments)attachment.point=attachment.point.map(value=>value*dev.scale);
 for(const cell of cells){cell.p=cell.p.map(value=>value*dev.scale);cell.s*=dev.scale;}
 // Normalize to a shared specimen scale without altering anatomical proportions.
 const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());for(const child of root.children)child.position.sub(center);root.scale.setScalar(2.6/Math.max(size.x,size.y,size.z));
 root.userData={region:null,signature:a.traits.join(','),genes:g,motions,development:dev,bodyPlan:dev.label,plan,modules:dev.modules,anatomy,materials,attachments,normalization:{center:center.toArray(),scale:2.6/Math.max(size.x,size.y,size.z)},cells:micro?cells:[],fit:{width:size.x*2.6/Math.max(size.x,size.y,size.z),height:size.y*2.6/Math.max(size.x,size.y,size.z),depth:size.z*2.6/Math.max(size.x,size.y,size.z)},pose:has(a,'flight')?.8:plan==='radial'?.55:.2};return root;
}
export function focusOrganism(object,region){
 if(object.userData.region===region)return;object.userData.region=region;
 object.traverse(mesh=>{if(!mesh.isMesh)return;if(!mesh.userData.focusMaterial){mesh.material=mesh.material.clone();mesh.userData.focusMaterial=true;mesh.userData.emissive=mesh.material.emissive.clone();mesh.userData.emissiveIntensity=mesh.material.emissiveIntensity;object.userData.materials.push(mesh.material);}const selected=region&&mesh.userData.region===region;mesh.material.emissive.copy(selected?new THREE.Color('#74e7c0'):mesh.userData.emissive);mesh.material.emissiveIntensity=selected?.24:mesh.userData.emissiveIntensity;});
}
export function disposeOrganism(object){const geometries=new Set(),materials=new Set(object.userData.materials);object.traverse(m=>{if(m.geometry&&m.geometry!==sphere)geometries.add(m.geometry);if(m.material)materials.add(m.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
