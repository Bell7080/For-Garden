import assert from 'node:assert/strict';
export async function run(sql:(s:string)=>string){
 const key='a'.repeat(64);
 const call=()=>JSON.parse(sql(`select public.server_take_account_rate('${key}');`));
 for(let i=0;i<5;i++)assert.equal(call().allowed,true);
 const blocked=call();assert.equal(blocked.allowed,false);assert(blocked.retryAfter>0&&blocked.retryAfter<=60);
 for(let i=0;i<6;i++)assert.equal(call().allowed,false);
 assert.equal(sql(`select count(*) from public.support_limits where key='account:${key}';`),'5','blocked retries must not move the expiration');
 sql(`update public.support_limits set at=now()-interval '61 seconds' where key='account:${key}';`);assert.equal(call().allowed,true);
 sql(`insert into public.support_limits(key,at) select 'account:${key}',now()-interval '120 seconds' from generate_series(1,14);`);
 const hour=call();assert.equal(hour.allowed,false);assert(hour.retryAfter>3000&&hour.retryAfter<=3600);
 sql(`update public.support_limits set at=now()-interval '3601 seconds' where key='account:${key}';`);assert.equal(call().allowed,true);
 assert.equal(sql("select has_function_privilege('authenticated','public.server_take_account_rate(text)','execute');"),'f');
 assert.equal(sql("select has_function_privilege('anon','public.server_take_account_rate(text)','execute');"),'f');
 sql("insert into auth.users(id,email) values('00000000-0000-0000-0000-000000009999','garden_01@id.forgarden.app');");
 assert.equal(JSON.parse(sql("select public.server_id_account('garden_01@id.forgarden.app');")).id,'00000000-0000-0000-0000-000000009999');
 assert.equal(sql("select public.server_id_account('garden_02@id.forgarden.app') is null;"),'t');
 assert.equal(sql("select has_function_privilege('authenticated','public.server_id_account(text)','execute');"),'f');
 console.log(JSON.stringify({minuteLimit:true,hourLimit:true,blockedRetriesDoNotExtend:true,expiresAndRecovers:true,serviceRoleOnly:true}));
}
