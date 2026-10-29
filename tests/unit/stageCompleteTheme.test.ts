import { describe, expect, it } from "vitest";
import { EXPEDITION_RESULT_THEME, RESULT_SCORE_BLOCK as B } from "../../src/ui/stageCompleteTheme";

/**
 * 결과판(판 높이 1360, 가운데 0)의 조각 자리 — StageCompletePopup의 기여도 버튼(50, 높이 84)과
 * 보상 줄(320, 액자 132)·판 밑변(680) 사이에 점수·순위 블록이 겹치지 않고 들어와야 한다.
 */
const CONTRIBUTION_BOTTOM = 50 + 84 / 2;
const REWARD_TOP = 320 - 132 / 2;
const REWARD_BOTTOM = 320 + 132 / 2;
const BODY_BOTTOM = 680;

describe("결과판 점수·순위 블록", () => {
  it("순위는 기여도 버튼과 보상 줄 사이에 선다", () => {
    expect(B.rank.labelY - B.rank.labelSize / 2).toBeGreaterThan(CONTRIBUTION_BOTTOM);
    expect(B.rank.valueY + B.rank.valueSize / 2).toBeLessThan(REWARD_TOP);
    expect(B.rank.labelY + B.rank.labelSize / 2).toBeLessThan(B.rank.valueY - B.rank.valueSize / 2);
  });

  it("점수와 보조 조작은 보상 줄 아래, 판 밑변 위에 차례로 선다", () => {
    expect(B.score.labelY - B.score.labelSize / 2).toBeGreaterThan(REWARD_BOTTOM);
    expect(B.score.valueY - B.score.valueSize / 2).toBeGreaterThan(B.score.labelY + B.score.labelSize / 2);
    expect(B.extras.y - B.extras.height / 2).toBeGreaterThan(B.score.valueY + B.score.valueSize / 2);
    expect(B.extras.y + B.extras.height / 2).toBeLessThan(BODY_BOTTOM);
    // 두 보조 조작이 판(폭 940) 안쪽 여백 안에 든다.
    expect(B.extras.width * 2 + B.extras.gap).toBeLessThanOrEqual(940 - 140);
  });

  it("원정 테마는 공용 금빛이 아닌 제 색과 원화를 갖는다", () => {
    expect(EXPEDITION_RESULT_THEME.accent).not.toBe(0xd8b978);
    expect(EXPEDITION_RESULT_THEME.accentText).toMatch(/^#[0-9a-f]{6}$/);
    expect(EXPEDITION_RESULT_THEME.backdropKey).toBeTruthy();
    expect(EXPEDITION_RESULT_THEME.backdropAlpha ?? 1).toBeLessThan(0.5);
  });
});
