import { describe, expect, it } from "vitest";
import { DUEL_TIERS } from "../../src/core/duelArena";
import { BACK_SLOT } from "../../src/ui/popupGeometry";
import { DUEL_SCREEN, DUEL_TIER_COLOR, duelOpponentsBottom, duelOpponentY } from "../../src/ui/duelLayout";

describe("결투장 화면 자리", () => {
  it("위에서부터 내 자리 → 도전권 → 상대 셋 → 방어덱 → 곁들임 줄이 겹치지 않고 쌓인다", () => {
    const standingBottom = DUEL_SCREEN.standing.y + DUEL_SCREEN.standing.height / 2;
    expect(DUEL_SCREEN.attempts.y - DUEL_SCREEN.attempts.buttonHeight / 2).toBeGreaterThan(standingBottom);
    expect(DUEL_SCREEN.opponents.top).toBeGreaterThan(DUEL_SCREEN.attempts.y + DUEL_SCREEN.attempts.buttonHeight / 2);
    expect(duelOpponentY(0)).toBe(DUEL_SCREEN.opponents.top + DUEL_SCREEN.opponents.height / 2);
    expect(DUEL_SCREEN.defense.y - DUEL_SCREEN.defense.height / 2).toBeGreaterThan(duelOpponentsBottom());
    expect(DUEL_SCREEN.links.y - DUEL_SCREEN.links.height / 2).toBeGreaterThan(DUEL_SCREEN.defense.y + DUEL_SCREEN.defense.height / 2);
  });

  it("곁들임 줄은 우하단 뒤로가기 자리를 비운다", () => {
    const rightEdge = Math.max(...DUEL_SCREEN.links.xs) + DUEL_SCREEN.links.width / 2;
    expect(rightEdge).toBeLessThan(BACK_SLOT.x - 70);
  });

  it("상대 칸의 얼굴 셋과 도전 버튼이 판 안에서 겹치지 않는다", () => {
    const { faceX, faceGap, faceSize, challengeX, challengeWidth } = DUEL_SCREEN.opponents;
    expect(faceX + faceGap * 2 + faceSize / 2).toBeLessThan(challengeX - challengeWidth / 2);
    expect(challengeX + challengeWidth / 2).toBeLessThanOrEqual(DUEL_SCREEN.side + DUEL_SCREEN.width);
  });

  it("여덟 티어가 모두 제 색을 갖는다", () => {
    for (const { id } of DUEL_TIERS) expect(DUEL_TIER_COLOR[id]).toBeDefined();
  });
});
