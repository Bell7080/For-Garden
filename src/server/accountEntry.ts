/** 아이디 가입·로그인 경계. 서비스 키/비밀번호는 응답·로그에 남기지 않는다. 세션 토큰은 비밀번호로 증명한 본인 로그인에만 반환한다. */
import { accountCredentialProblem, accountIdToAuthEmail, authEmailToAccountId } from '../core/accountCredentials';
interface Req { method?: string; headers: Record<string,string|string[]|undefined>; body?: unknown }
interface Res { status(n:number):Res; json(v:unknown):void; setHeader(k:string,v:string):void }
export default async function handler(req:Req,res:Res):Promise<void>{
 res.setHeader('cache-control','no-store');
 if(req.method!=='POST'){res.setHeader('allow','POST');res.status(405).json({code:'method_not_allowed'});return;}
 const reply=(status:number,code:string)=>res.status(status).json({ok:false,code});
 try{
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body??null);
  if(new TextEncoder().encode(raw).length>4096){reply(413,'invalid_request');return;}
  let body:any;try{body=JSON.parse(raw);}catch{reply(400,'invalid_request');return;}
  if(!body||typeof body.id!=='string'||typeof body.password!=='string'||accountCredentialProblem(body.id,body.password)){reply(400,'invalid_credentials');return;}
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key){reply(503,'server_not_configured');return;}
  const deadline=AbortSignal.timeout(25000);
  const call=(path:string,init:RequestInit={})=>fetch(`${url}${path}`,{...init,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',...init.headers},signal:AbortSignal.any([deadline,AbortSignal.timeout(10000)])});
  const auth=typeof req.headers.authorization==='string'?req.headers.authorization:'';
  let current:{id:string;is_anonymous?:boolean;email?:string;email_confirmed_at?:string}|null=null;
  const email=accountIdToAuthEmail(body.id);
  // Vercel이 덮어쓰는 접속 IP를 서비스 비밀값과 해시한다. 원본 IP는 DB에 남기지 않는다.
  const ip=String(req.headers['x-forwarded-for']??'unknown').split(',')[0].trim().slice(0,128);
  const hashed=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${key}:account:${ip}`));
  const ipKey=[...new Uint8Array(hashed)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const takeBudget=async(subject:string):Promise<boolean>=>{
   const budget=await call('/rest/v1/rpc/server_take_account_rate',{method:'POST',body:JSON.stringify({p_key:subject})});
   if(!budget.ok){reply(503,'rate_store_unavailable');return false;}
   const rate=await budget.json() as {allowed:boolean;retryAfter:number};
   if(!rate.allowed){res.setHeader('retry-after',String(rate.retryAfter));reply(429,'rate_limited');return false;}
   return true;
  };
  if(!await takeBudget(ipKey))return;
  if(body.action==='sign-in'){
   if(!await takeBudget(`login-id:${body.id.toLowerCase().trim()}`))return;
   const found=await call('/rest/v1/rpc/server_id_account',{method:'POST',body:JSON.stringify({p_email:email})});
   if(!found.ok){reply(503,'service_unavailable');return;}
   const account=await found.json() as {id?:string;email?:string}|null;
   if(!account?.id){reply(401,'invalid_credentials');return;}
   // 기존 ID 전용 RPC는 UID만 반환한다. DB 적용 전에도 해당 UID의 합성 이메일 로그인을 유지한다.
   const loginEmail=account.email??email;
   const proof=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:loginEmail,password:body.password})});
   if(proof.status===429){const retry=proof.headers.get('retry-after');if(retry)res.setHeader('retry-after',retry);reply(429,'rate_limited');return;}
   const value=await proof.json().catch(()=>({})) as {user?:{id?:string};error_code?:string;code?:string};
   if(!proof.ok&&[400,422].includes(proof.status)&&(value.error_code??value.code)==='email_not_confirmed'&&loginEmail===email){
    const confirmed=await call(`/auth/v1/admin/users/${encodeURIComponent(account.id)}`,{method:'PUT',body:JSON.stringify({email,email_confirm:true})});
    if(!confirmed.ok){reply(503,'confirmation_failed');return;}
    const retry=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:body.password})});
    if(retry.status===429){const wait=retry.headers.get('retry-after');if(wait)res.setHeader('retry-after',wait);reply(429,'rate_limited');return;}
    const recovered=await retry.json().catch(()=>({})) as {user?:{id?:string}};
    if(!retry.ok||recovered.user?.id!==account.id){reply(401,'invalid_credentials');return;}
    res.status(200).json(recovered);return;
   }
   if(!proof.ok||value.user?.id!==account.id){reply(proof.status>=500?503:401,'invalid_credentials');return;}
   res.status(200).json(value);return;
  }
  if(body.action==='confirm-existing'){
   if(!await takeBudget(`login-id:${body.id.toLowerCase().trim()}`))return;
   // GoTrue는 비밀번호를 검증한 다음 email_not_confirmed를 반환한다. 이 응답만 소유권 증명으로 쓴다.
   const proof=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:body.password})});
   const result=await proof.json().catch(()=>({})) as {error_code?:string;code?:string};
   if(proof.status===429){const retry=proof.headers.get('retry-after');if(retry)res.setHeader('retry-after',retry);reply(429,'rate_limited');return;}
   if(![400,422].includes(proof.status)||(result.error_code??result.code)!=='email_not_confirmed'){reply(proof.status>=500?503:401,'invalid_credentials');return;}
   const found=await call('/rest/v1/rpc/server_id_account',{method:'POST',body:JSON.stringify({p_email:email})});
   if(!found.ok){reply(503,'service_unavailable');return;}
   const owned=await found.json() as {id?:string}|null;
   if(!owned?.id||(owned as {email?:string}).email&&((owned as {email?:string}).email!==email)){reply(401,'invalid_credentials');return;}
   const confirmed=await call(`/auth/v1/admin/users/${encodeURIComponent(owned.id)}`,{method:'PUT',body:JSON.stringify({email,email_confirm:true})});
   if(!confirmed.ok){reply(503,'confirmation_failed');return;}
   res.status(200).json({ok:true,userId:owned.id});return;
  }
  if(body.action!==undefined&&body.action!=='register'){reply(400,'invalid_request');return;}
  if(auth){
   if(!/^Bearer \S+$/.test(auth)){reply(401,'not_authenticated');return;}
   const who=await call('/auth/v1/user',{headers:{authorization:auth}});
   if(!who.ok){reply(who.status===429?429:who.status>=500?503:401,who.status>=500?'service_unavailable':'not_authenticated');return;}
   current=await who.json();
   if(!current?.id){reply(401,'not_authenticated');return;}
   const oldId=authEmailToAccountId(current.email);
   if(oldId && current.email!==email){reply(409,'already_linked');return;}
   if(current.is_anonymous!==true&&!oldId&&!current.email_confirmed_at){reply(409,'already_linked');return;}
  }
  if(current&&!await takeBudget(`user:${current.id}`))return;
  if(!current){
   const existing=await call('/rest/v1/rpc/server_id_account',{method:'POST',body:JSON.stringify({p_email:email})});
   if(!existing.ok){reply(503,'identity_store_unavailable');return;}
   if(await existing.json()){reply(409,'id_taken');return;}
  }
  const reserve=async(userId:string):Promise<boolean>=>{
   const result=await call('/rest/v1/rpc/server_set_account_id',{method:'POST',body:JSON.stringify({p_player:userId,p_id:body.id.trim().toLowerCase()})});
   if(!result.ok){reply(503,'identity_store_unavailable');return false;}
   if(await result.json()!==true){reply(409,'id_taken');return false;}
   return true;
  };
  if(current&&!await reserve(current.id))return;
  // 게스트는 같은 UID를 승격한다. 다른 사용자의 ID나 기존 계정을 덮어쓰지 않는다.
  const updated=await call(current?`/auth/v1/admin/users/${encodeURIComponent(current.id)}`:'/auth/v1/admin/users',{
   method:current?'PUT':'POST',body:JSON.stringify(current&&current.is_anonymous!==true&&!authEmailToAccountId(current.email)
    ? {email:current.email,password:body.password} : {email,password:body.password,email_confirm:true}),
  });
  if(!updated.ok){
   const error=await updated.json().catch(()=>({})) as {code?:string;error_code?:string};
   const code=error.error_code??error.code;
   if(code==='email_exists'||code==='user_already_exists'||updated.status===409){reply(409,'id_taken');return;}
   if(code==='weak_password'){reply(422,'weak_password');return;}
   if(updated.status===429){const retry=updated.headers.get('retry-after');if(retry)res.setHeader('retry-after',retry);reply(429,'rate_limited');return;}
   reply(503,'registration_failed');return;
  }
  const user=await updated.json() as {id?:string};
  if(!user.id||(current&&user.id!==current.id)){reply(503,'invalid_auth_response');return;}
  if(!current&&!await reserve(user.id))return;
  res.status(200).json({ok:true,userId:user.id,authEmail:current&&current.is_anonymous!==true?current.email:email});
 }catch{reply(503,'service_unavailable');}
}
