import * as THREE from 'three';
export {THREE};
export const W=1080,H=1920;
export const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const g=new Uint8Array([70,150,255]);export const grad=new THREE.DataTexture(g,3,1,THREE.RedFormat);grad.needsUpdate=true;grad.minFilter=grad.magFilter=THREE.NearestFilter;
export const toon=(c,o={})=>new THREE.MeshToonMaterial({color:c,gradientMap:grad,...o});
export const INK=0x2a1d2e;
const outlineMat=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
export function add(parent,geo,mat,pos=[0,0,0],scale,rot,outline=true,ow=1.045){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);
 if(outline){const o=new THREE.Mesh(geo,outlineMat);o.scale.setScalar(ow);m.add(o);}return m;}
export const S=(r=1,a=24,b=16)=>new THREE.SphereGeometry(r,a,b);
export const C=(a,b,h,n=12)=>new THREE.CylinderGeometry(a,b,h,n);
export const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
export const clamp01=t=>Math.min(1,Math.max(0,t));
export const easeIO=t=>{t=clamp01(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
export function rnd(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}

export function makeScene({sky=['#4a4f9e','#f99f8c','#ffd08a'],hemi=1.3,sunC=0xffd2a0,sunI=2.4,sunPos=[-6,8,6],fog}={}){
 const scene=new THREE.Scene();
 const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{a:{value:new THREE.Color(sky[0])},b:{value:new THREE.Color(sky[1])},c:{value:new THREE.Color(sky[2])}},
  vertexShader:`varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 a,b,c;varying vec3 p;void main(){float h=p.y;vec3 col=h>0.08?mix(b,a,smoothstep(.08,.6,h)):mix(c,b,smoothstep(-.15,.08,h));gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);}`});
 const sky_=new THREE.Mesh(new THREE.SphereGeometry(300,32,16),skyMat);scene.add(sky_);
 scene.add(new THREE.HemisphereLight(0xffe2c8,0x5a6a9a,hemi));
 const sun=new THREE.DirectionalLight(sunC,sunI);sun.position.set(...sunPos);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,far:60});sun.shadow.bias=-.0005;scene.add(sun);
 const rim=new THREE.DirectionalLight(0x9fd8ff,1.4);rim.position.set(5,4,-6);scene.add(rim);
 if(fog)scene.fog=new THREE.Fog(fog[0],fog[1],fog[2]);
 const cam=new THREE.PerspectiveCamera(38,W/H,.1,800);
 return {scene,cam,sun,sky:sky_};
}
export function sea(scene,color=0x3f86b8,r=300){const m=new THREE.Mesh(new THREE.CircleGeometry(r,64),toon(color));m.rotation.x=-Math.PI/2;m.position.y=-.02;m.receiveShadow=true;scene.add(m);return m;}
export function island(scene,{r=7,grassR=5,pos=[0,0,0],sandC=0xf2d39a,grassC=0x6fbf5a}={}){const gg=new THREE.Group();gg.position.set(...pos);scene.add(gg);
 const s=add(gg,C(r,r+1,.6,48),toon(sandC),[0,-.3,0],null,null,false);s.receiveShadow=true;
 const gr=add(gg,C(grassR*.85,grassR,.7,40),toon(grassC),[-r*.15,-.2,-r*.25],null,null,false);gr.receiveShadow=true;return gg;}
export function palm(parent,x,z,s=1,seed=1){const t=new THREE.Group();t.position.set(x,0,z);t.scale.setScalar(s);parent.add(t);
 for(let i=0;i<6;i++)add(t,C(.16,.2,.6,10),toon(0x8a5a3a),[Math.sin(i*.25)*.3*i/6,.3+i*.55,0],null,[0,0,-.08*i]);
 const top=new THREE.Group();top.position.set(.5,3.5,0);t.add(top);
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2+seed;add(top,S(1,12,8),toon(0x3e9d4a),[Math.cos(a),-.25,Math.sin(a)],[1.2,.12,.35],[0,-a,-.35]);}
 t.userData.top=top;return t;}
