import { describe, expect, it } from "vitest";
import { HELP_BASICS_PAGE_COUNT, HELP_TERM_IDS } from "../../src/data/helpCenter";
import { CONTENT_INTRO_IDS, GUIDED_INTRO_IDS } from "../../src/core/tutorial";
import { HELP_LAYOUT, helpRowAt, helpTermRowHeight, helpViewportHeight, stackHelpRows } from "../../src/ui/helpLayout";
import KO from "../../src/i18n/ko";

const keys = new Set(Object.keys(KO));

describe("도움말", () => {
  it("용어마다 이름과 설명이 있다", () => {
    for (const id of HELP_TERM_IDS) {
      expect(keys.has(`help.term.${id}.name`), id).toBe(true);
      expect(keys.has(`help.term.${id}.body`), id).toBe(true);
    }
  });

  it("첫 플레이 다시 보기의 쪽이 모두 있다", () => {
    for (let n = 1; n <= HELP_BASICS_PAGE_COUNT; n += 1) {
      expect(keys.has(`help.basics.${n}.heading`)).toBe(true);
      expect(keys.has(`help.basics.${n}.body`)).toBe(true);
    }
  });

  it("모든 첫 방문 안내가 다시 보기 이름을 갖는다 — 안내형은 고고학 한 줄로 묶인다", () => {
    const guided = new Set<string>(GUIDED_INTRO_IDS);
    for (const id of CONTENT_INTRO_IDS) {
      const entry = guided.has(id) ? "archaeology" : id;
      expect(keys.has(`help.tutorial.${entry}`), id).toBe(true);
    }
  });

  it("줄을 쌓고 그 위를 누른 자리를 되짚는다", () => {
    const heights = [helpTermRowHeight(80), helpTermRowHeight(120), HELP_LAYOUT.tutorial.height];
    const { tops, total } = stackHelpRows(heights);
    expect(tops[0]).toBe(HELP_LAYOUT.listPad);
    expect(tops[1]).toBe(tops[0] + heights[0] + HELP_LAYOUT.row.gap);
    expect(total).toBe(tops[2] + heights[2] + HELP_LAYOUT.listPad * 2);
    expect(helpRowAt(tops[1] + 5, tops, heights)).toBe(1);
    expect(helpRowAt(tops[1] - HELP_LAYOUT.row.gap / 2, tops, heights)).toBeUndefined();
    expect(stackHelpRows([]).total).toBe(0);
  });

  it("목록 창은 제목표와 탭 줄 사이에 든다", () => {
    expect(helpViewportHeight()).toBeGreaterThan(1000);
    expect(HELP_LAYOUT.viewport.bottom).toBeLessThan(HELP_LAYOUT.tab.y - HELP_LAYOUT.tab.height / 2);
  });
});
