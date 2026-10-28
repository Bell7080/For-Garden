import { describe, expect, it } from "vitest";
import { guildWarTotalSlots } from "../../src/core/guildWar";
import { GUILD_WAR_DECK_SIZE, guildWarMapSlots, guildWarSlotId, guildWarSlotOpen, normalizeGuildWarDeck, parseGuildWarSlotId } from "../../src/core/guildWarMap";

describe("길드전 방어진 지도", () => {
  it("칸 수는 레벨 표의 합과 같고 지부마다 우두머리 하나·정예 둘이다", () => {
    for (let level = 1; level <= 10; level += 1) {
      const slots = guildWarMapSlots(level);
      expect(slots).toHaveLength(guildWarTotalSlots(level));
      expect(new Set(slots.map(({ id }) => id)).size).toBe(slots.length);
      for (const branch of [1, 2, 3] as const) {
        expect(slots.filter((slot) => slot.branch === branch && slot.kind === "boss")).toHaveLength(1);
        expect(slots.filter((slot) => slot.branch === branch && slot.kind === "elite")).toHaveLength(2);
      }
    }
  });

  it("id는 왕복하고, 어느 레벨에서도 없는 칸은 받지 않는다", () => {
    for (const slot of guildWarMapSlots(10)) expect(parseGuildWarSlotId(slot.id)).toEqual(slot);
    expect(parseGuildWarSlotId(guildWarSlotId(1, "boss", 1))).toBeNull();
    expect(parseGuildWarSlotId("1:elite:2")).toBeNull();
    expect(parseGuildWarSlotId("4:boss:0")).toBeNull();
    expect(parseGuildWarSlotId("1:grunt:99")).toBeNull();
    expect(parseGuildWarSlotId(42)).toBeNull();
  });

  it("낮은 레벨에서는 뒤쪽 일반 칸이 닫혀 있다", () => {
    expect(guildWarSlotOpen(1, "3:grunt:0")).toBe(false);
    expect(guildWarSlotOpen(2, "3:grunt:0")).toBe(true);
    expect(guildWarSlotOpen(1, "1:boss:0")).toBe(true);
  });

  it("방어덱은 서로 다른 셋이다", () => {
    expect(normalizeGuildWarDeck(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(GUILD_WAR_DECK_SIZE).toBe(3);
    expect(() => normalizeGuildWarDeck(["a", "a", "c"])).toThrow();
    expect(() => normalizeGuildWarDeck(["a", "b"])).toThrow();
    expect(() => normalizeGuildWarDeck(["a", "b", 3])).toThrow();
  });
});
