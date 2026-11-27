import * as L from './lib.js';
const {THREE,add,S,C,toon}=L;
const eyeM=()=>new THREE.MeshBasicMaterial({color:0x1a1420});
// 콤프소그나투스 — 닭만 한 두 발 공룡, 긴 꼬리, 긴 목, 작은 앞발, 큰 눈
export function makeCompy(parent,{scale=1,skin=0x8cc46a,dark=0x4f8a44,belly=0xf3e6b8}={}){
 const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);const rig=new THREE.Group();g.add(rig);
 const sk=toon(skin),dk=toon(dark),bl=toon(belly),em=eyeM();
 const body=add(rig,S(1,32,24),sk,[0,1.15,0],[.42,.45,.72]);
 add(rig,S(1,24,16),bl,[0,1.02,.1],[.32,.3,.55],null,false);
 for(let i=0;i<4;i++){const z=-.35+i*.22;const s=add(rig,S(.1,10,8),dk,[0,1.56,z],[1.6,.35,.9],null,false);}
 // 꼬리: 마디가 이어지는 원뿔 사슬
 const tail=[];let par=rig;let pos=[0,1.2,-.6];
 for(let i=0;i<6;i++){const seg=new THREE.Group();seg.position.set(...pos);par.add(seg);const r=.22-i*.032;
  add(seg,C(Math.max(.03,r-.032),r,.42,12),sk,[0,0,-.2],null,[Math.PI/2,0,0]);if(i%2===0)add(seg,S(.06,8,6),dk,[0,r*.85,-.2],[1.4,.4,1.2],null,false);
  tail.push(seg);par=seg;pos=[0,0,-.4];}
 // 목·머리
 const neck=new THREE.Group();neck.position.set(0,1.35,.55);rig.add(neck);
 add(neck,C(.12,.17,.6,12),sk,[0,.24,.08],null,[.45,0,0]);
 const head=new THREE.Group();head.position.set(0,.6,.22);neck.add(head);
 add(head,S(.3,28,20),sk,[0,0,0],[.9,.85,1]);
 add(head,S(.22,20,14),sk,[0,-.06,.3],[.7,.55,1.2]);
 add(head,S(.17,16,12),bl,[0,-.13,.28],[.62,.3,1.1],null,false);
 for(const s of[-1,1])add(head,S(.025,8,6),em,[s*.06,-.02,.56],null,null,false);// 콧구멍
 const eyes=[];for(const s of[-1,1]){const e=new THREE.Group();e.position.set(s*.17,.07,.13);head.add(e);add(e,S(.12,16,12),toon(0xfffaf0));
  const p=add(e,S(.075,12,10),em,[s*.02,0,.06],null,null,false);add(p,S(.025,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),[.02,.03,.05],null,null,false);eyes.push(e);}
 const blush=[];for(const s of[-1,1])blush.push(add(head,S(.055,12,8),new THREE.MeshBasicMaterial({color:0xff9aa8,transparent:true,opacity:.75}),[s*.2,-.1,.2],[1,.55,.35],null,false));
 add(head,S(.07,10,8),dk,[0,.26,-.02],[.6,.5,1.6],null,false);// 머리 볏
 const jaw=new THREE.Group();jaw.position.set(0,-.14,.12);head.add(jaw);add(jaw,S(.15,14,10),sk,[0,0,.2],[.6,.25,1.3]);
 const teeth=[];for(const s of[-1,1])teeth.push(add(head,new THREE.ConeGeometry(.02,.06,6),toon(0xffffff),[s*.07,-.17,.42],null,[Math.PI,0,0],false));
 // 앞발
 const arms=[];for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*.28,1.12,.45);rig.add(a);add(a,C(.04,.05,.32,8),sk,[0,-.14,.04],null,[.6,0,0]);
  for(let k=-1;k<=1;k+=2)add(a,new THREE.ConeGeometry(.02,.08,5),toon(0xfff3dd),[k*.02,-.3,.14],null,[2.2,0,0],false);arms.push(a);}
 // 뒷다리: 허벅지 → 정강이 → 발
 const legs=[];for(const s of[-1,1]){const hip=new THREE.Group();hip.position.set(s*.26,1.05,-.05);g.add(hip);
  add(hip,S(.2,16,12),sk,[0,-.12,.05],[.75,1.2,1]);const kn=new THREE.Group();kn.position.set(0,-.4,.12);hip.add(kn);
  add(kn,C(.05,.07,.55,10),sk,[0,-.26,-.08],null,[-.35,0,0]);const ft=new THREE.Group();ft.position.set(0,-.52,-.2);kn.add(ft);
  for(let k=-1;k<=1;k++)add(ft,C(.03,.035,.24,6),toon(0xd9a85a),[k*.06,-.05,.1],null,[Math.PI/2-.15,0,k*.25],false);legs.push(hip);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true});
 const api={g,rig,head,neck,jaw,eyes,tail,legs,arms,blush,body,
  idle(t,ph=0){const br=Math.sin(t*3+ph)*.02;body.scale.set(.42+br,.45-br,.72);tail.forEach((s,i)=>s.rotation.y=Math.sin(t*2+ph-i*.5)*.08);tail.forEach((s,i)=>s.rotation.x=.04+Math.sin(t*1.7+ph-i*.4)*.03);
   const blink=(((t+ph)%3.1)<.1)?.1:1;eyes.forEach(e=>e.scale.y=blink);arms.forEach((a,i)=>a.rotation.x=Math.sin(t*3+i)*.1);},
  walk(t,sp=1,ph=0){const w=t*7*sp+ph;legs.forEach((l,i)=>l.rotation.x=Math.sin(w+i*Math.PI)*.55);rig.position.y=Math.abs(Math.sin(w))*.06;rig.rotation.x=.05*sp;neck.rotation.x=Math.sin(w*2)*.05;tail.forEach((s,i)=>s.rotation.y=Math.sin(w-i*.6)*.1);},
  open(k){jaw.rotation.x=k*.8;head.rotation.x=-k*.25;},
  tilt(k){head.rotation.z=k*.42;head.rotation.y=k*.15;}};
 return api;}
