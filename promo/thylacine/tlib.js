// Thylacine episode models - same grammar as lib.js (toon 3D). Everything faces +z.
import * as L from './lib.js';
const {THREE,add,S,C,toon}=L;

const eyeM=()=>new THREE.MeshBasicMaterial({color:0x1a1420});
const white=()=>new THREE.MeshBasicMaterial({color:0xffffff});
function eye(parent,pos,r=.13){const e=add(parent,S(r,14,10),toon(0xffffff),pos);add(e,S(r*.62,10,8),eyeM(),[0,0,r*.7],null,null,false);
 add(e,S(r*.24,8,6),white(),[r*.18,r*.22,r*1.15],null,null,false);return e;}

// Thylacine: sandy body, dark stripes on lower back, round ears, long snout, stiff thick tail, belly pouch
export function makeThylacine(parent,{scale=1,fur=0xd2a56c,belly=0xf0d6a8,stripe=0x4a3024,joey=false,bw=false}={}){
 const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);
 const grey=c=>{if(!bw)return c;const r=(c>>16&255),gg=(c>>8&255),b=c&255;const y=Math.round(r*.3+gg*.59+b*.11);return (y<<16)|(y<<8)|y;};
 const furM=toon(grey(fur)),bellyM=toon(grey(belly)),stM=toon(grey(stripe)),noseM=toon(grey(0x2a1d22));
 const rig=new THREE.Group();g.add(rig);
 const body=add(rig,S(1,32,22),furM,[0,1.3,-.2],[.8,.74,1.4]);
 add(rig,S(.7,24,16),bellyM,[0,1.04,.1],[.64,.42,1.0],null,false);
 const stripes=[];for(let i=0;i<7;i++){const z=-.15-i*.17;const k=Math.sqrt(Math.max(0,1-Math.pow((z+.2)/1.4,2)));
  const st=add(rig,new THREE.TorusGeometry(.75*k,.06,6,24,Math.PI*.9),stM,[0,1.32,z],[1.07,1,1],[0,0,Math.PI*.05],false);stripes.push(st);}
 const pouch=add(rig,S(.42,18,12),bellyM,[0,.7,-.3],[1,.62,1.05]);
 let baby=null;if(joey){baby=new THREE.Group();baby.position.set(0,.86,0);rig.add(baby);add(baby,S(.22,16,12),furM,[0,0,0]);
  for(const s of[-1,1]){add(baby,S(.08,10,8),furM,[s*.13,.16,-.02],[1,1.4,.6]);eye(baby,[s*.08,.04,.18],.05);}add(baby,S(.05,8,6),noseM,[0,-.03,.23],null,null,false);}
 const legs=[];for(const [x,z] of [[-.38,.8],[.38,.8],[-.4,-1.05],[.4,-1.05]]){const l=new THREE.Group();l.position.set(x,1.0,z);rig.add(l);
  add(l,C(.21,.17,.95,12),furM,[0,-.47,0]);add(l,S(.21,14,10),furM,[0,-.93,.1],[1.05,.6,1.45]);legs.push(l);}
 const tail=new THREE.Group();tail.position.set(0,1.36,-1.5);rig.add(tail);
 add(tail,new THREE.ConeGeometry(.3,1.45,14),furM,[0,-.08,-.62],null,[-Math.PI/2+.35,0,0]);
 const head=new THREE.Group();head.position.set(0,2.1,1.25);head.scale.setScalar(1.25);rig.add(head);
 add(head,S(.62,28,20),furM,[0,0,0],[1,.92,1]);
 add(head,S(.4,22,16),furM,[0,-.12,.72],[.66,.55,1.4]);
 add(head,S(.1,10,8),noseM,[0,-.04,1.27],[1.2,.9,1]);
 const mouth=add(head,S(.3,16,12),new THREE.MeshBasicMaterial({color:0x5a2630}),[0,-.3,.78],[.55,.05,1.05],null,false);
 const jaw=new THREE.Group();jaw.position.set(0,-.3,.3);head.add(jaw);
 add(jaw,S(.3,16,12),bellyM,[0,-.05,.48],[.6,.3,1.35]);
 for(const s of[-1,1])add(jaw,new THREE.ConeGeometry(.04,.12,6),white(),[s*.1,.06,.85],null,null,false);
 const ears=[];for(const s of[-1,1]){const e=add(head,S(.26,16,12),furM,[s*.36,.52,-.12],[.75,1.15,.32],[0,0,s*-.25]);
  add(e,S(.17,12,8),toon(grey(0xe8b59a)),[0,-.02,.2],[.75,.85,.3],null,false);ears.push(e);eye(head,[s*.27,.12,.48],.13);}
 for(const s of[-1,1])add(head,S(.1,10,8),new THREE.MeshBasicMaterial({color:bw?0xb0b0b0:0xf29a9a,transparent:true,opacity:.6}),[s*.42,-.12,.42],[1,.6,.4],null,false);
 const api={g,rig,head,jaw,tail,legs,body,ears,baby,
  idle(t,ph=0){const br=Math.sin(t*2.6+ph)*.015;body.scale.set(.8+br,.74-br,1.4);tail.rotation.y=Math.sin(t*1.7+ph)*.08;ears.forEach((e,i)=>e.rotation.x=Math.sin(t*3+i+ph)*.08);
   if(baby){baby.position.y=.86+Math.max(0,Math.sin(t*2.2+ph))*.07;baby.rotation.y=Math.sin(t*1.3)*.3;}},
  walk(t,sp=1,ph=0){const w=t*6*sp+ph;legs.forEach((l,i)=>l.rotation.x=Math.sin(w+(i===1||i===2?Math.PI:0))*.5);
   rig.position.y=Math.abs(Math.sin(w))*.06;head.rotation.x=Math.sin(w*2)*.03;tail.rotation.x=Math.sin(w*2)*.05;},
  gape(k){jaw.rotation.x=k*.9;mouth.scale.set(.55,.05+k*.55,1.05);mouth.position.y=-.3-k*.12;}};
 return api;}

