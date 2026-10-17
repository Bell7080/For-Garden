import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUILD_LEVELS, GUILD_ROLE_LIMIT, GUILD_SHOP_PRODUCTS, guildCan, type GuildAction, type GuildRole } from "../../src/core/guild";
import { contentUnlockLevel } from "../../src/core/contentUnlock";

const sql = readFileSync(new URL("../../supabase/migrations/20261019000000_guild_basics.sql", import.meta.url), "utf8");
const numbers = (list: string) => list.split(",").map((v) => Number(v.trim()));

/** DB 함수에 옮겨 적은 표가 순수 모듈의 표와 같은 값인지 지킨다. 한쪽만 고치면 화면과 서버가 갈린다. */
describe("길드 SQL 표", () => {
  it("레벨 문턱과 정원이 TS 표와 같다", () => {
    const thresholds = /array\[([\d,]+)\]\) as t\(v\)/.exec(sql)?.[1];
    const capacities = /select \(array\[([\d,]+)\]\)\[least/.exec(sql)?.[1];
    expect(numbers(thresholds!)).toEqual(GUILD_LEVELS.map((l) => l.prosperity));
    expect(numbers(capacities!)).toEqual(GUILD_LEVELS.map((l) => l.capacity));
  });

  it("상점 상품의 값과 주간 한도가 TS 표와 같다", () => {
    const json = /select '(\[\{"productId".*?\])'::jsonb/.exec(sql)?.[1];
    expect(JSON.parse(json!)).toEqual(GUILD_SHOP_PRODUCTS.map((p) => ({ productId: p.id, price: p.price, weeklyLimit: p.weeklyLimit })));
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
});