// 바바리사우루스 같은 작은 도마뱀
export function makeLizard(parent,{scale=1,c=0x6fa0b8,d=0x3e6478}={}){const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);const sk=toon(c),dk=toon(d);
 add(g,S(.5,20,14),sk,[0,.18,0],[.32,.2,1]);add(g,S(.2,16,12),sk,[0,.22,.6],[.9,.7,1.3]);
 for(const s of[-1,1]){add(g,S(.04,8,6),eyeM(),[s*.1,.3,.7],null,null,false);}
 const tail=add(g,new THREE.ConeGeometry(.12,1.3,10),sk,[0,.15,-1.05],null,[-Math.PI/2,0,0]);
 for(let i=0;i<4;i++)add(g,S(.05,8,6),dk,[0,.35,.35-i*.25],[1.6,.4,1],null,false);
 const legs=[];for(const [x,z] of[[-.3,.35],[.3,.35],[-.3,-.3],[.3,-.3]]){const l=add(g,C(.04,.04,.3,6),sk,[x,.1,z],null,[0,0,x>0?-1.1:1.1]);legs.push(l);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true});
 return {g,tail,legs,run(t,sp=1){legs.forEach((l,i)=>l.rotation.y=Math.sin(t*16*sp+i*Math.PI/2)*.5);g.children[0].rotation.y=Math.sin(t*16*sp)*.1;tail.rotation.y=Math.sin(t*16*sp)*.25;}};}
// 도마뱀 뼈 (배 속 화석 투시용)
export function makeLizardBones(parent,s=1){const g=new THREE.Group();g.scale.setScalar(s);parent.add(g);const m=new THREE.MeshBasicMaterial({color:0xfff6dc});
 for(let i=0;i<12;i++)add(g,S(.05,8,6),m,[0,0,.5-i*.11],[1,.8,.8],null,false);
 add(g,S(.12,10,8),m,[0,0,.68],[.9,.6,1.2],null,false);
 for(let i=0;i<5;i++)for(const s2 of[-1,1])add(g,C(.012,.012,.2,4),m,[s2*.1,0,.32-i*.1],null,[0,0,Math.PI/2],false);
 for(const [x,z] of[[-.14,.3],[.14,.3],[-.14,-.25],[.14,-.25]])add(g,C(.015,.015,.22,4),m,[x,0,z],null,[0,0,x>0?-1:1],false);return g;}
