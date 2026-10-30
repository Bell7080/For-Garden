import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const name=`fg-legal-privacy-${Date.now()}`;
const env={...process.env}; for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[k];
const docker=(args,opts={})=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',env,...opts});
const sql=input=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input});
const read=p=>readFileSync(`${root}/${p}`,'utf8');
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine']);
 let ready=false;
 for(let i=0;i<120;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
 if(!ready)throw Error('PostgreSQL did not become ready');
 sql(read('supabase/tests/launch-reset-bootstrap.sql'));
 sql('create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;');
 for(const f of readdirSync(`${root}/supabase/migrations`).filter(f=>f.endsWith('.sql')).sort()) sql(read(`supabase/migrations/${f}`));
 console.log(sql("set app.legal_verify_purge='1';\n"+read('docs/qa/legal-privacy-migration/verify.sql')));
 console.log('PASS: all repository migrations applied to isolated PostgreSQL; legal consent, privacy support and deletion lifecycle executed');
}finally{try{docker(['rm','-f',name]);}catch{}}
