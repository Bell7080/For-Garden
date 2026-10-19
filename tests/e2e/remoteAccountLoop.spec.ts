import { test, expect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
import { accountIdPopupRows } from '../../src/ui/accountIdPopupLayout';
test('계정 연동 탭·중복 요청 방지·기존 계정 전환 확인',async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','Vite source test server 전용');test.setTimeout(240000);
 await installGameHandleProbe(page);await startAfterOpening(page);
 await page.evaluate(async()=>{
  const root='/src/';const [a,p,l]=await Promise.all([import(/* @vite-ignore */root+'api/AccountApi.ts'),import(/* @vite-ignore */root+'ui/AccountIdPopup.ts'),import(/* @vite-ignore */root+'ui/PopupLayer.ts')]);
  const w=window as any;w.__ACCT={register:0,login:0,done:[]};
  a.installAccountApi({registerWithId:()=>{w.__ACCT.register++;return new Promise(resolve=>{w.__ACCT.resolve=resolve;});},signInWithId:async()=>{w.__ACCT.login++;return w.__ACCT.login===1?{ok:false,code:'invalid-credentials',message:'invalid'}:{ok:true,value:{kind:'linked',provider:'password',maskedId:'ga••••'}};}});
  w.__ACCT_OPEN=(scene:any)=>{w.__ACCT_SCENE=scene;p.openAccountIdPopup(scene,new l.PopupLayer(scene,3500),{mode:'link',onDone:(_state:unknown,how:string)=>w.__ACCT.done.push(how)});};
 });
 const cdp=await page.context().newCDPSession(page);const listener=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});const props=await cdp.send('Runtime.getProperties',{objectId:listener.result.objectId!});
 const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:"function(){window.__ACCT_OPEN(this.game.scene.getScene('title'));}"});
 const fill=async(register:boolean)=>{await page.getByLabel('아이디',{exact:true}).fill('garden_01');await page.getByLabel('비밀번호',{exact:true}).fill('correct horse');if(register)await page.getByLabel('비밀번호 확인',{exact:true}).fill('correct horse');};
 const clickLabel=async(label:string)=>{const point=await page.evaluate(label=>{const found:any[]=[];const walk=(v:any)=>{if(v.type==='Text'&&v.text===label&&v.parentContainer?.parentContainer?.labelText===v&&v.parentContainer.parentContainer.bg?.input?.enabled){let root=v;while(root.parentContainer)root=root.parentContainer;found.push({...v.getBounds(),depth:root.depth});}for(const child of v.list??[])walk(child);};walk({list:(window as any).__ACCT_SCENE.children.list});const r=found.sort((a,b)=>a.depth-b.depth).at(-1);return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null;},label);expect(point).not.toBeNull();await tap(page,point!.x,point!.y);};
 await fill(true);await captureGame(page,info.outputPath('account-link-tabs.png'));
 await clickLabel('이 아이디로 연동');await expect.poll(()=>page.evaluate(()=>(window as any).__ACCT.register)).toBe(1);
 const rows=accountIdPopupRows('link');await tap(page,381,960+rows.tabsY!);await tap(page,540,960+rows.submitY);expect(await page.evaluate(()=>(window as any).__ACCT.register)).toBe(1);await expect(page.getByLabel('비밀번호 확인',{exact:true})).toHaveCount(1);
 await page.evaluate(()=>(window as any).__ACCT.resolve({ok:false,code:'rate-limited',message:'60초 후 다시 시도할 수 있습니다.',retryAfterSeconds:60}));
 await tap(page,381,960+rows.tabsY!);await expect(page.getByLabel('비밀번호 확인',{exact:true})).toHaveCount(0);await fill(false);
 await clickLabel('로그인');await captureGame(page,info.outputPath('account-switch-confirm.png'));await clickLabel('취소');expect(await page.evaluate(()=>(window as any).__ACCT.login)).toBe(0);
 await clickLabel('로그인');await clickLabel('로그인');await expect.poll(()=>page.evaluate(()=>(window as any).__ACCT.login)).toBe(1);expect(await page.evaluate(()=>(window as any).__ACCT.done)).toEqual([]);
 await clickLabel('로그인');await clickLabel('로그인');await expect.poll(()=>page.evaluate(()=>(window as any).__ACCT.done)).toEqual(['signIn']);
});
