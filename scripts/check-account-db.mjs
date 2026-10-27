/** 격리 PostgreSQL에서 실제 운영 규칙/저장 RPC로 컨텐츠 종료를 검사한다. 운영 DB 접속 없음. */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const name=`fg-account-db-${Date.now()}`, dir=mkdtempSync(join(tmpdir(),'fg-account-db-'));
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']});
const sql=query=>docker(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],query).trim();
try{
 docker(['run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine']);
 let ready=false;for(let i=0;i<50;i++){try{sql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}
 if(!ready)throw Error('PostgreSQL not ready');
 sql(readFileSync('supabase/tests/launch-reset-bootstrap.sql','utf8'));
 for(const f of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort())sql(readFileSync(join('supabase/migrations',f),'utf8'));
 const outfile=join(dir,'account-db.mjs');
 await build({entryPoints:['tests/helpers/accountRegistrationRateScenarios.ts'],outfile,bundle:true,platform:'node',format:'esm',target:'node22',define:{'import.meta.env':'{}','import.meta.env.MODE':'"production"','import.meta.env.DEV':'false','import.meta.env.PROD':'true'}});
 const {run}=await import(pathToFileURL(outfile).href);await run(sql);
}finally{try{docker(['rm','-f',name]);}finally{rmSync(dir,{recursive:true,force:true});}}