export function bush(parent,x,z,s=1,c=0x4fa84a){const b=new THREE.Group();b.position.set(x,0,z);b.scale.setScalar(s);parent.add(b);
 add(b,S(.8),toon(c),[0,.5,0]);add(b,S(.6),toon(c),[.7,.4,.1]);add(b,S(.55),toon(c),[-.6,.35,.2]);return b;}
export function tree(parent,x,z,s=1,c=0x3f9a4a){const t=new THREE.Group();t.position.set(x,0,z);t.scale.setScalar(s);parent.add(t);
 add(t,C(.25,.35,2.4,10),toon(0x7a5236),[0,1.2,0]);add(t,S(1.4),toon(c),[0,3.1,0],[1,.9,1]);add(t,S(1),toon(c),[.8,2.6,.2]);add(t,S(1),toon(c),[-.8,2.7,-.1]);return t;}

// 도도새
export function makeDodo(parent,{scale=1,body=0x9aa4b6}={}){
 const d=new THREE.Group();d.scale.setScalar(scale);parent.add(d);
 const rig=new THREE.Group();d.add(rig);
 const bodyC=toon(body),beakC=toon(0xd9c36a),tipC=toon(0x5a4a3a),legC=toon(0xe8b84a),white=toon(0xfffaf0),dark=new THREE.MeshBasicMaterial({color:0x1a1420});
 const b=add(rig,S(1,40,28),bodyC,[0,1.35,0],[1.05,1.0,1.15]);
 add(b,S(1,32,20),toon(0xc3c9d6),[0,-.15,.35],[.8,.75,.7],null,false);
 const tail=new THREE.Group();tail.position.set(0,1.75,-1.05);rig.add(tail);
 for(let i=0;i<5;i++)add(tail,S(.28,16,12),white,[(i-2)*.16,.15-Math.abs(i-2)*.05,0]);
 const wL=add(rig,S(.45,20,14),toon(0x7e889c),[-1.0,1.45,.05],[.35,.8,1],[0,0,.3]);
 const wR=add(rig,S(.45,20,14),toon(0x7e889c),[1.0,1.45,.05],[.35,.8,1],[0,0,-.3]);
 const legs=[];for(const s of[-1,1]){const leg=new THREE.Group();leg.position.set(s*.45,.8,.1);d.add(leg);
  add(leg,C(.12,.14,.75,10),legC,[0,-.37,0]);
  for(let k=-1;k<=1;k++)add(leg,C(.06,.06,.45,8),legC,[k*.12,-.72,.18],null,[Math.PI/2,0,k*.3]);legs.push(leg);}
 const neck=new THREE.Group();neck.position.set(0,2.15,.45);rig.add(neck);
 add(neck,S(.55,24,16),bodyC,[0,.15,0],[1,1.1,1]);
 const head=new THREE.Group();head.position.set(0,.75,.15);neck.add(head);
 add(head,S(.62,32,22),toon(0xa9b2c3));
 add(head,S(.45,20,14),toon(0xe9d9c0),[0,.05,.32],[.9,.8,.6],null,false);
 const beak=new THREE.Group();beak.position.set(0,-.05,.55);head.add(beak);
 add(beak,S(.3,24,16),beakC,[0,0,.35],[.8,.85,2.1]);
 add(beak,S(.22,20,14),tipC,[0,-.08,.92],[.85,1.1,.9],[.5,0,0]);
 add(beak,S(.14,16,12),tipC,[0,-.26,.98],[.8,1,.8]);
 const eyes=[];for(const s of[-1,1]){const e=new THREE.Group();e.position.set(s*.33,.15,.42);head.add(e);
  add(e,S(.17,20,14),white);const p=add(e,S(.1,16,12),dark,[0,0,.1],null,null,false);
  add(p,S(.035,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),[.03,.04,.08],null,null,false);eyes.push(e);}
 add(head,S(.18,12,8),white,[0,.62,-.1],[1,1.4,.8],[-.4,0,0]);
 const api={g:d,rig,body:b,head,neck,wL,wR,legs,eyes,tail,
  idle(t,ph=0){const br=Math.sin(t*4.2+ph)*.03;b.scale.set(1.05+br,1-br,1.15+br);tail.rotation.y=Math.sin(t*5+ph)*.25;
   const blink=(((t+ph)%2.1)<.09)?.1:1;eyes.forEach(e=>e.scale.y=blink);},
  walk(t,speed=1,ph=0){const w=t*7*speed+ph;legs[0].rotation.x=Math.sin(w)*.5;legs[1].rotation.x=-Math.sin(w)*.5;rig.position.y=Math.abs(Math.sin(w))*.12;rig.rotation.z=Math.sin(w)*.06;head.rotation.y=Math.sin(w*.5)*.1;},
  flap(t,amt=1){wL.rotation.z=.3+Math.sin(t*28)*.5*amt;wR.rotation.z=-wL.rotation.z;}};
 return api;}

