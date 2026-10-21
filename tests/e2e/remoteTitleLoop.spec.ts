import {test,expect} from '@playwright/test';
import {installGameHandleProbe} from './gameDiagnostics';
import {startAfterOpening} from './openingSave';
import {tap,captureGame} from './canvasInput';
for (const how of ['guest', 'google', 'apple', 'email', 'register', 'signIn'] as const) test(`타이틀 ${how} 성공은 입장 문구를 표시하고 탭하면 바로 로비로 진입한다`,async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','소스 서버 전용');test.setTimeout(180000);
 await installGameHandleProbe(page);await startAfterOpening(page);
 await page.evaluate(async()=>{const root='/src/';const api=await import(/* @vite-ignore */root+'api/AccountApi.ts');(window as any).__TITLE_REGISTER=0;const done=async()=>{(window as any).__TITLE_REGISTER++;return {ok:true,value:{kind:'linked',provider:'password',maskedId:'ga••••'}};};api.installAccountApi({getState:done,login:done,registerWithId:done,signInWithId:done,requestEmailCode:async()=>({ok:true}),verifyEmailCode:done});});
 const cdp=await page.context().newCDPSession(page);const listener=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});const props=await cdp.send('Runtime.getProperties',{objectId:listener.result.objectId!});const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:"function(){const s=this.game.scene.getScene('title');window.__TITLE_SCENE=s;s.showEntry(540,true);}"});
 const click=async(label:string)=>{await expect.poll(async()=>page.evaluate(label=>{let point:any=null;const walk=(v:any)=>{if(v.type==='Text'&&v.text===label&&v.parentContainer?.parentContainer?.labelText===v&&v.parentContainer.parentContainer.bg?.input?.enabled){const b=v.getBounds();point={x:b.centerX,y:b.centerY};}for(const c of v.list??[])walk(c);};walk({list:(window as any).__TITLE_SCENE.children.list});return point;},label)).not.toBeNull();const p=await page.evaluate(label=>{let point:any;const walk=(v:any)=>{if(v.type==='Text'&&v.text===label&&v.parentContainer?.parentContainer?.labelText===v&&v.parentContainer.parentContainer.bg?.input?.enabled){const b=v.getBounds();point={x:b.centerX,y:b.centerY};}for(const c of v.list??[])walk(c);};walk({list:(window as any).__TITLE_SCENE.children.list});return point;},label);await tap(page,p.x,p.y);};
 if(how==='guest'||how==='google'||how==='apple') {
   const label=await page.evaluate(async how=>{const root='/src/';const i=await import(/* @vite-ignore */root+'i18n/index.ts');return i.t('title.login.'+how);},how);
   await click(label);
 } else if(how==='email') {
   const labels=await page.evaluate(async()=>{const root='/src/';const i=await import(/* @vite-ignore */root+'i18n/index.ts');return {button:i.t('title.login.email'),address:i.t('account.email.address'),code:i.t('account.email.code')};});
   await click(labels.button);await page.getByLabel(labels.address,{exact:true}).fill('researcher@example.test');await tap(page,415,1195);
   await page.getByLabel(labels.code,{exact:true}).fill('123456');await tap(page,415,1195);
 } else {
 const accountLabel=await page.evaluate(async()=>{const root='/src/';const i=await import(/* @vite-ignore */root+'i18n/index.ts');return i.t('title.login.account');});
 await click(accountLabel);
 // 타이틀은 로그인 탭으로 열리므로 가입 탭을 실제 입력으로 고른다.
 // 탭 위치는 제품 레이아웃을 그대로 소비한다.
 const rows=await page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'ui/accountIdPopupLayout.ts');return m.accountIdPopupRows('both');});
 if(how==='register') await tap(page,699,960+rows.tabsY!);
 await page.getByLabel('아이디',{exact:true}).fill('garden_02');await page.getByLabel('비밀번호',{exact:true}).fill('correct horse');if(how==='register') await page.getByLabel('비밀번호 확인',{exact:true}).fill('correct horse');
 await tap(page,540,960+rows.submitY);
 }
 await expect.poll(()=>page.evaluate(()=>(window as any).__TITLE_REGISTER)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>(window as any).__TITLE_SCENE.loginButtons.length)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('title');
 // 인증 직후·인증에서 시작한 손 떼기·중복 손 떼기는 진입을 만들지 않는다.
 await page.evaluate(()=>{const scene=(window as any).__TITLE_SCENE;const zones=scene.children.list.filter((v:any)=>v.type==='Zone'&&v.input);for(const z of zones)z.emit('pointerup',{id:999});});
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('title');
 await tap(page,540,1100);
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene),{timeout:60000}).toBe('lobby');
 expect(await page.getByLabel('아이디',{exact:true}).count()).toBe(0);
 expect(await page.evaluate(()=>(window as any).__TITLE_SCENE.loginRebuild===undefined)).toBe(true);
 await captureGame(page,info.outputPath('title-after-registration.png'));
});
