import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const reset = read("supabase/ops/launch_reset.sql");
const verify = read("supabase/ops/launch_reset_verify.sql");
const migrationFiles = readdirSync(new URL("../../supabase/migrations", import.meta.url)).filter((f) => f.endsWith(".sql")).sort();

const quoted = (text: string) => [...text.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
function resetList(name: string): string[] {
  const m = new RegExp(`${name} text\\[\\] := array\\[([^\\]]*)\\]`).exec(reset);
  if (!m) throw new Error(`${name} 목록 없음`);
  return quoted(m[1]);
}
function verifyList(name: string): string[] {
  const m = new RegExp(`${name}\\(t\\) as \\(values([\\s\\S]*?)\\n  \\)`).exec(verify);
  if (!m) throw new Error(`${name} 목록 없음`);
  return quoted(m[1]);
}

/** 마이그레이션이 만드는 표(`create table [if not exists] [schema.]name`). 스키마가 없으면 public이다. */
function migratedTables(): string[] {
  const out = new Set<string>();
  for (const file of migrationFiles) {
    const sql = read(`supabase/migrations/${file}`);
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)/gi)) out.add(`${m[1] ?? "public"}.${m[2]}`);
  }
  return [...out];
}

/** 이 저장소의 마이그레이션 밖(For-Garden-Web)에서 만들어지는 표. 같은 DB를 쓰므로 분류만 여기서 한다. */
const WEBSITE_TABLES = [
  "public.website_notices",
  "public.website_notice_translations",
  "public.website_preregistrations",
  "public.website_registration_limits",
];

describe("출시 초기화 표 분류", () => {
  const resetTables = resetList("reset_tables");
  const opsTables = resetList("ops_tables");
  const keepTables = resetList("keep_tables");
  const all = [...resetTables, ...opsTables, ...keepTables];

  it("마이그레이션이 만드는 모든 표가 reset/ops/keep 중 정확히 하나에 분류돼 있다", () => {
    const missing = migratedTables().filter((t) => !all.includes(t));
    expect(missing, `launch_reset.sql(과 launch_reset_verify.sql)에 분류를 더하세요: ${missing.join(", ")}`).toEqual([]);
  });

  it("목록에 적힌 표는 마이그레이션이나 홈페이지 표 중 하나에 실제로 있다(오타·삭제된 표 방지)", () => {
    const known = new Set([...migratedTables(), ...WEBSITE_TABLES]);
    expect(all.filter((t) => !known.has(t))).toEqual([]);
  });

  it("한 표가 두 목록에 함께 있지 않다", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("지우는 표의 기본이 되는 핵심 표가 reset에 있다", () => {
    for (const t of ["public.players", "public.player_saves", "public.asset_ledger", "public.guild_members", "public.request_receipts", "public.support_tickets"]) {
      expect(resetTables).toContain(t);
    }
  });

  it("실제 사람이 남긴 데이터와 운영 설정은 keep에 있다", () => {
    expect(keepTables).toEqual(expect.arrayContaining(["public.website_preregistrations", "public.admin_roles", "public.app_config", "public.reward_assets"]));
  });

  it("점검 SQL의 목록이 초기화 SQL과 같다", () => {
    const verifyAll = [...verifyList("reset_tables"), ...verifyList("special_tables"), ...verifyList("ops_tables"), ...verifyList("keep_tables")];
    expect([...verifyAll].sort()).toEqual([...all].sort());
    expect(verifyList("ops_tables").sort()).toEqual([...opsTables].sort());
    expect(verifyList("keep_tables").sort()).toEqual([...keepTables].sort());
  });
});

describe("출시 초기화 안전장치", () => {
  it("기본값은 dry이고 실행 값 네 줄이 한 곳에 있다", () => {
    expect(reset).toContain("p_mode text := 'dry';");
    expect(reset).toContain("p_confirm text := '';");
    expect(reset).toContain("p_expect_players bigint := -1;");
    expect(reset).toContain("p_purge_ops_content boolean := true;");
  });

  it("CASCADE로 지우지 않는다(보존 표를 조용히 지우는 길을 막는다)", () => {
    const code = reset.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/truncate[^;]*cascade/i);
    expect(code).toMatch(/restart identity/);
  });

  it("마이그레이션 폴더에 두지 않는다(자동 적용 방지)", () => {
    expect(migrationFiles.some((f) => /reset/i.test(f))).toBe(false);
  });

  it("세대 마이그레이션이 공개 설정 함수에 launch_epoch를 싣는다", () => {
    expect(read("supabase/migrations/20261020000000_launch_epoch.sql")).toContain("'launch_epoch', c.launch_epoch");
  });
});
