import {describe,it,expect,vi} from 'vitest';
import {SupabaseAccountApi,type StoredTokens} from '../../src/api/SupabaseAccountApi';
const jwt=(value:unknown)=>`x.${btoa(JSON.stringify(value))}.x`;
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status});
function setup(options:{guest?:boolean;other?:boolean;disabled?:boolean;identities?:unknown[]}={}){
 let token:StoredTokens|null={accessToken:jwt({email:options.guest?'':'garden_01@id.forgarden.app',is_anonymous:!!options.guest}),refreshToken:'old-refresh',expiresAtMs:Date.now()+3600000,userId:'same-player'};
 const calls:{url:string;body:any;headers:any}[]=[];
 const payload=()=>({access_token:jwt({email:'garden_01@id.forgarden.app',is_anonymous:false}),refresh_token:'new-refresh',expires_in:3600,user:{id:options.other?'other-player':'same-player'}});
 const bridge={authorize:vi.fn(async(build:(c:string,r:string)=>Promise<string>)=>{const url=await build('challenge','https://game.test/?pf_auth_callback=1');expect(url).toContain('https://');return {code:'one-time-code',verifier:'parent-memory-only'};})};
 const api=new SupabaseAccountApi({url:'https://auth.test',key:'public-key',saveVersion:()=>50,store:{load:async()=>token,save:async t=>{token=t;},clear:async()=>{token=null;}},oauth:bridge,fetchImpl:async(url,init={})=>{calls.push({url:String(url),body:init.body?JSON.parse(String(init.body)):null,headers:init.headers});
  if(String(url).includes('/identities/authorize'))return options.disabled?json({},400):json({url:'https://accounts.google.test/authorize'});
  if(String(url).includes('grant_type=pkce')||String(url).endsWith('/verify'))return json(payload());
  if(String(url).endsWith('/rpc/account_login_id'))return json('garden_01');
  if(String(url).endsWith('/user'))return json({identities:options.identities??[{identity_id:'email-id',provider:'email',identity_data:{email:'garden_01@id.forgarden.app'}},{identity_id:'google-id',provider:'google',identity_data:{email:'player@example.com'}}]});
  if(String(url).includes('/identities/'))return json({});throw new Error('unexpected request');
 }});
 return {api,calls,bridge,token:()=>token};
}
describe('동일 UID 계정 다중 연동',()=>{
 it.each([false,true])('아이디/게스트=%s에 Google을 붙이며 PKCE와 인증 UID를 유지한다',async guest=>{
  const s=setup({guest});expect((await s.api.login({provider:'google',intent:'link',mergeGuestProgress:false})).ok).toBe(true);
  expect(s.token()?.userId).toBe('same-player');expect(s.calls[0].url).toContain('/user/identities/authorize');expect(s.calls[0].url).toContain('skip_http_redirect=true');expect(s.calls[0].headers.Authorization).toContain('Bearer ');
  expect(s.calls[1].body).toEqual({auth_code:'one-time-code',code_verifier:'parent-memory-only'});
  expect(s.calls.some(c=>c.url.includes('/auth/v1/authorize?'))).toBe(false);
 });
 it('다른 UID의 연동 응답은 원래 토큰을 덮지 않는다',async()=>{const s=setup({other:true});expect(await s.api.login({provider:'apple',intent:'link',mergeGuestProgress:false})).toMatchObject({ok:false,code:'invalid-credentials'});expect(s.token()?.refreshToken).toBe('old-refresh');});
 it('수동 연동이 꺼져 있으면 다른 계정 로그인으로 대체하지 않는다',async()=>{const s=setup({disabled:true});expect(await s.api.login({provider:'google',intent:'link',mergeGuestProgress:false})).toMatchObject({ok:false,code:'unsupported'});expect(s.calls).toHaveLength(1);expect(s.token()?.refreshToken).toBe('old-refresh');});
 it('로그인은 identity 연동 엔드포인트를 호출하지 않는다',async()=>{const s=setup();expect((await s.api.login({provider:'apple',intent:'sign-in',mergeGuestProgress:false})).ok).toBe(true);expect(s.calls).toHaveLength(1);expect(s.calls[0].url).toContain('grant_type=pkce');});
 it('소셜·이메일·유지된 아이디 별칭을 함께 표시한다',async()=>{const s=setup({identities:[{identity_id:'email-id',provider:'email',identity_data:{email:'player@example.com'}},{identity_id:'google-id',provider:'google'}]});const result=await s.api.getIdentities();expect(result.ok&&result.value.map(i=>i.provider)).toEqual(['email','google','password']);expect(JSON.stringify(result)).not.toContain('refresh');});
 it('마지막 소셜 로그인 수단은 삭제 요청을 보내지 않는다',async()=>{const s=setup({identities:[{identity_id:'google-id',provider:'google'}]}); // 별칭 RPC는 password가 실제 있는 경우만 반환한다.
  const api=new SupabaseAccountApi({url:'https://auth.test',key:'k',saveVersion:()=>50,store:{load:async()=>s.token(),save:async()=>{},clear:async()=>{}},fetchImpl:async(url)=>String(url).includes('/rpc/')?json(null):json({identities:[{identity_id:'google-id',provider:'google'}]})});
  expect(await api.unlinkIdentity('google-id')).toMatchObject({ok:false,code:'unsupported'});
 });
 it('다른 로그인 수단이 있으면 지정된 소셜 identity만 해제한다',async()=>{const s=setup();expect((await s.api.unlinkIdentity('google-id')).ok).toBe(true);expect(s.calls.some(c=>c.url.endsWith('/identities/google-id'))).toBe(true);});
 it('이메일 검증도 다른 UID이면 진행 소유자를 바꾸지 않는다',async()=>{const s=setup({other:true});expect(await s.api.verifyEmailCode('player@example.com','123456','link')).toMatchObject({ok:false,code:'invalid-credentials'});expect(s.token()?.refreshToken).toBe('old-refresh');});
});
