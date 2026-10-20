import {afterEach,it,expect,vi} from 'vitest';
import {finishOAuthPopup,createWebOAuthBridge} from '../../src/api/webOAuth';
afterEach(()=>vi.unstubAllGlobals());
it('콜백은 코드만 부모로 보내고 메시지 수신 전에 스스로 닫히지 않는다',()=>{
 const postMessage=vi.fn(),close=vi.fn(),replaceState=vi.fn();vi.stubGlobal('window',{location:{href:'https://game.test/?pf_auth_callback=1&code=owned-code',origin:'https://game.test'},opener:{postMessage},close,history:{replaceState}});
 expect(finishOAuthPopup()).toBe(true);expect(postMessage).toHaveBeenCalledWith({type:'forgarden.oauth.code',code:'owned-code'},'https://game.test');expect(close).not.toHaveBeenCalled();expect(replaceState).toHaveBeenCalledWith(null,'','/');
});
it('다른 origin 또는 다른 창이 보낸 코드는 받지 않는다',async()=>{
 let listener:(event:any)=>void=()=>{};const close=vi.fn();const popup={closed:false,close,location:{href:''}};
 vi.stubGlobal('window',{open:()=>popup,location:{origin:'https://game.test'},addEventListener:(_name:string,fn:any)=>{listener=fn;},removeEventListener:vi.fn()});
 const bridge=createWebOAuthBridge()!;let ready!:()=>void;const started=new Promise<void>(r=>ready=r);
 const promise=bridge.authorize(async()=>{ready();return 'https://provider.test/authorize';});await started;
 let done=false;void promise.then(()=>done=true);
 listener({origin:'https://attacker.test',source:popup,data:{type:'forgarden.oauth.code',code:'bad'}});listener({origin:'https://game.test',source:{},data:{type:'forgarden.oauth.code',code:'bad'}});
 await Promise.resolve();expect(done).toBe(false);
 listener({origin:'https://game.test',source:popup,data:{type:'forgarden.oauth.code',code:'owned'}});
 expect(await promise).toMatchObject({code:'owned'});expect(close).toHaveBeenCalledTimes(1);
});