// 닭
export function makeChicken(parent,s=1){const g=new THREE.Group();g.scale.setScalar(s);parent.add(g);const w=toon(0xfffaf0),r=toon(0xe0483e),y=toon(0xf2b632);
 add(g,S(.5,20,14),w,[0,.75,0],[1,.95,1.15]);add(g,S(.3,16,12),w,[0,1.3,.32]);for(let i=0;i<3;i++)add(g,S(.08,8,6),r,[0,1.6,.25+i*.1],[.6,1,.8],null,false);
 add(g,new THREE.ConeGeometry(.08,.2,8),y,[0,1.28,.68],null,[Math.PI/2,0,0]);add(g,S(.07,8,6),r,[0,1.12,.55],[.6,1.2,.6],null,false);
 for(const sd of[-1,1])add(g,S(.04,8,6),eyeM(),[sd*.13,1.38,.55],null,null,false);for(let i=0;i<3;i++)add(g,S(.15,10,8),w,[0,1.05+i*.12,-.55-i*.05],[.4,1,.6],null,false);
 for(const sd of[-1,1])add(g,C(.04,.04,.4,6),y,[sd*.18,.2,0],null,null,false);g.traverse(o=>{if(o.isMesh)o.castShadow=true});return g;}
// 새의 조상(아르카이옵테릭스)
export function makeArchaeo(parent,s=1){const g=new THREE.Group();g.scale.setScalar(s);parent.add(g);const f=toon(0x4a6ec8),f2=toon(0x2e4a8a),sk=toon(0xe0b080);
 add(g,S(.42,20,14),f,[0,1.05,0],[.8,.85,1.05]);const head=new THREE.Group();head.position.set(0,1.55,.32);g.add(head);add(head,S(.24,18,12),f,[0,0,0]);
 add(head,new THREE.ConeGeometry(.08,.28,8),sk,[0,-.05,.3],null,[Math.PI/2,0,0]);for(const sd of[-1,1]){add(head,S(.08,10,8),toon(0xfffaf0),[sd*.12,.05,.14]);add(head,S(.045,8,6),eyeM(),[sd*.13,.05,.2],null,null,false);}
 const wings=[];for(const sd of[-1,1]){const w=new THREE.Group();w.position.set(sd*.32,1.15,0);g.add(w);add(w,S(.4,14,10),f2,[sd*.3,0,-.05],[1,.15,.55],[0,0,sd*-.3]);wings.push(w);}
 const tail=new THREE.Group();tail.position.set(0,1.0,-.4);g.add(tail);for(let i=0;i<5;i++)add(tail,S(.12,10,8),i%2?f:f2,[0,0,-.18-i*.18],[1.6,.25,1],null,false);
 for(const sd of[-1,1])add(g,C(.04,.04,.6,6),sk,[sd*.15,.35,0],null,null,false);g.traverse(o=>{if(o.isMesh)o.castShadow=true});
 return {g,head,wings,flap(t,k=1){wings.forEach((w,i)=>w.rotation.z=(i?-1:1)*Math.sin(t*14)*.6*k);}};}
// 고사리·소철 (쥐라기 식물)
export function fern(parent,x,z,s=1,c=0x4f9a44){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);parent.add(g);
 for(let i=0;i<7;i++){const a=i/7*6.28;add(g,S(.5,10,6),toon(c),[Math.cos(a)*.45,.35,Math.sin(a)*.45],[.25,.08,1],[0,-a+Math.PI/2,.5],false);}return g;}
export function cycad(parent,x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);parent.add(g);add(g,C(.25,.32,1,10),toon(0x8a6a44),[0,.5,0]);
 for(let i=0;i<8;i++){const a=i/8*6.28;add(g,S(.7,10,6),toon(0x3e8a40),[Math.cos(a)*.55,1.15,Math.sin(a)*.55],[.25,.06,1],[0,-a+Math.PI/2,-.5],false);}return g;}
// 운석
export function makeMeteor(parent,s=1){const g=new THREE.Group();g.scale.setScalar(s);parent.add(g);add(g,new THREE.IcosahedronGeometry(1,1),toon(0x5a4a44),[0,0,0]);
 const fire=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.9-i*.1,3+i*.4,12),new THREE.MeshBasicMaterial({color:[0xffe066,0xffb040,0xff7a3a,0xff5a3a,0xe84a3a,0xc83a3a][i],transparent:true,opacity:.75-i*.1}));m.position.set(0,1.6+i*.35,0);g.add(m);fire.push(m);}
 return {g,fire};}