// Kangaroo - standing on tail, for comparison
export function makeKangaroo(parent,{scale=1,fur=0xc0784a}={}){const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);const furM=toon(fur),pale=toon(0xf0d2b0);
 const rig=new THREE.Group();g.add(rig);
 add(rig,S(.9,28,20),furM,[0,1.7,-.1],[.85,1.25,.8],[.25,0,0]);add(rig,S(.6,20,14),pale,[0,1.55,.4],[.75,1.05,.5],null,false);
 add(rig,S(.42,16,12),pale,[0,1.15,.48],[1,.65,.6]);
 for(const s of[-1,1]){add(rig,S(.5,18,12),furM,[s*.45,.75,-.1],[.6,.8,1.1]);add(rig,S(.2,12,8),furM,[s*.42,.08,.45],[.7,.35,2.4]);
  add(rig,C(.1,.08,.8,8),furM,[s*.4,1.95,.55],null,[.9,0,s*.2]);}
 add(rig,new THREE.ConeGeometry(.28,2.4,10),furM,[0,.55,-1.2],null,[-1.25,0,0]);
 const head=new THREE.Group();head.position.set(0,3.05,.15);rig.add(head);add(head,S(.5,22,16),furM,[0,0,0],[.9,.95,1.05]);
 add(head,S(.3,16,12),furM,[0,-.1,.48],[.8,.7,1]);add(head,S(.08,8,6),toon(0x2a1d22),[0,-.02,.78]);
 for(const s of[-1,1]){add(head,new THREE.ConeGeometry(.17,.7,10),furM,[s*.24,.62,-.1],[1,1,.45],[0,0,s*-.2]);eye(head,[s*.22,.1,.38],.11);}
 return {g,rig,head,idle(t,ph=0){rig.position.y=Math.max(0,Math.sin(t*3+ph))*.1;head.rotation.z=Math.sin(t*1.4+ph)*.1;}};}

// Sheep - fluffy ball
export function makeSheep(parent,{scale=1}={}){const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);const wool=toon(0xfbf7ee),face=toon(0x3a3034);
 const rig=new THREE.Group();g.add(rig);const r=L.rnd(9);
 for(let i=0;i<11;i++)add(rig,S(.55+r()*.15,16,12),wool,[(r()-.5)*1.2,1.45+(r()-.5)*.6,(r()-.5)*1.7]);
 for(const [x,z] of [[-.4,.6],[.4,.6],[-.4,-.6],[.4,-.6]])add(rig,C(.12,.1,.9,8),face,[x,.45,z]);
 const head=new THREE.Group();head.position.set(0,1.75,1.15);rig.add(head);add(head,S(.42,18,12),face,[0,0,0],[.85,1,1.1]);add(head,S(.4,16,12),wool,[0,.32,-.05],[1,.55,.9]);
 for(const s of[-1,1]){add(head,S(.15,10,8),face,[s*.42,.05,-.05],[1.6,.5,.7]);eye(head,[s*.18,.08,.36],.1);}
 return {g,rig,head,idle(t,ph=0){rig.position.y=Math.max(0,Math.sin(t*2+ph))*.04;head.rotation.y=Math.sin(t*.9+ph)*.2;}};}

// Canvas plane (poster, calendar, title)
export function canvasPlane(w,h,draw,{px=512}={}){const c=document.createElement('canvas');c.width=px;c.height=Math.round(px*h/w);const x=c.getContext('2d');draw(x,c.width,c.height);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true}));m.userData.redraw=f=>{x.clearRect(0,0,c.width,c.height);f(x,c.width,c.height);tex.needsUpdate=true;};return m;}

// Zoo cage - floor, bars, roof, little hut
export function makeCage(parent,{w=6,d=4,h=3.4}={}){const g=new THREE.Group();parent.add(g);const metal=toon(0x6b7280),wood=toon(0x7a5236);
 add(g,new THREE.BoxGeometry(w,.25,d),toon(0x8b7a62),[0,.12,0]);
 for(let i=0;i<=14;i++){const x=-w/2+i*w/14;add(g,C(.05,.05,h,6),metal,[x,h/2,d/2]);add(g,C(.05,.05,h,6),metal,[x,h/2,-d/2]);}
 for(let i=1;i<10;i++){const z=-d/2+i*d/10;add(g,C(.05,.05,h,6),metal,[-w/2,h/2,z]);add(g,C(.05,.05,h,6),metal,[w/2,h/2,z]);}
 add(g,new THREE.BoxGeometry(w+.4,.2,d+.4),wood,[0,h,0]);add(g,new THREE.BoxGeometry(w,.12,.12),metal,[0,h*.92,d/2]);
 add(g,new THREE.BoxGeometry(1.8,1.3,1.4),wood,[-w/2+1.2,.9,-d/2+1]);return g;}
