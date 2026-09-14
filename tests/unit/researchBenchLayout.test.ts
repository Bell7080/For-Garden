import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RESEARCH_BENCH, researchActionsBottom, researchActionY, researchBenchWidth,
  researchDetailBounds, researchSlotCenter,
} from "../../src/ui/researchBenchLayout";

/** 좌하단 라벨 줄의 윗변. 버튼 줄이 여기를 파고들면 안 된다. */
const TAB_TOP = BASE_HEIGHT - 268 - 84 / 2;

describe("특성 연구대 배치", () => {
  it("은 룬을 끼우면 칸을 왼쪽으로 밀어 상세 자리를 낸다", () => {
    const empty = researchSlotCenter(BASE_WIDTH, false);
    const slotted = researchSlotCenter(BASE_WIDTH, true);
    // 비면 가운데, 끼우면 왼쪽이다 — 상세가 들어설 자리가 그 차이만큼 생긴다.
    expect(empty.x).toBe(BASE_WIDTH / 2);
    expect(slotted.x).toBeLessThan(empty.x);
    expect(empty.y).toBe(slotted.y);
  });

  it("의 상세는 밀린 칸의 오른쪽에서 시작해 판 안에서 끝난다", () => {
    const slotted = researchSlotCenter(BASE_WIDTH, true);
    const detail = researchDetailBounds(BASE_WIDTH);
    // 글자가 칸 위로 올라타면 룬 그림과 겹쳐 둘 다 읽히지 않는다.
    expect(detail.left).toBeGreaterThanOrEqual(slotted.x + RESEARCH_BENCH.slot / 2);
    expect(detail.right).toBeLessThanOrEqual(BASE_WIDTH - RESEARCH_BENCH.inset);
    expect(detail.top).toBeGreaterThanOrEqual(RESEARCH_BENCH.top);
    expect(detail.bottom).toBeLessThanOrEqual(RESEARCH_BENCH.top + RESEARCH_BENCH.height);
  });

  it("의 룬 칸은 연구대 판 안에 든다", () => {
    const slotted = researchSlotCenter(BASE_WIDTH, true);
    const width = researchBenchWidth(BASE_WIDTH);
    expect(slotted.x - RESEARCH_BENCH.slot / 2).toBeGreaterThanOrEqual((BASE_WIDTH - width) / 2);
    expect(RESEARCH_BENCH.slot).toBeLessThanOrEqual(RESEARCH_BENCH.height);
  });

  it("의 버튼 줄은 연구대 아래에 서고 라벨 줄을 파고들지 않는다", () => {
    // 조작이 가장 많은 경우는 부여·확정 부여·재해석·등급 상승 넷이다.
    expect(researchActionY(0) - RESEARCH_BENCH.actionHeight / 2)
      .toBeGreaterThanOrEqual(RESEARCH_BENCH.top + RESEARCH_BENCH.height);
    expect(researchActionsBottom(4)).toBeLessThanOrEqual(TAB_TOP);
    expect(researchActionsBottom(0)).toBe(RESEARCH_BENCH.actionsTop);
  });

  it("의 버튼은 서로 겹치지 않는다", () => {
    expect(researchActionY(1) - researchActionY(0))
      .toBe(RESEARCH_BENCH.actionHeight + RESEARCH_BENCH.actionGap);
  });
});
