import * as L from './lib.js';
const {THREE,add,S,C,toon}=L;
// 주머니늑대 — 늑대 얼굴, 등 뒤쪽 줄무늬, 뻣뻣한 꼬리, 배의 주머니(뒤로 열림)
export function makeThylacine(parent,{scale=1,fur=0xd29a5c,dark=0x4a2c1c,belly=0xf0d2a4,joey=false}={}){
 const g=new THREE.Group();g.scale.setScalar(scale);parent.add(g);const rig=new THREE.Group();g.add(rig);
 const furC=toon(fur),darkC=toon(dark),bellyC=toon(belly),eyeM=new THREE.MeshBasicMaterial({color:0x1a1420});
 const body=add(rig,S(1,32,24),furC,[0,1.05,0],[.55,.55,1.25]);
 add(rig,S(1,24,16),bellyC,[0,.86,.25],[.42,.32,.8],null,false);
 // 줄무늬: 몸통 뒤쪽 위를 감싸는 반원
 const stripes=[];for(let i=0;i<9;i++){const z=-1.05+i*.15;const r=.55*Math.sqrt(Math.max(0,1-(z/1.25)**2))*1.015;
  const s=new THREE.Mesh(new THREE.TorusGeometry(r,.045,6,24,Math.PI*.9),darkC);s.position.set(0,1.05,z);s.rotation.z=Math.PI*.05;rig.add(s);stripes.push(s);}
 const tail=add(rig,new THREE.ConeGeometry(.17,1.5,12),furC,[0,.98,-1.9],null,[-Math.PI/2+.12,0,0]);
 for(let i=0;i<3;i++){const tz=-1.4-i*.18;const tr=.16-i*.02;const s=new THREE.Mesh(new THREE.TorusGeometry(tr,.03,6,16,Math.PI),darkC);s.position.set(0,1.0-i*.02,tz);rig.add(s);}
 // 주머니(뒤쪽으로 열림) + 새끼
 const pouch=add(rig,S(.32,20,14),bellyC,[0,.5,-.4],[1,.6,1.1]);
 const jo=new THREE.Group();jo.position.set(0,.56,-.86);jo.scale.setScalar(1.2);rig.add(jo);add(jo,S(.15,16,12),furC,[0,0,0],[1,1,1.2]);
 for(const s of[-1,1]){add(jo,S(.06,10,8),furC,[s*.09,.13,0],[.7,1,.4]);add(jo,S(.03,8,6),eyeM,[s*.06,.03,-.14],null,null,false);}
 add(jo,S(.04,8,6),eyeM,[0,-.03,-.19],null,null,false);jo.visible=joey;
 // 머리
 const neck=new THREE.Group();neck.position.set(0,1.38,1.15);rig.add(neck);
 const head=new THREE.Group();neck.add(head);
 add(head,S(.42,28,20),furC,[0,0,0],[.9,.8,1]);
 add(head,S(.3,20,14),furC,[0,-.06,.42],[.62,.52,1.15]);
 add(head,S(.07,12,8),eyeM,[0,-.02,.78],null,null,false);
 for(const s of[-1,1])add(head,S(.06,8,6),darkC,[s*.1,.12,.22],[.5,.4,1.6],null,false);// 이마 줄
 const ears=[];for(const s of[-1,1])ears.push(add(head,S(.17,16,12),furC,[s*.24,.36,-.08],[.75,1,.35],[0,0,s*-.25]));
 for(const e of ears)add(e,S(.12,12,8),toon(0xe8a888),[0,-.05,.25],[.7,.75,.4],null,false);
 const eyes=[];for(const s of[-1,1]){const e=new THREE.Group();e.position.set(s*.2,.08,.3);head.add(e);add(e,S(.09,14,10),toon(0xfffaf0));const p=add(e,S(.055,10,8),eyeM,[0,0,.05],null,null,false);add(p,S(.018,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),[.02,.02,.04],null,null,false);eyes.push(e);}
 const blush=[];for(const s of[-1,1])blush.push(add(head,S(.07,12,8),new THREE.MeshBasicMaterial({color:0xff9aa8,transparent:true,opacity:.75}),[s*.27,-.08,.27],[1,.55,.35],null,false));
 const jaw=new THREE.Group();jaw.position.set(0,-.2,.12);head.add(jaw);
 add(jaw,S(.2,16,12),furC,[0,-.02,.4],[.55,.3,1.4]);
 const mouth=add(head,S(.2,14,10),toon(0xc8505a),[0,-.2,.42],[.45,.12,1.2],null,false);
 const teeth=[];for(const s of[-1,1]){teeth.push(add(head,new THREE.ConeGeometry(.025,.08,6),toon(0xffffff),[s*.06,-.17,.62],null,[Math.PI,0,0],false));teeth.push(add(jaw,new THREE.ConeGeometry(.025,.08,6),toon(0xffffff),[s*.06,.07,.6],null,null,false));}
 const legs=[];for(const [x,z] of[[-.28,.75],[.28,.75],[-.28,-.75],[.28,-.75]]){const l=new THREE.Group();l.position.set(x,.75,z);g.add(l);add(l,C(.12,.09,.72,10),furC,[0,-.36,0]);add(l,S(.12,12,8),darkC,[0,-.72,.06],[1,.55,1.4]);legs.push(l);}
 const api={g,rig,head,neck,jaw,legs,ears,eyes,tail,stripes,joey:jo,pouch,
  idle(t,ph=0){const br=Math.sin(t*2.6+ph)*.02;body.scale.set(.55+br,.55-br,1.25);ears.forEach((e,i)=>e.rotation.x=Math.sin(t*3+ph+i)*.1);tail.rotation.y=Math.sin(t*1.5+ph)*.06;
   const blink=(((t+ph)%2.9)<.1)?.1:1;eyes.forEach(e=>e.scale.y=blink);jo.position.y=.47+Math.sin(t*3+ph)*.02;},
  walk(t,sp=1,ph=0){const w=t*5*sp+ph;legs.forEach((l,i)=>l.rotation.x=Math.sin(w+((i===0||i===3)?0:Math.PI))*.45);rig.position.y=Math.abs(Math.sin(w))*.05;neck.rotation.x=Math.sin(w*2)*.03;},
  open(k){jaw.rotation.x=k*1.05;head.rotation.x=-k*.35;}};
 return api;}
