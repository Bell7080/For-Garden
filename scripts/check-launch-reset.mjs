/**
 * 출시 초기화 스크립트(supabase/ops/launch_reset.sql)와 점검(launch_reset_verify.sql)을 격리된 PostgreSQL에서 실제로 돌려 본다.
 * 운영/테스트 Supabase에는 붙지 않는다. 임시 PostgreSQL(로컬 바이너리 또는 docker `postgres:16-alpine`)을 만들었다가 지운다.
 * 모든 마이그레이션을 뼈대 위에 적용하고 모든 표에 표본을 넣은 뒤 건수 보고(dry) → 가드 → 실제 실행 → 점검까지 확인한다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => read(`supabase/migrations/${f}`));
const resetSql = read("supabase/ops/launch_reset.sql");
const verifySql = read("supabase/ops/launch_reset_verify.sql");
const bootstrap = read("supabase/tests/launch-reset-bootstrap.sql");
const seed = read("supabase/tests/launch-reset-seed.sql");

// ── 임시 서버 ────────────────────────────────────────────────────────────────────────
const pgBin = (existsSync("/usr/lib/postgresql") ? readdirSync("/usr/lib/postgresql") : []).sort().reverse().map((v) => `/usr/lib/postgresql/${v}/bin`).find((d) => existsSync(join(d, "initdb")));
const dockerName = `fg-launch-reset-${Date.now()}`;
const useDocker = !pgBin && spawnSync("docker", ["--host=unix:///var/run/docker.sock", "version"], { stdio: "ignore" }).status === 0;
if (!pgBin && !useDocker) throw new Error("PostgreSQL 바이너리(/usr/lib/postgresql/*/bin) 또는 docker가 필요합니다.");
const asRoot = process.getuid?.() === 0;
const wrap = (cmd, args) => (asRoot ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]);
const dir = mkdtempSync(join(tmpdir(), "fg-launch-reset-"));
const port = String(55000 + Math.floor(Math.random() * 900));
if (!useDocker && asRoot) chownSync(dir, Number(execFileSync("id", ["-u", "postgres"], { encoding: "utf8" })), 0);

