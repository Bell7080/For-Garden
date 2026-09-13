import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RELIC_CONTROL_ROW,
  RELIC_FILTER_POPUP,
  RELIC_GRID,
  RELIC_GRID_INTRO,
  RELIC_GRID_MARGIN,
  RELIC_SORT_MENU,
  relicControlSpots,
  relicFilterChipX,
  relicFilterChipWidth,
  relicFilterPopupLayout,
  relicGridColumnX,
  relicGridIntroDelay,
  relicSortMenuHeight,
  relicSortMenuRowY,
} from "../../src/ui/relicGridLayout";

describe("도감 그리드", () => {
  it("네 칸이 좌우 여백 안에 균등하게 들어선다", () => {
    const { columns, card, gapX } = RELIC_GRID;
    expect(columns).toBe(4);
    const left = relicGridColumnX(0) - card.width / 2;
    const right = relicGridColumnX(columns - 1) + card.width / 2;
    expect(left).toBeGreaterThanOrEqual(RELIC_GRID_MARGIN - 1);
    expect(BASE_WIDTH - right).toBeCloseTo(left, 5);
    for (let column = 1; column < columns; column += 1) {
      expect(relicGridColumnX(column) - relicGridColumnX(column - 1)).toBe(card.width + gapX);
    }
  });

  it("카드 비례는 세 칸이던 때(300×400)와 같다", () => {
    expect(RELIC_GRID.card.width / RELIC_GRID.card.height).toBeCloseTo(300 / 400, 3);
  });
});

describe("도감 조작 줄", () => {
  it("필터·검색·정렬이 겹치지 않고 여백 안을 남김없이 쓴다", () => {
    const { filter, search, sort } = relicControlSpots();
    const { gap } = RELIC_CONTROL_ROW;
    expect(filter.x - filter.width / 2).toBe(RELIC_GRID_MARGIN);
    expect(BASE_WIDTH - (sort.x + sort.width / 2)).toBe(RELIC_GRID_MARGIN);
    expect(search.x - search.width / 2 - (filter.x + filter.width / 2)).toBe(gap);
    expect(sort.x - sort.width / 2 - (search.x + search.width / 2)).toBe(gap);
    // 글자가 흐르는 칸이 가장 넓어야 한다 — 이름이 길어지는 것은 검색 칸뿐이다.
    expect(search.width).toBeGreaterThan(sort.width);
  });

  it("정렬 판 높이는 항목 수에서 나오고 줄이 판 안에 든다", () => {
    const { rowHeight, gap, padding } = RELIC_SORT_MENU;
    for (const count of [1, 3, 5]) {
      const height = relicSortMenuHeight(count);
      expect(height).toBe(padding * 2 + count * rowHeight + (count - 1) * gap);
      for (let index = 0; index < count; index += 1) {
        const y = relicSortMenuRowY(index, count);
        expect(y - rowHeight / 2).toBeGreaterThanOrEqual(-height / 2);
        expect(y + rowHeight / 2).toBeLessThanOrEqual(height / 2);
      }
    }
  });
});

describe("도감 진입 연출", () => {
  it("지연은 칸 순서대로 늘다가 상한에서 멈춘다", () => {
    expect(relicGridIntroDelay(0)).toBe(0);
    expect(relicGridIntroDelay(1)).toBe(RELIC_GRID_INTRO.step);
    expect(relicGridIntroDelay(1000)).toBe(RELIC_GRID_INTRO.cap);
  });

  it("맨 마지막 칸까지 반 초 안에 다 선다", () => {
    expect(RELIC_GRID_INTRO.cap + RELIC_GRID_INTRO.duration).toBeLessThanOrEqual(500);
  });
});

describe("도감 필터 판", () => {
  it("칩은 한 줄 안에서 균등하고 좌우 여백을 지킨다", () => {
    for (const count of [3, 4, 5]) {
      const width = relicFilterChipWidth(count);
      const left = relicFilterChipX(0, count) - width / 2;
      const right = relicFilterChipX(count - 1, count) + width / 2;
      expect(left).toBeCloseTo(-RELIC_FILTER_POPUP.width / 2 + RELIC_FILTER_POPUP.padding, 5);
      expect(right).toBeCloseTo(RELIC_FILTER_POPUP.width / 2 - RELIC_FILTER_POPUP.padding, 5);
    }
  });

  it("판 높이는 쌓인 줄에서 나오고 모든 줄이 판 안에 든다", () => {
    const sections = [
      { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
      { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
      { chipHeight: RELIC_FILTER_POPUP.textChipHeight },
    ];
    for (const reset of [false, true]) {
      const layout = relicFilterPopupLayout(sections, reset);
      const half = layout.height / 2;
      layout.sections.forEach((section, index) => {
        expect(section.labelY).toBeGreaterThan(-half);
        expect(section.chipY + sections[index].chipHeight / 2).toBeLessThan(half);
        expect(section.chipY).toBeGreaterThan(section.labelY);
      });
      if (reset) expect(layout.resetY + RELIC_FILTER_POPUP.reset.height / 2).toBeLessThanOrEqual(half);
    }
  });

  it("조건 해제 줄이 서면 판이 그만큼만 길어진다", () => {
    const sections = [{ chipHeight: RELIC_FILTER_POPUP.textChipHeight }];
    const grown = relicFilterPopupLayout(sections, true).height - relicFilterPopupLayout(sections, false).height;
    expect(grown).toBe(RELIC_FILTER_POPUP.reset.height + RELIC_FILTER_POPUP.reset.gap);
  });
});
