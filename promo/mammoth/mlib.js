import * as L from './lib.js';
const {THREE,add,S,C,toon}=L;
// 털북숭이 매머드 — 높은 머리, 비탈진 등, 긴 털 술, 휘어진 엄니
export function makeMammoth(parent,{scale=1,fur=0x8a5a36,dark=0x5e3a22,baby=false}={}){
 const m=new THREE.Group();m.scale.setScalar(scale);parent.add(m);const rig=new THREE.Group();m.add(rig);
 const furC=toon(fur),darkC=toon(dark),tuskC=toon(0xf4ead2),eyeM=new THREE.MeshBasicMaterial({color:0x1a1420});
 const body=add(rig,S(1.6,40,28),furC,[0,2.7,-.2],[1.05,1,1.45]);
 add(rig,S(1.2,32,20),furC,[0,3.3,.9],[1.1,1.05,1]);// 어깨 혹
 // 배 아래로 늘어진 털 술
 for(let i=0;i<26;i++){const a=i/26*Math.PI*2;const x=Math.cos(a)*1.5,z=Math.sin(a)*2.15-.2;const h=1.2+(i%3)*.25;add(rig,new THREE.ConeGeometry(.3,h,6),darkC,[x,1.95-h/2+.1,z],null,[Math.PI,0,Math.cos(a)*.12],true,1.08);}
 for(let i=0;i<5;i++)add(rig,new THREE.ConeGeometry(.28,1.1,6),darkC,[(i-2)*.4,2.3,1.75],null,[Math.PI+.2,0,0],true,1.08);// 가슴 털
 const tail=add(rig,C(.1,.14,.8,8),darkC,[0,2.6,-2.5],null,[-.6,0,0]);
 const head=new THREE.Group();head.position.set(0,3.8,1.9);rig.add(head);
 add(head,S(1,32,22),furC,[0,.2,0],[1,1.15,1]);
 add(head,S(.55,20,14),darkC,[0,1.05,-.2],[1.1,.9,1]);// 머리 꼭대기 혹
 const ears=[];for(const s of[-1,1])ears.push(add(head,S(.35,16,12),darkC,[s*.88,.25,-.15],[.35,1,.8]));
 const eyes=[];for(const s of[-1,1]){const e=new THREE.Group();e.position.set(s*.55,.35,.72);head.add(e);add(e,S(.16,16,12),toon(0xfffaf0));const p=add(e,S(.09,12,8),eyeM,[0,0,.1],null,null,false);add(p,S(.03,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),[.03,.03,.07],null,null,false);eyes.push(e);}
 // 코(여러 마디)
 const trunk=new THREE.Group();trunk.position.set(0,-.1,.9);head.add(trunk);const segs=[];let par=trunk;
 for(let i=0;i<7;i++){const g=new THREE.Group();g.position.set(0,i?-.36:0,0);par.add(g);add(g,S(.3-i*.025,16,12),furC,[0,-.18,0],[1,1.2,1]);segs.push(g);par=g;}
 // 엄니
 const tusks=[];for(const s of[-1,1]){const pts=[];for(let i=0;i<=12;i++){const k=i/12;pts.push(new THREE.Vector3(s*(.3+1.2*k-1.0*k*k),-.5-1.2*k+1.25*k*k,.75+1.25*k));}
  const curve=new THREE.CatmullRomCurve3(pts);const tk=add(head,new THREE.TubeGeometry(curve,24,baby?.04:.15,8),tuskC,[0,0,0],null,null,true,1.08);tk.visible=!baby;tusks.push(tk);}
 const legs=[];for(const [x,z] of[[-.85,1.1],[.85,1.1],[-.85,-1.3],[.85,-1.3]]){const l=new THREE.Group();l.position.set(x,2.0,z);m.add(l);add(l,C(.45,.5,2,12),furC,[0,-1,0]);add(l,C(.55,.55,.25,12),toon(0x4a3020),[0,-1.95,0],null,null,false);legs.push(l);}
 const api={g:m,rig,head,trunk:segs,legs,ears,eyes,tail,tusks,
  idle(t,ph=0){const br=Math.sin(t*2.5+ph)*.02;body.scale.set(1.05+br,1-br,1.45);segs.forEach((g,i)=>g.rotation.x=Math.sin(t*2+ph-i*.5)*.12+(i?.06:0));
   ears.forEach((e,i)=>e.rotation.y=Math.sin(t*3+ph+i)*.15);tail.rotation.z=Math.sin(t*4+ph)*.3;const blink=(((t+ph)%2.7)<.1)?.1:1;eyes.forEach(e=>e.scale.y=blink);},
  walk(t,sp=1,ph=0){const w=t*4*sp+ph;legs.forEach((l,i)=>l.rotation.x=Math.sin(w+((i===0||i===3)?0:Math.PI))*.35);rig.position.y=Math.abs(Math.sin(w))*.08;rig.rotation.z=Math.sin(w)*.03;head.rotation.x=Math.sin(w*2)*.03;},
  raise(k){segs.forEach((g,i)=>g.rotation.x=-k*.45);}};
 return api;}
