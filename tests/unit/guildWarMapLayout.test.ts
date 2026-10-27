import { describe, expect, it } from "vitest";
import { guildWarMapSlots } from "../../src/core/guildWarMap";
import { GUILD_SCREEN, GUILD_WAR_MAP, guildWarColumnX, guildWarNodeSpot } from "../../src/ui/guildLayout";

describe("길드전 방어진 지도 자리", () => {
  it("가장 큰 레벨에서도 칸이 기둥·본문 안에 들고 서로 겹치지 않는다", () => {
    const nodes = guildWarMapSlots(10).map((slot) => ({ slot, ...guildWarNodeSpot(slot) }));
    const half = GUILD_WAR_MAP.column.width / 2;
    for (const { slot, x, y, size } of nodes) {
      const column = guildWarColumnX(slot.branch);
      expect(x - size / 2, slot.id).toBeGreaterThanOrEqual(column - half);
      expect(x + size / 2, slot.id).toBeLessThanOrEqual(column + half);
      expect(y - size / 2, slot.id).toBeGreaterThan(GUILD_WAR_MAP.header);
      // 이름줄까지 기둥 밑변 안에 든다.
      expect(y + size / 2 + GUILD_WAR_MAP.nameGap + 20, slot.id).toBeLessThanOrEqual(GUILD_WAR_MAP.column.bottom);
    }
    for (let a = 0; a < nodes.length; a += 1) for (let b = a + 1; b < nodes.length; b += 1) {
      const p = nodes[a], q = nodes[b];
      const apart = Math.abs(p.x - q.x) >= (p.size + q.size) / 2 || Math.abs(p.y - q.y) >= (p.size + q.size) / 2 + GUILD_WAR_MAP.nameGap + 24;
      expect(apart, `${p.slot.id} ↔ ${q.slot.id}`).toBe(true);
    }
  });

  it("세 기둥이 화면 좌우 여백 안에 든다", () => {
    const half = GUILD_WAR_MAP.column.width / 2;
    expect(guildWarColumnX(1) - half).toBeGreaterThanOrEqual(GUILD_SCREEN.side - 1);
    expect(guildWarColumnX(3) + half).toBeLessThanOrEqual(GUILD_SCREEN.side + GUILD_SCREEN.width + 1);
    expect(GUILD_WAR_MAP.column.bottom).toBeLessThanOrEqual(GUILD_SCREEN.body.bottom);
  });
});
