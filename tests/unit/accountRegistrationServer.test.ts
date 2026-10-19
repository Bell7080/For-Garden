import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../src/server/accountEntry';
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status});
function response(){const out={code:0,body:{} as any,headers:{} as Record<string,string>};return {out,res:{status(n:number){out.code=n;return this;},json(v:any){out.body=v;},setHeader(k:string,v:string){out.headers[k]=v;}}};}
const body={id:'garden_01',password:'correct horse'};
function configure(){vi.stubEnv('SUPABASE_URL','https://auth.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-secret');}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('메일 없는 아이디 회원가입 서버',()=>{
 it('신규 계정을 확인 완료로 만들고 토큰/비밀번호/키를 응답하지 않는다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({id:'new-user'}));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{'x-forwarded-for':'203.0.113.1'},body},res);
  expect(out.code).toBe(200);expect(out.body).toEqual({ok:true,userId:'new-user'});
  const [url,init]=f.mock.calls[1] as unknown as [string,RequestInit];expect(url.endsWith('/auth/v1/admin/users')).toBe(true);expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({email:'garden_01@id.forgarden.app',password:body.password,email_confirm:true});
  expect(JSON.stringify(f.mock.calls[0])).not.toContain('203.0.113.1');
  expect(JSON.stringify(out)).not.toContain(body.password);expect(JSON.stringify(out)).not.toContain('server-only-secret');
 });
 it('게스트의 실제 인증 UID만 승격하며 클라이언트가 준 다른 UID는 무시한다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.endsWith('/auth/v1/user')?json({id:'own-guest',is_anonymous:true}):url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({id:'own-guest'}));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{authorization:'Bearer guest-token'},body:{...body,userId:'other-user'}},res);
  expect(out.body).toEqual({ok:true,userId:'own-guest'});expect(f.mock.calls.at(-1)![0]).toBe('https://auth.test/auth/v1/admin/users/own-guest');
 });
 it('이미 다른 아이디에 연동된 계정은 덮어쓰지 않는다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({id:'linked',is_anonymous:false,email:'other@id.forgarden.app'}));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{authorization:'Bearer linked-token'},body},res);expect(out.code).toBe(409);expect(f).toHaveBeenCalledTimes(2);
 });
 it('사용 중인 아이디 오류는 새 계정을 만들거나 타 계정으로 로그인시키지 않는다',async()=>{
  configure();vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({error_code:'email_exists'},422)));
  const {out,res}=response();await handler({method:'POST',headers:{},body},res);expect(out.code).toBe(409);expect(out.body.code).toBe('id_taken');
 });
 it('제한 시 실제 남은 시간과 429를 보내고 인증 변경을 호출하지 않는다',async()=>{
  configure();const f=vi.fn(async()=>json({allowed:false,retryAfter:42}));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{},body},res);expect(out.code).toBe(429);expect(out.headers['retry-after']).toBe('42');expect(f).toHaveBeenCalledTimes(1);
 });
 it('인증 조회 장애를 계정 만료/무인증 신규 가입으로 처리하지 않는다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({},503));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{authorization:'Bearer guest'},body},res);expect(out.code).toBe(503);expect(f).toHaveBeenCalledTimes(2);
 });
 it.each([null,{}, {id:'x',password:'short'}])('잘못된 입력은 인증 서버에 보내지 않는다: %j',async input=>{
  configure();const f=vi.fn();vi.stubGlobal('fetch',f);const {out,res}=response();await handler({method:'POST',headers:{},body:input},res);expect(out.code).toBe(400);expect(f).not.toHaveBeenCalled();
 });
});

describe('구형 미확인 아이디 복구',()=>{
 it('정확한 비밀번호에 대한 미확인 응답을 받은 계정만 메일 없이 확인한다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.includes('server_id_account')?json({id:'pending-owner'}):url.includes('/rpc/')?json({allowed:true,retryAfter:0}):url.includes('grant_type=password')?json({error_code:'email_not_confirmed'},400):json({id:'pending-owner'}));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{},body:{...body,action:'confirm-existing'}},res);
  expect(out.body).toEqual({ok:true,userId:'pending-owner'});
  const [url,init]=f.mock.calls.at(-1)! as unknown as [string,RequestInit];expect(url.endsWith('/admin/users/pending-owner')).toBe(true);expect(JSON.parse(String(init.body))).toEqual({email:'garden_01@id.forgarden.app',email_confirm:true});
 });
 it('틀린 비밀번호로 계정 확인/목록 조회를 할 수 없다',async()=>{
  configure();const f=vi.fn(async(url:string)=>url.includes('/rpc/')?json({allowed:true,retryAfter:0}):json({error_code:'invalid_credentials'},400));vi.stubGlobal('fetch',f);
  const {out,res}=response();await handler({method:'POST',headers:{},body:{...body,action:'confirm-existing'}},res);expect(out.code).toBe(401);expect(f.mock.calls.some(([url])=>String(url).includes('/admin/')||String(url).includes('server_id_account'))).toBe(false);
 });
});