export function makePyramid(parent,{pos=[0,0,0],s=1,levels=8,c=0xe2b86a}={}){const p=new THREE.Group();p.position.set(...pos);p.scale.setScalar(s);parent.add(p);const steps=[];
 for(let i=0;i<levels;i++){const w=8-i*(8/levels);steps.push(add(p,new THREE.BoxGeometry(w,.9,w),toon(i%2?c:0xd8ac5e),[0,.45+i*.9,0],null,null,false));}
 return {g:p,steps};}
export function makeHunter(parent,o={}){const h=L.makeSailor(parent,{coat:0x7a5a3a,hat:0x5a4030,skin:0xe8b48e,...o});
 // 털모자 대신 둥근 모자
 const spear=add(h.arms[1],C(.05,.05,3.2,6),toon(0x6a4a2a),[0,-.6,.2],null,[Math.PI/2.3,0,0]);add(spear,new THREE.ConeGeometry(.12,.4,6),toon(0xb0b8c0),[0,1.75,0]);h.spear=spear;return h;}
export function makeIceberg(parent,pos,s=1,seed=1){const r=L.rnd(seed);const g=new THREE.Group();g.position.set(...pos);g.scale.setScalar(s);parent.add(g);
 for(let i=0;i<3;i++)add(g,new THREE.DodecahedronGeometry(1+r()*.6,0),toon(i?0xe8f6ff:0xcfeaf8),[r()*1.6-.8,.3+r()*.4,r()*1.6-.8],[1,.6+r()*.8,1],[r(),r(),r()]);return g;}
export function snow(scene,{n=400,box=[40,24,30],size=.12,seed=21,wind=1}={}){const r=L.rnd(seed);const p=new Float32Array(n*3),sd=[];for(let i=0;i<n;i++)sd.push([r()*box[0]-box[0]/2,r()*box[1],r()*box[2]-box[2]/2,r()*6.28,.6+r()*.8]);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size,transparent:true,opacity:.9}));scene.add(pts);
 return (t,op=1)=>{pts.material.opacity=.9*op;for(let i=0;i<n;i++){const s=sd[i];let y=s[1]-t*2.2*s[4];y=((y%box[1])+box[1])%box[1];p[i*3]=((s[0]+t*wind*2*s[4]+box[0]/2)%box[0]+box[0])%box[0]-box[0]/2+Math.sin(t+s[3])*.4;p[i*3+1]=y;p[i*3+2]=s[2];}geo.attributes.position.needsUpdate=true;};}
export function aurora(scene){const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:{value:0}},
 vertexShader:`varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float t;varying vec2 u;void main(){float w=sin(u.x*9.+t*.8)*.08+sin(u.x*23.-t*1.3)*.03;float b=smoothstep(.25+w,.5+w,u.y)*(1.-smoothstep(.5+w,.95+w,u.y));
 vec3 c=mix(vec3(.2,1.,.6),vec3(.6,.4,1.),u.y);float s=.6+.4*sin(u.x*40.+t*2.);gl_FragColor=vec4(pow(c,vec3(1./2.2)),b*s*1.0);}`});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(160,50,1,1),mat);m.position.set(0,24,-70);scene.add(m);return t=>mat.uniforms.t.value=t;}
export function smoothPyramid(parent,pos,s=1,c=0xe6bd70){return add(parent,new THREE.ConeGeometry(5.6,7,4),toon(c),[pos[0],3.5*s+pos[1],pos[2]],[s,s,s],[0,Math.PI/4,0]);}
