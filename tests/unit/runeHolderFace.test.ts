import { describe, expect, it } from "vitest";
import { runeHolderBadgeSpot, RUNE_HOLDER_FACE } from "../../src/ui/runeHolderLayout";
import { sortRunesByRelic } from "../../src/managers/InventoryManager";
import { RELICS } from "../../src/data/relics";

describe("룬 장착자 보기", () => {
  it("줄어든 룬은 카드 왼쪽 아래 모서리 안쪽에 앉는다", () => {
    const size = 200;
    const spot = runeHolderBadgeSpot(size);
    const half = size * RUNE_HOLDER_FACE.runeRatio / 2;
    expect(spot.x - half).toBeGreaterThan(-size / 2);
    expect(spot.y + half).toBeLessThan(size / 2);
    expect(spot.x).toBeLessThan(0);
    expect(spot.y).toBeGreaterThan(0);
  });

  it("렐릭 순 정렬은 도감 순서대로 서고 안 낀 룬은 맨 뒤다", () => {
    const [a, b] = [RELICS[0].id, RELICS[1].id];
    const runes = [
      { instanceId: "free", part: 0 }, { instanceId: "b", part: 1 }, { instanceId: "a2", part: 2 }, { instanceId: "a1", part: 0 },
    ];
    const progress = { [b]: { heartGemSlots: ["b", null, null] }, [a]: { heartGemSlots: ["a1", null, "a2"] } };
    expect(sortRunesByRelic(runes, progress).map(({ instanceId }) => instanceId)).toEqual(["a1", "a2", "b", "free"]);
  });
});