export function makeSheep(parent,s=1){const g=new THREE.Group();g.scale.setScalar(s);parent.add(g);const wool=toon(0xfaf6ee),skin=toon(0x3a2e2e);const r=L.rnd(9);
 add(g,S(.7,20,14),wool,[0,1,0],[1,.85,1.25]);for(let i=0;i<10;i++){const a=r()*6.28,b=r()*1.2;add(g,S(.3,12,8),wool,[Math.cos(a)*.55,1+Math.sin(b)*.45,Math.sin(a)*.75],null,null,false);}
 const head=new THREE.Group();head.position.set(0,1.25,.95);g.add(head);add(head,S(.3,16,12),skin,[0,0,0],[.85,1,1.1]);add(head,S(.25,12,8),wool,[0,.22,-.05],null,null,false);
 for(const x of[-1,1]){add(head,S(.12,10,8),skin,[x*.28,.05,-.05],[1.4,.5,.6],null,false);add(head,S(.06,10,8),toon(0xffffff),[x*.13,.08,.25],null,null,false);add(head,S(.03,8,6),new THREE.MeshBasicMaterial({color:0x111111}),[x*.13,.08,.3],null,null,false);}
 const legs=[];for(const [x,z] of[[-.3,.5],[.3,.5],[-.3,-.5],[.3,-.5]]){const l=new THREE.Group();l.position.set(x,.5,z);g.add(l);add(l,C(.08,.08,.55,8),skin,[0,-.27,0]);legs.push(l);}
 return {g,head,legs};}
export function counterSprite(o={}){const sp=L.textSprite(' ',o);const c=sp.material.map.image;const x=c.getContext('2d');const {size=220,fill='#fff6c8',stroke='#2a1d2e'}=o;let last=null;
 sp.set=txt=>{if(txt===last)return;last=txt;x.clearRect(0,0,c.width,c.height);x.font=`900 ${size}px NK, sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=size*.12;x.strokeStyle=stroke;x.strokeText(txt,c.width/2,c.height/2+size*.05);x.fillStyle=fill;x.fillText(txt,c.width/2,c.height/2+size*.05);sp.material.map.needsUpdate=true;};return sp;}
export function poster(){const c=document.createElement('canvas');c.width=512;c.height=680;const x=c.getContext('2d');x.fillStyle='#f1dfb4';x.fillRect(0,0,512,680);x.strokeStyle='#7a5a3a';x.lineWidth=14;x.strokeRect(14,14,484,652);
 x.fillStyle='#5a3a22';x.textAlign='center';x.font='900 96px NK, serif';x.fillText('WANTED',256,130);x.font='900 70px NK';x.fillText('현상금',256,560);x.font='900 92px NK';x.fillStyle='#b0322a';x.fillText('£1',256,650);
 // 단순한 주머니늑대 옆모습 실루엣
 x.fillStyle='#6a4a30';x.beginPath();x.ellipse(250,330,140,62,0,0,7);x.fill();x.beginPath();x.ellipse(395,280,58,42,-.2,0,7);x.fill();x.beginPath();x.moveTo(110,330);x.lineTo(20,365);x.lineTo(115,350);x.fill();
 for(const lx of[150,200,300,350]){x.fillRect(lx,360,22,90);}x.fillStyle='#2e1d12';for(let i=0;i<7;i++){x.fillRect(140+i*20,275,9,70);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.92),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));return m;}
