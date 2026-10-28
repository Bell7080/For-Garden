import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUILD_ATTENDANCE_CYCLE, GUILD_LEVELS, GUILD_ROLE_LIMIT, GUILD_SHOP_PRODUCTS, guildCan, type GuildAction, type GuildRole } from "../../src/core/guild";
import { contentUnlockLevel } from "../../src/core/contentUnlock";
import { GUILD_WAR_GRUNTS } from "../../src/core/guildWar";

const sql = readFileSync(new URL("../../supabase/migrations/20261019000000_guild_basics.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cycleSql = readFileSync(new URL("../../supabase/migrations/20261021000000_guild_attendance_cycle.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const numbers = (list: string) => list.split(",").map((v) => Number(v.trim()));

/** DB 함수에 옮겨 적은 표가 순수 모듈의 표와 같은 값인지 지킨다. 한쪽만 고치면 화면과 서버가 갈린다. */
describe("길드 SQL 표", () => {
  it("레벨 문턱과 정원이 TS 표와 같다", () => {
    const thresholds = /array\[([\d,]+)\]\) as t\(v\)/.exec(sql)?.[1];
    const capacities = /select \(array\[([\d,]+)\]\)\[least/.exec(sql)?.[1];
    expect(numbers(thresholds!)).toEqual(GUILD_LEVELS.map((l) => l.prosperity));
    expect(numbers(capacities!)).toEqual(GUILD_LEVELS.map((l) => l.capacity));
  });

  it("상점 상품의 값·한도·주기·레벨 칸이 TS 표와 같다", () => {
    const shopSql = readFileSync(new URL("../../supabase/migrations/20261110000000_guild_shop_tabs.sql", import.meta.url), "utf8");
    const json = /select '(\[\{"productId".*?\])'::jsonb/.exec(shopSql)?.[1];
    expect(JSON.parse(json!)).toEqual(GUILD_SHOP_PRODUCTS.map((p) => ({ productId: p.id, price: p.price, limit: p.limit, refresh: p.refresh, ...(p.minGuildLevel ? { minGuildLevel: p.minGuildLevel } : {}) })));
  });

  it("개방 레벨이 TS와 같다", () => {
    expect(Number(/server_guild_unlock_level\(\) returns integer[^;]*select (\d+);/.exec(sql)?.[1])).toBe(contentUnlockLevel("guild"));
  });

  it("직위의 권한이 TS와 같다", () => {
    const actions: GuildAction[] = ["approve", "kick", "notice", "promote", "badge", "joinMode", "disband"];
    const body = /server_guild_can\([^)]*\)[\s\S]*?end;\n\$\$/.exec(sql)![0];
    for (const role of ["leader", "vice", "officer"] as GuildRole[]) {
      const listed = new RegExp(`when '${role}' then p_action in \\(([^)]*)\\)`).exec(body)![1].split(",").map((v) => v.trim().replace(/'/g, ""));
      expect(listed.sort(), role).toEqual(actions.filter((a) => guildCan(role, a)).sort());
    }
  });

  it("직위 정원 상한이 TS와 같다", () => {
    expect(sql).toContain(`role_in = 'vice' and cnt >= ${GUILD_ROLE_LIMIT.vice}`);
    expect(sql).toContain(`role_in = 'officer' and cnt >= ${GUILD_ROLE_LIMIT.officer}`);
  });

  it("출석 순환의 길드 쪽 몫이 TS 표와 같다", () => {
    const json = /server_guild_attendance_cycle\(\)[\s\S]*?select '(\[.*?\])'::jsonb/.exec(cycleSql)?.[1];
    expect(JSON.parse(json!)).toEqual(GUILD_ATTENDANCE_CYCLE.map((d) => ({ prosperity: d.prosperity, contribution: d.contribution, coin: d.coin })));
  });
});

describe("길드전 방어진 SQL 표", () => {
  const warSql = readFileSync(new URL("../../supabase/migrations/20261108000000_guild_war_defense.sql", import.meta.url), "utf8");
  it("레벨별 일반 칸 수가 TS 표와 같다", () => {
    const rows = /array\[(\[[\d,\[\]]+\])\]\)\[least/.exec(warSql)?.[1];
    expect(JSON.parse(`[${rows!}]`)).toEqual(GUILD_WAR_GRUNTS.map((row) => [...row]));
  });
  it("배치 권한이 TS와 같다", () => {
    const listed = /'canArrange', p_role in \(([^)]*)\)/.exec(warSql)![1].split(",").map((v) => v.trim().replace(/'/g, ""));
    expect(listed.sort()).toEqual((["leader", "vice", "officer", "member"] as GuildRole[]).filter((r) => guildCan(r, "formation")).sort());
  });
});
