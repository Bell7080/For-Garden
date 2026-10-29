import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const name=`fg-guild-standby-${Date.now()}`;
const env={...process.env}; for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[k];
const docker=(args,opts={})=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',env,...opts});
const sql=input=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input});
const read=p=>readFileSync(`${root}/${p}`,'utf8');
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine']);
 for(let i=0;i<40;i++){try{docker(['exec',name,'pg_isready','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,250));}}
 sql(read('supabase/tests/launch-reset-bootstrap.sql'));
 for(const f of readdirSync(`${root}/supabase/migrations`).filter(f=>f.endsWith('.sql')).sort()) sql(read(`supabase/migrations/${f}`));
 // Preparation phase override exists only inside this isolated, disposable database.
 sql("create or replace function public.server_guild_war_prep(p_t timestamptz) returns boolean language sql immutable set search_path='' as $$select true$$;");
 console.log(sql("set app.guild_verify_match='1';\n"+read('docs/qa/guild-standby-migration-2026-10-29/verify.sql')));
 console.log('PASS: all repository migrations applied to isolated PostgreSQL; standby preparation-phase actions and pre-match autofill executed');
}finally{try{docker(['rm','-f',name]);}catch{}}
