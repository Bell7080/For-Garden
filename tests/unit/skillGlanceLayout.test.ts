import { describe, expect, it } from "vitest";
import { SKILL_GLANCE, skillGlanceBackTop, skillGlanceBottom, skillGlanceCardRoom, skillGlanceCardsTop, skillGlanceTabX } from "../../src/ui/skillGlanceLayout";

describe("스킬 한눈에 보기 판 자리", () => {
  it("판은 화면 안에 서고 밑변이 판 밖 뒤로가기를 덮지 않는다", () => {
    expect(SKILL_GLANCE.centerY - SKILL_GLANCE.height / 2).toBeGreaterThan(0);
    expect(skillGlanceBottom()).toBeLessThan(skillGlanceBackTop());
  });

  it("렐릭 고르기 줄은 판 폭 안에서 가운데로 모인다", () => {
    for (const count of [1, 2, 3]) {
      const xs = Array.from({ length: count }, (_, index) => skillGlanceTabX(index, count));
      expect(xs.reduce((a, b) => a + b, 0)).toBeCloseTo(0);
      for (const x of xs) expect(Math.abs(x) + SKILL_GLANCE.tabs.plate / 2).toBeLessThan(SKILL_GLANCE.width / 2);
    }
  });

  it("네 칸이 들 띠가 아이콘 칸 넷보다 넉넉하다", () => {
    const { icon, pad, gap } = SKILL_GLANCE.cards;
    for (const count of [1, 3]) expect(skillGlanceCardRoom(count)).toBeGreaterThan(4 * (icon + pad * 2) + 3 * gap);
  });

  it("렐릭 하나만 보일 때는 얼굴 줄을 비우고 칸이 더 위에서 시작한다", () => {
    expect(skillGlanceCardsTop(1)).toBeLessThan(skillGlanceCardsTop(3));
    expect(skillGlanceCardsTop(3)).toBe(SKILL_GLANCE.cards.top);
    expect(skillGlanceCardRoom(1)).toBeGreaterThan(skillGlanceCardRoom(3));
  });
});
