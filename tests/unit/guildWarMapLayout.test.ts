import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { guildWarMapSlots } from "../../src/core/guildWarMap";
import { GUILD_SCREEN, GUILD_WAR_MAP, guildWarActionX, guildWarNextSpot, guildWarNodeSpot } from "../../src/ui/guildLayout";

describe("길드전 방어진 지도 배치", () => {
  // 지부 하나가 한 판이다 — 가장 넓은 레벨의 제1지부(일반 일곱)로 잰다.
  const nodes = guildWarMapSlots(10).filter((slot) => slot.branch === 1).map((slot) => ({ slot, ...guildWarNodeSpot(slot) }));

  it("칸과 이름줄이 판 안·화면 안에 든다", () => {
    for (const { slot, x, y, size } of nodes) {
      expect(x - size / 2, slot.id).toBeGreaterThanOrEqual(40);
      expect(x + size / 2, slot.id).toBeLessThanOrEqual(BASE_WIDTH - 40);
      expect(y - size / 2, slot.id).toBeGreaterThan(GUILD_WAR_MAP.note + 20);
      expect(y + size / 2 + GUILD_WAR_MAP.nameGap + 20, slot.id).toBeLessThanOrEqual(GUILD_WAR_MAP.field.bottom);
    }
    expect(GUILD_WAR_MAP.actions.y + GUILD_WAR_MAP.actions.height / 2).toBeLessThan(GUILD_SCREEN.tabs.y - GUILD_SCREEN.tabs.height / 2);
  });

  it("칸끼리(이름줄 포함) 겹치지 않는다", () => {
    for (const [i, p] of nodes.entries()) for (const q of nodes.slice(i + 1)) {
      const apart = Math.abs(p.x - q.x) >= (p.size + q.size) / 2 + 20 || Math.abs(p.y - q.y) >= (p.size + q.size) / 2 + GUILD_WAR_MAP.nameGap + 24;
      expect(apart, `${p.slot.id} ↔ ${q.slot.id}`).toBe(true);
    }
  });

  it("일반은 같은 쪽 정예로, 정예는 우두머리로 이어진다", () => {
    expect(guildWarNextSpot({ kind: "grunt", index: 0 })).toEqual({ kind: "elite", index: 0 });
    expect(guildWarNextSpot({ kind: "grunt", index: 3 })).toEqual({ kind: "elite", index: 1 });
    expect(guildWarNextSpot({ kind: "elite", index: 1 })).toEqual({ kind: "boss", index: 0 });
    expect(guildWarNextSpot({ kind: "boss", index: 0 })).toBeNull();
    // 짝수 번 일반은 왼쪽 정예 쪽, 홀수 번은 오른쪽에 선다.
    for (const { slot, x } of nodes) if (slot.kind === "grunt" && slot.index < 6) expect(slot.index % 2 === 0 ? x < BASE_WIDTH / 2 : x > BASE_WIDTH / 2, slot.id).toBe(true);
  });

  it("아래 버튼 줄은 뒤로가기 자리를 피한다", () => {
    const { width } = GUILD_WAR_MAP.actions;
    expect(guildWarActionX(1, 2) + width / 2).toBeLessThanOrEqual(BASE_WIDTH - 40);
    expect(guildWarActionX(0, 2) - width / 2).toBeGreaterThanOrEqual(40);
  });
});
