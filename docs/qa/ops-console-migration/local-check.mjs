import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../..',import.meta.url));
const admin=resolve(root,'../For-Garden-Admin');
const name=`fg-ops-migration-${Date.now()}`;
const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
const docker=(args,opts={})=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',env,...opts});
const sql=input=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input});
const read=p=>readFileSync(resolve(root,p),'utf8');
const readAdmin=p=>readFileSync(resolve(admin,'supabase/migrations',p),'utf8');
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 let ready=false;for(let i=0;i<120;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
 if(!ready)throw Error('PostgreSQL readiness timeout');
 sql(read('supabase/tests/launch-reset-bootstrap.sql'));
 sql('create schema if not exists extensions;create extension if not exists pgcrypto with schema extensions;');
 for(const f of readdirSync(resolve(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<'20261120000000_ops_moderation.sql').sort())sql(read(`supabase/migrations/${f}`));
 sql(readAdmin('20261026000000_recurring_ops.sql'));
 sql(readAdmin('20261119000000_ops_console_v2.sql'));
 sql(read('supabase/migrations/20261120000000_ops_moderation.sql'));
 sql(readAdmin('20261120100000_ops_console_v3.sql'));
 sql(readAdmin('20261121000000_ops_console_v4.sql'));
 console.log(sql(read('docs/qa/ops-console-migration/verify.sql')));
 sql(read('supabase/migrations/20261122000000_game_events.sql'));
 sql(readAdmin('20261122100000_ops_analytics.sql'));
 sql(read('supabase/migrations/20261123000000_live_schedule.sql'));
 sql(readAdmin('20261123100000_ops_schedule.sql'));
 console.log(sql(read('docs/qa/ops-console-migration/verify-analytics-schedule.sql')));
 sql(read('supabase/migrations/20261124000000_launch_at.sql'));
 console.log(sql(read('docs/qa/ops-console-migration/verify-launch-at.sql')));
 console.log('PASS: real game/Admin dependency order on isolated PostgreSQL 17');
}finally{try{docker(['rm','-f',name]);}catch{}}
