import { describe, expect, it } from "vitest";
import { autoPickParty, elementDistribution, partyAffinitySummary, relicAffinityDirection } from "../../src/core/partyAffinity";
import { getRelic } from "../../src/data/relics";

/** Phaser 없이 편성 추천과 화면 요약이 같은 속성 공식을 쓰는지 검증한다. */
describe("파티 속성 미리보기", () => {
  it("적 속성을 첫 등장 순서와 인원수로 요약한다", () => {
    const enemies = [getRelic("husk-raptor"), getRelic("husk-shell"), getRelic("husk-raptor")];
    expect(elementDistribution(enemies)).toEqual([
      { element: "fire", count: 2 },
      { element: "earth", count: 1 },
    ]);
  });

  it("아군과 적의 모든 교차 조합을 유리·불리·중립으로 센다", () => {
    const allies = [getRelic("rex"), getRelic("spino")];
    const enemies = [getRelic("husk-raptor"), getRelic("husk-shell")];
    expect(partyAffinitySummary(allies, enemies)).toEqual({ advantage: 2, disadvantage: 1, neutral: 1 });
  });

  it("자동 배치는 적 전체에 대한 속성 점수가 높은 셋을 안정적으로 고른다", () => {
    const roster = [getRelic("rex"), getRelic("anky"), getRelic("spino"), getRelic("dodo"), getRelic("tia")];
    const enemies = [getRelic("husk-raptor"), getRelic("husk-shell"), getRelic("husk-wing")];
    expect(autoPickParty(roster, enemies)).toEqual(["spino", "tia", "anky"]);
  });

  it("선택 렐릭이 적 다수에게 유리하면 위 방향이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("dodo"), getRelic("luka")])).toBe("up");
  });

  it("선택 렐릭이 적 다수에게 불리하면 아래 방향이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("spino"), getRelic("husk-shell")])).toBe("down");
  });

  it("유리와 불리가 상쇄되면 중립이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("dodo"), getRelic("spino")])).toBe("neutral");
  });

  it("적 목록이 비었으면 중립이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [])).toBe("neutral");
  });
});
