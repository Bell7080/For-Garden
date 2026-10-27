import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

type Role = "anon" | "authenticated" | "service_role";
const ROLES: Role[] = ["anon", "authenticated", "service_role"];

/** 마이그레이션을 파일 순서대로 따라가며 함수별로 어느 역할에 실행 권한이 남는지 계산한다(public 함수만). */
function replayGrants(): Map<string, Set<Role>> {
  const grants = new Map<string, Set<Role>>();
  const files = readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = read(`supabase/migrations/${file}`).replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/\b(grant|revoke)\s+execute\s+on\s+(all\s+functions\s+in\s+schema\s+public|function\s+[^;]+?)\s+(to|from)\s+([^;]+);/gi)) {
      const [, verb, target, , roleList] = m;
      const roles = roleList.split(",").map((r) => r.trim().toLowerCase()).filter((r): r is Role => (ROLES as string[]).includes(r));
      const everyone = /\bpublic\b/i.test(roleList);
      const affected = everyone ? ROLES : roles;
      const names = /all\s+functions/i.test(target)
        ? [...grants.keys()]
        : [...target.matchAll(/\bpublic\.([a-z_0-9]+)\s*\(/gi)].map((x) => x[1]);
      for (const name of names) {
        const set = grants.get(name) ?? new Set<Role>();
        for (const role of affected) verb.toLowerCase() === "grant" ? set.add(role) : set.delete(role);
        grants.set(name, set);
      }
    }
  }
  return grants;
}

const names = (source: string, pattern: RegExp) => [...new Set([...source.matchAll(pattern)].map((m) => m[1]))];

/**
 * 클라이언트가 로그인 토큰으로 직접 부르는 함수는 실행 권한이 있어야 하고, 서버(service_role)만 부르는 함수는
 * 로그인 사용자에게 열려 있으면 안 된다. 권한을 회수한 뒤 호출만 남는 일(upload_my_save 403)을 빌드에서 잡는다.
 */
describe("rpc 실행 권한 계약", () => {
  const grants = replayGrants();
  const can = (name: string, role: Role) => grants.get(name)?.has(role) ?? false;

  // 서버 권한으로만 쓰도록 회수된 쓰기 함수다. 클라이언트 코드에 호출이 남아 있다면 알려진 잔재로만 허용한다.
  const REVOKED_FROM_CLIENT = ["upload_my_save", "remove_my_save"];

  const clientCalls = [
    ...names(read("src/api/SupabaseAccountApi.ts"), /this\.rpc\("([a-z_]+)"/g),
    ...names(read("src/api/SupportApi.ts"), /this\.call\("([a-z_]+)"/g),
  ];
  const serverCalls = names(read("src/server/supabaseStore.ts"), /\brpc\("([a-z_]+)"/g);

  it("계약 검사가 실제 호출을 찾아낸다", () => {
    expect(clientCalls.length).toBeGreaterThan(5);
    expect(serverCalls.length).toBeGreaterThan(5);
    expect(can("ping", "anon")).toBe(true);
  });

  it("클라이언트가 직접 부르는 함수는 로그인 사용자에게 열려 있다", () => {
    const closed = clientCalls.filter((n) => !REVOKED_FROM_CLIENT.includes(n) && !can(n, "authenticated"));
    expect(closed).toEqual([]);
  });

  it("회수한 쓰기 함수는 계속 닫혀 있다", () => {
    for (const name of REVOKED_FROM_CLIENT) expect(can(name, "authenticated")).toBe(false);
  });

  it("서버가 부르는 함수는 service_role에 열려 있고 로그인 사용자에게는 닫혀 있다", () => {
    expect(serverCalls.filter((n) => !can(n, "service_role"))).toEqual([]);
    expect(serverCalls.filter((n) => can(n, "authenticated") || can(n, "anon"))).toEqual([]);
  });
});
