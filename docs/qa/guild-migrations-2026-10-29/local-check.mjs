import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const name=`fg-guild392-${Date.now()}`;
const env={...process.env}; for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[k];
const docker=(args,opts={})=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',env,...opts});
const sql=input=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input});
const read=p=>readFileSync(`${root}/${p}`,'utf8');
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine']);
 for(let i=0;i<40;i++){try{docker(['exec',name,'pg_isready','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,250));}}
 sql(read('supabase/tests/launch-reset-bootstrap.sql'));
 for(const f of readdirSync(`${root}/supabase/migrations`).filter(f=>f.endsWith('.sql')).sort()) sql(read(`supabase/migrations/${f}`));
 // Only the isolated database fixes the automatic-placement wrapper's clock to a preparation day.
 const src=read('supabase/migrations/20261115000000_guild_war_auto_arrange.sql');
 const fn=src.slice(src.indexOf('create or replace function public.server_guild_call('));
 if(!fn.includes('t timestamptz := now()')) throw Error('clock anchor missing');
 sql(fn.replace('t timestamptz := now()',"t timestamptz := '2026-10-28 12:00:00+00'"));
 console.log(sql("set app.guild_verify_fixed_prep='1';\n"+read('docs/qa/guild-migrations-2026-10-29/verify.sql')));
 console.log('PASS: all repository migrations applied to isolated PostgreSQL; full preparation-phase actions executed');
}finally{try{docker(['rm','-f',name]);}catch{}}
