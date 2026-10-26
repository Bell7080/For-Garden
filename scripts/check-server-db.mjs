/** 운영 DB를 사용하지 않는다. 외부 네트워크 없는 임시 PostgreSQL 컨테이너만 만들고 제거한다. */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";
const exec = promisify(execFile),
  name = `fg-server-check-${Date.now()}`,
  dir = await mkdtemp(join(tmpdir(), "fg-db-check-"));
const docker = ["--host=unix:///var/run/docker.sock"],
  a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002";
let started = false;
function sql(query) {
  return execFileSync(
    "docker",
    [
      ...docker,
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
function concurrent(query) {
  return exec(
    "docker",
    [
      ...docker,
      "exec",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  );
}
try {
  execFileSync(
    "docker",
    [
      ...docker,
      "run",
      "-d",
      "--name",
      name,
      "--network",
      "none",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    ],
    { stdio: "pipe" },
  );
  started = true;
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try {
      // 초기화용 임시 서버는 Unix socket만 연다. 최종 서버의 TCP 준비까지 기다린다.
      execFileSync("docker", [...docker, "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "pipe" });
      sql("select 1");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert(ready, "PostgreSQL not ready");
  for (const file of [
    "supabase/tests/bootstrap.sql",
    "supabase/migrations/20261017150000_server_state.sql",
    "supabase/migrations/20261018000000_server_release.sql",
    "supabase/tests-server-release.sql",
  ])
    sql(await readFile(file, "utf8"));
  sql(
    `insert into auth.users values('${a}'),('${b}');insert into public.players(id) values('${a}'),('${b}');insert into public.server_public_profiles(player_id,profile) select id,jsonb_build_object('id',id,'uid',uid::text,'displayName',id::text,'favoriteRelic',jsonb_build_object('relicId','torika')) from public.players;`,
  );
  await Promise.all([
    concurrent(
      `begin;select public.server_social_call('${a}','sendRequest','["${b}"]','request-mutual-a');select pg_sleep(.1);commit;`,
    ),
    concurrent(
      `begin;select public.server_social_call('${b}','sendRequest','["${a}"]','request-mutual-b');select pg_sleep(.1);commit;`,
    ),
  ]);
  assert.equal(
    sql(
      "select count(*) from public.server_friend_edges where status='friend'",
    ),
    "1",
  );
  await Promise.all([
    concurrent(
      `select public.server_social_call('${a}','rentFavoriteRelic','["${b}"]','concurrent-rental');`,
    ),
    concurrent(
      `select public.server_social_call('${a}','rentFavoriteRelic','["${b}"]','concurrent-rental');`,
    ),
  ]);
  assert.equal(
    sql(
      `select points||':'||rental_uses from public.server_social_wallets where player_id='${a}'`,
    ),
    "10:1",
  );
  assert.equal(
    sql(
      `select points from public.server_social_wallets where player_id='${b}'`,
    ),
    "10",
  );
  const instance = {
    id: "world-concurrent",
    kind: "world",
    bossRelicId: "rex",
    difficulty: "rampage",
    openedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    myDamage: 10,
    appliedDamage: 10,
    attemptsUsed: 1,
    settled: false,
    summonedByMe: false,
  };
  sql(
    `insert into public.server_raids(id,definition,ends_at) values('world-concurrent','${JSON.stringify({ ...instance, myDamage: 0, appliedDamage: 0, attemptsUsed: 0 })}',now()+interval '1 day');`,
  );
  function commit(player, revision, key) {
    const changes = [
      {
        instance,
        expectedRevision: String(revision),
        damageDelta: 10,
        appliedDelta: 10,
        attemptsDelta: 1,
        totalHp: 100,
      },
    ];
    return `select public.server_commit_state('${player}',null,'{}','hash',1,'${JSON.stringify({ _raids: changes })}','submitRaidDamage','${key}','{}');`;
  }
  const attempts = await Promise.allSettled([
    concurrent(commit(a, 1, "raid-concurrent-a")),
    concurrent(commit(b, 1, "raid-concurrent-b")),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((r) => r.status === "rejected").length, 1);
  assert.equal(
    sql("select damage from public.server_raids where id='world-concurrent'"),
    "10",
  );
  assert.equal(
    sql(
      "select count(*) from public.server_raid_members where raid_id='world-concurrent' and damage=10",
    ),
    "1",
  );
  const loser = attempts[0].status === "rejected" ? a : b;
  sql(commit(loser, 2, "raid-concurrent-retry"));
  assert.equal(
    sql("select damage from public.server_raids where id='world-concurrent'"),
    "20",
  );
  const context = JSON.parse(
    sql(`select public.server_raid_context('${a}','[]');`),
  );
  const outfile = join(dir, "contract.mjs");
  await build({
    stdin: {
      contents: `import {saveManager} from './src/state/SaveManager';import {createDefaultSession} from './src/state/session';export function validate(context){const state=createDefaultSession();state.raid.instances=context.records.map(r=>r.instance);return saveManager.parse(saveManager.exportData(state)).raid.instances;}`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    define: {
      "import.meta.env.MODE": '"production"',
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
      "import.meta.env": "{}",
    },
  });
  const { validate } = await import(pathToFileURL(outfile).href);
  assert.equal(validate(context)[0].id, "world-concurrent");
  console.log(
    "PASS: PostgreSQL migration + social/raid/RLS assertions; concurrent mutual requests, duplicate rental and raid conflict/retry; real DB JSON → production SaveManager contract",
  );
} finally {
  if (started)
    execFileSync("docker", [...docker, "rm", "-f", name], { stdio: "pipe" });
  await rm(dir, { recursive: true, force: true });
}