export function makeEgg(parent,pos,s=1){return add(parent,S(.35,24,18),toon(0xfbf3e2),pos,[s*.8,s,s*.8]);}
export function makeNest(parent,pos,s=1){const n=new THREE.Group();n.position.set(...pos);n.scale.setScalar(s);parent.add(n);
 add(n,new THREE.TorusGeometry(.9,.3,12,28),toon(0x9a7448),[0,.2,0],[1,1,.6],[Math.PI/2,0,0]);
 add(n,C(.9,.7,.2,24),toon(0x7f5d38),[0,.08,0],null,null,false);return n;}

export function makeSailor(parent,{coat=0x2f5e9e,hat=0x3a2a22,skin=0xf3c9a5,scale=1}={}){
 const s=new THREE.Group();s.scale.setScalar(scale);parent.add(s);const rig=new THREE.Group();s.add(rig);
 add(rig,S(.6),toon(coat),[0,1.0,0],[1,1.25,.9]);
 add(rig,C(.62,.62,.18,20),toon(0x4a3524),[0,.75,0],null,null,false);
 const head=new THREE.Group();head.position.set(0,2.05,0);rig.add(head);
 add(head,S(.55),toon(skin));
 add(head,S(.07,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[-.18,.05,.5],null,null,false);
 add(head,S(.07,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[.18,.05,.5],null,null,false);
 add(head,S(.4,16,10),toon(0x6a4a30),[0,-.32,.25],[1,.55,.5],null,false);// 수염
 add(head,C(.7,.7,.12,20),toon(hat),[0,.38,0]);add(head,C(.38,.45,.45,16),toon(hat),[0,.6,0]);
 const legs=[];for(const x of[-.25,.25]){const l=new THREE.Group();l.position.set(x,.6,0);s.add(l);add(l,C(.14,.14,.6,8),toon(0x3d3a4a),[0,-.3,0]);add(l,S(.18),toon(0x241a18),[0,-.6,.08],[1,.6,1.4]);legs.push(l);}
 const arms=[];for(const x of[-.65,.65]){const a=new THREE.Group();a.position.set(x,1.4,0);rig.add(a);add(a,C(.13,.13,.7,8),toon(coat),[0,-.35,0]);add(a,S(.15),toon(skin),[0,-.72,0]);arms.push(a);}
 return {g:s,rig,head,legs,arms,walk(t,sp=1){const w=t*7*sp;legs[0].rotation.x=Math.sin(w)*.5;legs[1].rotation.x=-Math.sin(w)*.5;arms[0].rotation.x=-Math.sin(w)*.4;arms[1].rotation.x=Math.sin(w)*.4;rig.position.y=Math.abs(Math.sin(w))*.08;}};}

export function makeShip(parent,s=1){const sh=new THREE.Group();sh.scale.setScalar(s);parent.add(sh);
 const hull=add(sh,new THREE.BoxGeometry(2.6,1.4,7),toon(0x7a4a2c),[0,.5,0]);
 add(sh,new THREE.BoxGeometry(2.7,.25,7.1),toon(0xc9a04a),[0,1.2,0],null,null,false);
 add(sh,new THREE.BoxGeometry(2.4,1.2,1.8),toon(0x6a3e24),[0,1.7,-2.4]);
 add(sh,new THREE.ConeGeometry(1.3,2.2,4),toon(0x7a4a2c),[0,.5,4.3],[1,1,1],[Math.PI/2,Math.PI/4,0]);
 const sails=[];for(const [z,h] of [[-1.2,6],[1.4,7]]){add(sh,C(.12,.14,h,8),toon(0x5a3a22),[0,1+h/2,z]);
  for(const k of[0,1]){const sg=new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI/2);const sail=add(sh,sg,toon(0xfff4df,{side:THREE.DoubleSide}),[0,2.6+k*2.2,z+.15],[1.6-k*.3,.9,.45],[-Math.PI/2,0,0]);sails.push(sail);}}
 const flag=add(sh,new THREE.BoxGeometry(.05,.5,.9),toon(0xd94a4a),[0,8.2,1.85],null,null,false);
 for(let i=-2;i<=2;i++)for(const x of[-1.31,1.31])add(sh,S(.12,8,6),new THREE.MeshBasicMaterial({color:0x221810}),[x,.7,i*1.2],null,null,false);
 return {g:sh,sails,flag};}
export function makeBoat(parent){const b=new THREE.Group();parent.add(b);
 add(b,S(1,20,12),toon(0x8a5a3a),[0,.2,0],[1,.45,2.1]);add(b,new THREE.BoxGeometry(1.7,.12,3.6),toon(0x6a4024),[0,.55,0],null,null,false);return b;}
export function makeRat(parent,s=1){const r=new THREE.Group();r.scale.setScalar(s);parent.add(r);
 add(r,S(.5),toon(0x7d7a86),[0,.4,0],[1,.8,1.4]);add(r,S(.32),toon(0x8a8794),[0,.55,.62]);
 add(r,S(.12),toon(0xf2a5b5),[-.2,.85,.6],[1,1,.4]);add(r,S(.12),toon(0xf2a5b5),[.2,.85,.6],[1,1,.4]);
 add(r,S(.06,8,6),toon(0xf2a5b5),[0,.52,.95],null,null,false);
 add(r,S(.05,8,6),new THREE.MeshBasicMaterial({color:0x111111}),[-.12,.65,.86],null,null,false);add(r,S(.05,8,6),new THREE.MeshBasicMaterial({color:0x111111}),[.12,.65,.86],null,null,false);
 const tail=add(r,new THREE.TorusGeometry(.5,.04,6,20,Math.PI),toon(0xf2a5b5),[0,.4,-.85],null,[0,Math.PI/2,0],false);
 return r;}
export function makePig(parent,s=1){const p=new THREE.Group();p.scale.setScalar(s);parent.add(p);const rig=new THREE.Group();p.add(rig);
 add(rig,S(1),toon(0xf3a8b6),[0,1,0],[1,.85,1.25]);
 const head=new THREE.Group();head.position.set(0,1.25,1.1);rig.add(head);
 add(head,S(.65),toon(0xf3a8b6));add(head,C(.3,.32,.3,16),toon(0xe88e9e),[0,-.05,.62],null,[Math.PI/2,0,0]);
 add(head,S(.06,8,6),new THREE.MeshBasicMaterial({color:0x6a2a3a}),[-.1,-.05,.78],null,null,false);add(head,S(.06,8,6),new THREE.MeshBasicMaterial({color:0x6a2a3a}),[.1,-.05,.78],null,null,false);
 add(head,S(.08,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[-.25,.2,.52],null,null,false);add(head,S(.08,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[.25,.2,.52],null,null,false);
 add(head,new THREE.ConeGeometry(.22,.4,8),toon(0xe88e9e),[-.38,.55,0],null,[0,0,.5]);add(head,new THREE.ConeGeometry(.22,.4,8),toon(0xe88e9e),[.38,.55,0],null,[0,0,-.5]);
 const legs=[];for(const [x,z] of[[-.5,.6],[.5,.6],[-.5,-.6],[.5,-.6]]){const l=new THREE.Group();l.position.set(x,.5,z);p.add(l);add(l,C(.18,.18,.6,10),toon(0xf3a8b6),[0,-.2,0]);legs.push(l);}
 return {g:p,rig,head,legs,walk(t,sp=1){const w=t*8*sp;legs.forEach((l,i)=>l.rotation.x=Math.sin(w+(i%2?Math.PI:0)+(i>1?Math.PI:0))*.4);rig.position.y=Math.abs(Math.sin(w))*.06;}};}
export function makeMonkey(parent,s=1){const m=new THREE.Group();m.scale.setScalar(s);parent.add(m);const rig=new THREE.Group();m.add(rig);
 add(rig,S(.6),toon(0x8a5a36),[0,1,0],[1,1.15,.9]);
 const head=new THREE.Group();head.position.set(0,1.95,0);rig.add(head);
 add(head,S(.55),toon(0x8a5a36));add(head,S(.42),toon(0xf0c9a0),[0,-.05,.25],[1,.85,.7],null,false);
 add(head,S(.2),toon(0xf0c9a0),[-.55,.1,0],[.6,1,.6]);add(head,S(.2),toon(0xf0c9a0),[.55,.1,0],[.6,1,.6]);
 add(head,S(.08,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[-.16,.08,.5],null,null,false);add(head,S(.08,10,8),new THREE.MeshBasicMaterial({color:0x1a1420}),[.16,.08,.5],null,null,false);
 add(rig,new THREE.TorusGeometry(.6,.08,8,20,Math.PI*1.3),toon(0x8a5a36),[0,.9,-.7],null,[0,Math.PI/2,0]);
 const arms=[];for(const x of[-.6,.6]){const a=new THREE.Group();a.position.set(x,1.3,0);rig.add(a);add(a,C(.11,.11,.9,8),toon(0x8a5a36),[0,-.45,0]);arms.push(a);}
 for(const x of[-.3,.3])add(m,C(.13,.13,.6,8),toon(0x8a5a36),[x,.3,0]);
 return {g:m,rig,head,arms};}
export function textSprite(text,{size=220,fill='#fff6c8',stroke='#2a1d2e',w=1024,h=256,font='NK'}={}){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
 x.font=`900 ${size}px ${font}, sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=size*.12;x.strokeStyle=stroke;x.strokeText(text,w/2,h/2+size*.05);x.fillStyle=fill;x.fillText(text,w/2,h/2+size*.05);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sp.renderOrder=10;sp.userData.aspect=w/h;return sp;}
export function dust(scene,{n=80,color=0xfff0c0,box=[12,7,6],y0=0,size=.07,seed=3}={}){const r=rnd(seed);const dp=new Float32Array(n*3),sd=[];for(let i=0;i<n;i++)sd.push([r()*box[0]-box[0]/2,r()*box[1],r()*box[2]-box[2]/2,r()*6.28]);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(dp,3));const pts=new THREE.Points(geo,new THREE.PointsMaterial({color,size,transparent:true,opacity:.85}));scene.add(pts);
 return t=>{for(let i=0;i<n;i++){const s=sd[i];dp[i*3]=s[0]+Math.sin(t*.5+s[3])*.3;dp[i*3+1]=y0+(s[1]+t*.25)%box[1];dp[i*3+2]=s[2];}geo.attributes.position.needsUpdate=true;};}
export function waves(scene,{n=40,r=[8,60],seed=5,color=0xd8f1ff}={}){const rr=rnd(seed);const list=[];for(let i=0;i<n;i++){const a=rr()*6.28,d=r[0]+rr()*(r[1]-r[0]);const m=add(scene,S(1,10,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7}),[Math.cos(a)*d,.02,Math.sin(a)*d],[.9,.02,.12],[0,rr()*3,0],false);list.push([m,rr()*6.28]);}
 return t=>list.forEach(([m,p])=>{const k=(Math.sin(t*1.5+p)+1)/2;m.material.opacity=.15+.6*k;m.scale.x=.6+k*.8;});}
