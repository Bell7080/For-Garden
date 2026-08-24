import { describe, expect, it } from "vitest";
import GOLD_ICON from "../../public/sprites/excavation/gold.svg?raw";
import SUPPLIES_ICON from "../../public/sprites/excavation/supplies.svg?raw";
import { EXCAVATION_TRAIT_ICON, EXCAVATION_TRAIT_ICON_ASSETS } from "../../src/ui/excavationIcons";

/** 발굴 특화 SVG가 공용 홀로그램 아이콘의 각진 단색 규칙을 지키는지 고정한다. */
describe("발굴 특화 아이콘", () => {
  it("두 생산 자원을 서로 다른 로더 키와 SVG에 연결한다", () => {
    expect(EXCAVATION_TRAIT_ICON.gold).not.toBe(EXCAVATION_TRAIT_ICON.cheesecake);
    expect(EXCAVATION_TRAIT_ICON_ASSETS).toHaveLength(2);
  });

  it.each([GOLD_ICON, SUPPLIES_ICON])("배경판과 둥근 선 끝 없이 흰색 선화만 사용한다", (source) => {
    expect(source).toContain('viewBox="0 0 96 96"');
    expect(source).toContain('stroke="#ffffff"');
    expect(source).toContain('stroke-linecap="butt"');
    expect(source).toContain('stroke-linejoin="miter"');
    expect(source).not.toContain("<rect");
    expect(source).not.toContain("stroke-linecap=\"round\"");
  });
});
