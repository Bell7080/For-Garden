import { describe, expect, it } from "vitest";
import { arrangeByRole, autoPickParty, elementDistribution, partyAffinitySummary, relicAffinityDirection } from "../../src/core/partyAffinity";
import { getRelic } from "../../src/data/relics";

/** Phaser 없이 편성 추천과 화면 요약이 같은 속성 공식을 쓰는지 검증한다. */
describe("파티 속성 미리보기", () => {
  it("적 속성을 첫 등장 순서와 인원수로 요약한다", () => {
    const enemies = [getRelic("toby"), getRelic("amo"), getRelic("toby")];
    expect(elementDistribution(enemies)).toEqual([
      { element: "fire", count: 2 },
      { element: "earth", count: 1 },
    ]);
  });

  it("아군과 적의 모든 교차 조합을 유리·불리·중립으로 센다", () => {
    const allies = [getRelic("rex"), getRelic("spino")];
    const enemies = [getRelic("toby"), getRelic("amo")];
    expect(partyAffinitySummary(allies, enemies)).toEqual({ advantage: 2, disadvantage: 1, neutral: 1 });
  });

  it("자동 배치는 적 전체에 대한 속성 점수가 높은 셋을 안정적으로 고르고 직군으로 자리를 정한다", () => {
    const roster = [getRelic("rex"), getRelic("anky"), getRelic("spino"), getRelic("dodo"), getRelic("tia")];
    const enemies = [getRelic("toby"), getRelic("amo"), getRelic("ripa")];
    // 고르는 것은 속성 점수(스피나·티아·토리카), 자리는 직군이다 — 탱커가 가운데, 암살자가 왼쪽.
    expect(autoPickParty(roster, enemies)).toEqual(["spino", "anky", "tia"]);
  });

  it("가운데에는 탱커가, 없으면 전사가 서고 양옆에 암살자·지원가가 선다", () => {
    const ids = (members: readonly { id: string }[]): string[] => members.map(({ id }) => id);
    // 오프닝의 쁘띠 로그 셋: 암살자 파루아 · 탱커 토리카 · 지원가 도디.
    expect(ids(arrangeByRole([getRelic("anky"), getRelic("dodo"), getRelic("parua")]))).toEqual(["parua", "anky", "dodo"]);
    // 탱커가 없으면 전사가 가운데를 맡는다.
    expect(ids(arrangeByRole([getRelic("dodo"), getRelic("tia"), getRelic("spino")]))).toEqual(["spino", "tia", "dodo"]);
    // 같은 직군끼리는 들어온 순서를 지키고, 셋이 아니면 순서를 건드리지 않는다.
    expect(ids(arrangeByRole([getRelic("anky"), getRelic("dodo")]))).toEqual(["anky", "dodo"]);
  });

  it("선택 렐릭이 적 다수에게 유리하면 위 방향이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("dodo"), getRelic("luka")])).toBe("up");
  });

  it("선택 렐릭이 적 다수에게 불리하면 아래 방향이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("spino"), getRelic("amo")])).toBe("down");
  });

  it("유리와 불리가 상쇄되면 중립이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [getRelic("dodo"), getRelic("spino")])).toBe("neutral");
  });

  it("적 목록이 비었으면 중립이다", () => {
    expect(relicAffinityDirection(getRelic("rex"), [])).toBe("neutral");
  });
});
