import { describe, expect, it } from "vitest";
import {
  anchorEnemyPreview,
  NODE_ENEMY_PREVIEW,
  NODE_ENEMY_SITUATION,
  NODE_ENEMY_SLOT,
} from "../../src/ui/nodeEnemyPreviewLayout";
import { CHAPTERS } from "../../src/data/stages";

/** 지도 창. `StageMapScene`의 `WINDOW`와 같은 값이라 판이 그 안에 드는지 함께 잰다. */
const WINDOW = { top: 500, bottom: 1560 } as const;

const TITLE_SIZE = 32;

describe("노드 미리보기의 관문 상황 한 줄", () => {
  it("제목 아래, 구분선 위에 선다", () => {
    const titleBottom = NODE_ENEMY_SLOT.titleY + TITLE_SIZE;
    // 제목과 겹치지 않는다.
    expect(NODE_ENEMY_SITUATION.y).toBeGreaterThanOrEqual(titleBottom);
    // 구분선을 넘지 않는다 — 넘으면 적 SD 영역을 침범한다.
    expect(NODE_ENEMY_SITUATION.y + NODE_ENEMY_SITUATION.size).toBeLessThan(NODE_ENEMY_SLOT.dividerY);
  });

  it("제목보다 작아 위계가 뒤집히지 않는다", () => {
    expect(NODE_ENEMY_SITUATION.size).toBeLessThan(TITLE_SIZE);
  });

  it("판 아래 구획은 전투력만 갖는다", () => {
    // 상황 줄이 아래로 내려가면 "고를 때 필요한 정보"와 같은 무게로 서므로 위쪽에 둔다.
    expect(NODE_ENEMY_SITUATION.y).toBeLessThan(0);
    expect(NODE_ENEMY_SLOT.footerDividerY).toBeGreaterThan(0);
    expect(NODE_ENEMY_SLOT.powerY).toBeGreaterThan(NODE_ENEMY_SLOT.footerDividerY);
  });

  it("모든 줄이 판 안에 들고 SD 머리가 구분선에 닿지 않는다", () => {
    const half = NODE_ENEMY_PREVIEW.height / 2;
    expect(NODE_ENEMY_SLOT.titleY).toBeGreaterThan(-half);
    expect(NODE_ENEMY_SLOT.powerY + 28).toBeLessThan(half);
    // 발끝에서 키만큼 올라간 머리 끝이 제목 구분선 아래에 머문다.
    expect(NODE_ENEMY_SLOT.ground - NODE_ENEMY_PREVIEW.sdHeight).toBeGreaterThan(NODE_ENEMY_SLOT.dividerY);
  });

  it("한 줄이 늘어도 판이 지도 창 안에 그대로 든다", () => {
    for (const nodeY of [WINDOW.top, (WINDOW.top + WINDOW.bottom) / 2, WINDOW.bottom]) {
      const { y } = anchorEnemyPreview(nodeY, WINDOW.top, WINDOW.bottom);
      expect(y - NODE_ENEMY_PREVIEW.height / 2).toBeGreaterThanOrEqual(WINDOW.top);
      expect(y + NODE_ENEMY_PREVIEW.height / 2).toBeLessThanOrEqual(WINDOW.bottom);
    }
  });
});

describe("관문 상황 문구", () => {
  const chapterOne = CHAPTERS.find(({ id }) => id === 1)!;

  it("1장은 열 관문이 모두 한 줄을 갖는다", () => {
    for (const stage of chapterOne.stages) {
      expect(stage.kind).toBe("battle");
      if (stage.kind !== "battle") continue;
      expect(stage.situation?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("서사가 정해지지 않은 장은 비어 있어도 된다", () => {
    // 없는 줄은 화면이 그리지 않으므로 관문마다 억지로 채우지 않는다.
    const later = CHAPTERS.filter(({ id }) => id !== 1).flatMap(({ stages }) => stages);
    expect(later.every((stage) => stage.kind !== "battle" || stage.situation === undefined)).toBe(true);
  });

  it("한 줄은 판 폭에 담기는 길이로 끊는다", () => {
    for (const stage of chapterOne.stages) {
      if (stage.kind !== "battle" || !stage.situation) continue;
      // 두 줄로 넘어가면 제목 블록이 구분선을 밀어 SD 자리를 먹는다.
      expect(stage.situation.length).toBeLessThanOrEqual(34);
      expect(stage.situation).not.toContain("\n");
    }
  });
});