function startServer() {
  if (useDocker) {
    execFileSync("docker", ["--host=unix:///var/run/docker.sock", "run", "-d", "--rm", "--network", "none", "--name", dockerName, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      if (spawnSync("docker", ["--host=unix:///var/run/docker.sock", "exec", dockerName, "pg_isready", "-U", "postgres"], { stdio: "ignore" }).status === 0) return;
      spawnSync("sleep", ["1"]);
    }
    throw new Error("docker postgres가 뜨지 않았습니다.");
  }
  const run = (cmd, args) => { const [c, a] = wrap(join(pgBin, cmd), args); execFileSync(c, a, { stdio: "ignore" }); };
  run("initdb", ["-D", join(dir, "data"), "-A", "trust"]);
  run("pg_ctl", ["-D", join(dir, "data"), "-o", `-p ${port} -k ${dir}`, "-l", join(dir, "log"), "-w", "start"]);
}
function stopServer() {
  try {
    if (useDocker) spawnSync("docker", ["--host=unix:///var/run/docker.sock", "rm", "-f", dockerName], { stdio: "ignore" });
    else { const [c, a] = wrap(join(pgBin, "pg_ctl"), ["-D", join(dir, "data"), "-m", "immediate", "stop"]); spawnSync(c, a, { stdio: "ignore" }); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** SQL을 한 번의 psql 호출로 실행한다. 실패하면 { ok: false, err }를 돌려준다(예상한 오류를 검사하려고). */
function psql(db, sql, { tuples = false } = {}) {
  const base = ["-v", "ON_ERROR_STOP=1", "-q", "-d", db, ...(tuples ? ["-At", "-F", "|"] : [])];
  const [cmd, args] = useDocker
    ? ["docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", dockerName, "psql", "-U", "postgres", ...base]]
    : wrap(join(pgBin, "psql"), ["-h", dir, "-p", port, ...base]);
  const r = spawnSync(cmd, args, { input: sql, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const must = (db, sql, opts) => { const r = psql(db, sql, opts); assert.ok(r.ok, `SQL 실패:\n${r.err}\n${sql.slice(0, 200)}`); return r.out; };
const scalar = (db, sql) => must(db, sql, { tuples: true });

function withParams(sql, p) {
  const sub = (re, value) => { assert.match(sql, re, `실행 값 줄을 찾지 못했습니다: ${re}`); sql = sql.replace(re, value); };
  if (p.mode) sub(/p_mode text := '[^']*';/, `p_mode text := '${p.mode}';`);
  if (p.confirm !== undefined) sub(/p_confirm text := '[^']*';/, `p_confirm text := '${p.confirm}';`);
  if (p.expect !== undefined) sub(/p_expect_players bigint := -?\d+;/, `p_expect_players bigint := ${p.expect};`);
  if (p.purge !== undefined) sub(/p_purge_ops_content boolean := (true|false);/, `p_purge_ops_content boolean := ${p.purge};`);
  return sql;
}

let n = 0;
function freshDb() {
  const db = `t${++n}`;
  must("postgres", `create database ${db}`);
  must(db, bootstrap);
  for (const m of migrations) must(db, m);
  must(db, seed);
  return db;
}
const CONFIRM = "RESET-FORGARDEN-LAUNCH";
const live = (db, extra = {}) => psql(db, withParams(resetSql, { mode: "execute", confirm: CONFIRM, expect: Number(scalar(db, "select count(*) from public.players")), ...extra }));

/** 목록(reset/ops/keep)을 SQL 원문에서 읽는다. */
function listOf(name) {
  const m = new RegExp(`${name} text\\[\\] := array\\[([^\\]]*)\\]`).exec(resetSql);
  assert.ok(m, `${name} 목록을 찾지 못했습니다.`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

startServer();
let failed = false;
try {
  // ── A. 전체 흐름 ───────────────────────────────────────────────────────────────────
  const a = freshDb();
  must(a, read("supabase/tests/currency-log-assertions.sql"));
  for (const t of [...listOf("reset_tables"), ...listOf("ops_tables")]) {
    assert.ok(Number(scalar(a, `select count(*) from ${t}`)) > 0, `표본이 없는 표: ${t} (supabase/tests/launch-reset-seed.sql에 한 줄을 더하세요)`);
  }
  assert.ok(Number(scalar(a, "select count(*) from auth.users")) === 4, "표본 계정 수");

  const dry = psql(a, resetSql);
  assert.ok(!dry.ok && dry.err.includes("DRY-RUN"), `dry 기본값이 보고 후 되돌려야 합니다:\n${dry.err}`);
  assert.ok(dry.err.includes("삭제 public.player_assets = 4"), "dry 보고에 건수가 있어야 합니다");
  assert.equal(scalar(a, "select count(*) from public.players"), "4", "dry는 아무것도 바꾸지 않는다");
  assert.equal(scalar(a, "select count(*) from auth.users"), "4");

  assert.match(psql(a, withParams(resetSql, { mode: "execute", expect: 4 })).err, /CONFIRM_REQUIRED/);
  assert.match(psql(a, withParams(resetSql, { mode: "execute", confirm: CONFIRM, expect: 99 })).err, /WRONG_DATABASE/);
  assert.match(psql(a, withParams(resetSql, { mode: "execute", confirm: CONFIRM })).err, /WRONG_DATABASE/, "expect 기본값(-1)으로는 실행되지 않는다");
  assert.match(live(a).err, /MAINTENANCE_REQUIRED/, "점검 모드 없이 실행되면 안 된다");
  assert.equal(scalar(a, "select count(*) from public.players"), "4");

  // 분류되지 않은 새 표, 독립 시퀀스, 보존 버킷 밖 저장소 파일은 아무것도 지우지 않고 멈춘다.
  must(a, "update public.app_config set maintenance = true where id = 1");
  must(a, "create table public.zz_new_feature(id int)");
  assert.match(live(a).err, /UNCLASSIFIED_TABLES.*zz_new_feature/s);
  must(a, "drop table public.zz_new_feature; create sequence public.zz_free_seq");
  assert.match(live(a).err, /STANDALONE_SEQUENCES.*zz_free_seq/s);
  must(a, "drop sequence public.zz_free_seq; insert into storage.buckets(id,name) values ('avatars','avatars'); insert into storage.objects(bucket_id,name) values ('avatars','a.png')");
  assert.match(live(a).err, /STORAGE_NOT_EMPTY/);
  must(a, "delete from storage.objects where bucket_id = 'avatars'; delete from storage.buckets where id = 'avatars'");
  assert.equal(scalar(a, "select count(*) from public.players"), "4", "멈춘 실행은 아무것도 바꾸지 않는다");

  const before = verifyRows(a);
  assert.equal(before.get("ALL").ok, "f", "초기화 전에는 점검이 실패해야 한다(잔재 검출)");

  const done = live(a);
  assert.ok(done.ok, `실행 실패:\n${done.err}`);
  const after = verifyRows(a);
  const failures = [...after].filter(([k, v]) => v.ok === "f");
  assert.deepEqual(failures, [], `점검 실패: ${JSON.stringify(failures)}`);
  assert.equal(after.get("ALL").ok, "t");
  assert.equal(scalar(a, "select count(*) from auth.users"), "1");
  assert.equal(scalar(a, "select id::text || '|' || uid from public.players"), "00000000-0000-0000-0000-0000000000a1|100000001", "운영자만 남고 UID는 처음부터");
  assert.equal(scalar(a, "select count(*) from auth.sessions where user_id <> '00000000-0000-0000-0000-0000000000a1'"), "0", "운영자 말고는 세션이 남지 않는다");
  assert.equal(scalar(a, "select count(*) from auth.refresh_tokens r join auth.sessions s on s.id = r.session_id where s.user_id <> '00000000-0000-0000-0000-0000000000a1'"), "0");
  assert.equal(scalar(a, "select count(*) from auth.audit_log_entries"), "0");
  assert.equal(scalar(a, "select count(*) from public.website_preregistrations"), "1", "사전 등록자는 보존");
  assert.equal(scalar(a, "select count(*) from public.website_notices"), "1");
  assert.equal(scalar(a, "select count(*) from storage.objects where bucket_id = 'notice-images'"), "1", "공지 이미지는 보존");
  assert.equal(scalar(a, "select count(*) from public.mails") + scalar(a, "select count(*) from public.coupons"), "00");
  assert.equal(scalar(a, "select count(*) from public.admin_audit_log where action = 'launch_reset'"), "1");
  assert.notEqual(scalar(a, "select launch_epoch from public.app_config"), "");
  assert.match(scalar(a, "select public.get_public_config()->>'launch_epoch'"), /^\d{8}T\d{6}-[0-9a-f]{8}$/);
  // 다음 가입자는 운영자 다음 번호를 받고, 티켓·장부 번호도 1부터 다시 센다.
  must(a, "insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000b2')");
  assert.equal(scalar(a, "select uid from public.players where id = '00000000-0000-0000-0000-0000000000b2'"), "100000002");
  must(a, "insert into public.support_tickets(source,category,subject,body,player_id) values ('game','bug','s','b','00000000-0000-0000-0000-0000000000b2')");
  assert.equal(scalar(a, "select ticket_no from public.support_tickets"), "1");
  // 그 뒤에 테스트 계정이 생기면 점검이 다시 잡아낸다.
  assert.equal(verifyRows(a).get("ALL").ok, "f", "초기화 뒤 생긴 계정/기록은 잔재로 잡힌다");
  // 두 번 실행해도 같은 상태가 된다.
  const again = live(a);
  assert.ok(again.ok, `재실행 실패:\n${again.err}`);
  assert.equal(verifyRows(a).get("ALL").ok, "t");

  // ── B. 우편·쿠폰 정의를 남기는 경우 ────────────────────────────────────────────────────
  const b = freshDb();
  must(b, "update public.app_config set maintenance = true where id = 1");
  const keep = live(b, { purge: false });
  assert.ok(keep.ok, `purge=false 실패:\n${keep.err}`);
  assert.equal(scalar(b, "select count(*) from public.mails"), "1");
  assert.equal(scalar(b, "select redeemed_count from public.coupons"), "0", "쿠폰 사용 횟수는 되돌린다");
  assert.equal(scalar(b, "select count(*) from public.coupon_codes where redeemed_by is not null or redeemed_at is not null"), "0", "단일 코드 사용 표시는 되돌린다");
  assert.equal(scalar(b, "select count(*) from public.mail_claims") + scalar(b, "select count(*) from public.coupon_redemptions"), "00");
  assert.equal(verifyRows(b).get("ALL").ok, "t");

  console.log("출시 초기화 검증 통과: 건수 보고, 가드 5종, 분류 누락 감지, 실행, 점검, 재실행, 우편·쿠폰 보존 모드");
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  stopServer();
}
process.exit(failed ? 1 : 0);

function verifyRows(db) {
  const rows = new Map();
  for (const line of must(db, verifySql, { tuples: true }).split("\n")) {
    const [check, ok, ...detail] = line.split("|");
    rows.set(check, { ok, detail: detail.join("|") });
  }
  return rows;
}
