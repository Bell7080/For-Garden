import { describe, expect, it } from "vitest";
import { DUEL_OPPONENT_COUNT, DUEL_TIERS } from "../../src/core/duelArena";
import { BASE_HEIGHT } from "../../src/config/gameConfig";
import { RANKING_LIST } from "../../src/ui/expeditionRankingLayout";
import { duelHistoryAge } from "../../src/core/duelState";
import { CATEGORY_TAB } from "../../src/ui/categoryTabStyle";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";
import { insidePopupBody, staminaPopupLayout } from "../../src/ui/staminaPopupLayout";
import { TOP_BAR_SLOT_KEYS } from "../../src/ui/topBarSlots";
import {
  DUEL_OPPONENT_POPUP, DUEL_PODIUM, DUEL_PROFILE, DUEL_RANKING_VIEW, DUEL_SCREEN, DUEL_TIER_COLOR, duelHistoryMinScroll, duelHistoryRowY, duelOpponentPopupHeight, duelOpponentRowY, duelProfileRowY, duelTabX,
} from "../../src/ui/duelLayout";

const S = DUEL_SCREEN;
const backTop = BACK_SLOT.y - BACK_BUTTON_SIZE / 2;
const backLeft = BACK_SLOT.x - BACK_BUTTON_SIZE / 2;

describe("결투장 무대 자리", () => {
  it("위에서부터 휘장 → 게이지 → 전투 프로필 → 방어·도전 → 라벨이 겹치지 않고 쌓인다", () => {
    expect(S.emblem.y + S.emblem.size * 0.54).toBeLessThan(S.tierName.y - 23);
    expect(S.tierName.y + 23).toBeLessThan(S.gauge.y - S.gauge.nextSize / 2);
    // 프로필 판 윗변에 걸터앉는 제목표(약 21px)까지 게이지 아래에 든다.
    expect(S.profile.top - 24).toBeGreaterThan(S.gauge.y + S.gauge.nextSize / 2);
    expect((S.profile.top + S.profile.bottom) / 2).toBe(S.profile.y);
    expect(S.seasonReward.y - S.seasonReward.height / 2).toBeGreaterThan(S.profile.bottom + 20);
    expect(S.actions.y - S.actions.height / 2).toBeGreaterThan(S.seasonReward.y + S.seasonReward.height / 2);
    expect(S.tabs.y - S.tabs.height / 2 - CATEGORY_TAB.lift).toBeGreaterThan(S.actions.y + S.actions.height / 2);
  });

  it("방어·도전은 나란히 겹치지 않고, 도전 판은 우하단 뒤로가기에 닿지 않는다", () => {
    const { defense, challenge } = S.actions;
    expect(defense.x + defense.width).toBeLessThan(challenge.x);
    expect(challenge.x + challenge.width).toBeLessThanOrEqual(S.side + S.width);
    expect(S.actions.y + S.actions.height / 2).toBeLessThan(backTop);
  });

  it("방어 판의 얼굴 셋이 판 안에 든다", () => {
    const { defense, faceSize, faceGap } = S.actions;
    expect(faceGap + faceSize / 2).toBeLessThan(defense.width / 2);
  });

  it("좌하단 라벨 두 장이 뒤로가기 자리를 비운다", () => {
    expect(duelTabX(1) + S.tabs.width / 2).toBeLessThan(backLeft);
    expect(duelTabX(0) - S.tabs.width / 2).toBe(S.side);
  });

  it("왼쪽 칩 둘이 휘장과 겹치지 않는다", () => {
    expect(S.rankChip.y + S.rankChip.size / 2).toBeLessThan(S.shopChip.y - S.shopChip.size / 2);
    expect(S.rankChip.x + S.rankChip.size / 2).toBeLessThan(S.emblem.x - S.emblem.size / 2);
  });
});

describe("전투 프로필", () => {
  const P = DUEL_PROFILE;
  it("애착 렐릭 카드와 오른쪽 줄이 판 안에서 겹치지 않는다", () => {
    expect(P.card.x - P.card.size / 2).toBeGreaterThanOrEqual(-P.width / 2 + P.padX);
    expect(P.card.x + P.card.size / 2).toBeLessThan(P.rows.labelX);
    expect(P.card.y - P.card.size / 2).toBeGreaterThan(P.header.divider);
    expect(P.card.levelY + 14).toBeLessThan(P.height / 2);
    expect(duelProfileRowY(0) - P.rows.emblemSize / 2).toBeGreaterThan(P.header.divider);
    expect(duelProfileRowY(3) + P.rows.bonusChip.height / 2).toBeLessThan(P.height / 2);
    expect(P.rows.emblemX + P.rows.emblemSize / 2).toBeLessThan(P.rows.valueX);
  });
});

describe("상대 선택 창", () => {
  it("다섯 줄을 담는 창이 화면 안에 들고, 줄은 새로고침 위에서 끝난다", () => {
    const count = DUEL_OPPONENT_COUNT;
    const height = duelOpponentPopupHeight(count);
    expect(height).toBeLessThan(BASE_HEIGHT - 200);
    expect(duelOpponentRowY(0, count) - DUEL_OPPONENT_POPUP.rowHeight / 2).toBeGreaterThan(-height / 2);
    expect(duelOpponentRowY(count - 1, count) + DUEL_OPPONENT_POPUP.rowHeight / 2).toBeLessThan(height / 2 - DUEL_OPPONENT_POPUP.refresh.height);
  });

  it("얼굴·글줄·방어덱·도전 버튼이 줄 안에서 겹치지 않는다", () => {
    const P = DUEL_OPPONENT_POPUP;
    expect(P.faceX - P.faceSize / 2).toBeGreaterThan(-P.rowWidth / 2);
    expect(P.faceX + P.faceSize / 2).toBeLessThan(P.textX);
    expect(P.textX + P.textRoom).toBeLessThan(P.unitX - P.unitSize / 2);
    expect(P.unitX + P.unitGap * 2 + P.unitSize / 2).toBeLessThan(P.challengeX - P.challengeWidth / 2);
    expect(P.challengeX + P.challengeWidth / 2).toBeLessThan(P.rowWidth / 2);
  });
});

describe("순위표", () => {
  it("내 줄은 목록 창 아래, 구분선 밑에 붙박이고 판 안에 든다", () => {
    const V = DUEL_RANKING_VIEW;
    expect(V.viewport.bottom).toBeLessThan(V.divider);
    expect(V.meY - RANKING_LIST.rowHeight * 1.04 / 2).toBeGreaterThan(V.divider);
    expect(V.meY + RANKING_LIST.rowHeight * 1.04 / 2).toBeLessThan((BASE_HEIGHT - 180) / 2);
  });
});

describe("전적 탭", () => {
  it("줄이 창보다 짧으면 움직이지 않고, 길면 마지막 줄이 창 아래에 닿는 데서 멈춘다", () => {
    expect(duelHistoryMinScroll(0)).toBe(0);
    expect(duelHistoryMinScroll(3)).toBe(0);
    const rows = 10;
    const last = duelHistoryRowY(rows - 1) + S.history.rowHeight / 2;
    expect(S.history.top + last + duelHistoryMinScroll(rows)).toBe(S.history.bottom);
  });

  it("목록 창은 라벨 줄 위에서 끝난다", () => {
    expect(S.history.bottom).toBeLessThan(S.tabs.y - S.tabs.height / 2 - CATEGORY_TAB.lift);
  });

  it("「얼마 전」은 가장 큰 단위 하나만 쓴다", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(duelHistoryAge("2026-10-07T11:59:30Z", now)).toEqual({ unit: "now", value: 0 });
    expect(duelHistoryAge("2026-10-07T11:15:00Z", now)).toEqual({ unit: "minute", value: 45 });
    expect(duelHistoryAge("2026-10-07T07:00:00Z", now)).toEqual({ unit: "hour", value: 5 });
    expect(duelHistoryAge("2026-10-04T12:00:00Z", now)).toEqual({ unit: "day", value: 3 });
    expect(duelHistoryAge("엉뚱한 값", now).unit).toBe("now");
    expect(duelHistoryAge("2026-10-08T12:00:00Z", now).unit).toBe("now");
  });
});

describe("순위표 시상대", () => {
  it("1등 단이 가장 높고 셋이 서로 겹치지 않는다", () => {
    const [first, second, third] = DUEL_PODIUM.spots;
    expect(first.plinth).toBeGreaterThan(second.plinth);
    expect(second.plinth).toBeGreaterThan(third.plinth);
    expect(Math.abs(second.x - first.x)).toBeGreaterThanOrEqual(DUEL_PODIUM.plinthWidth);
    expect(Math.abs(third.x - first.x)).toBeGreaterThanOrEqual(DUEL_PODIUM.plinthWidth);
    // 1등 얼굴의 머리 끝도 시상대 머리 안에 든다.
    expect(DUEL_PODIUM.baseY - first.plinth - 44 - first.face).toBeGreaterThanOrEqual(0);
  });
});

describe("티어 색", () => {
  it("여덟 티어가 모두 제 색을 갖는다", () => {
    for (const { id } of DUEL_TIERS) expect(DUEL_TIER_COLOR[id]).toBeDefined();
  });
});

describe("결투 도전권 — 상단 칸과 충전 창", () => {
  it("결투장 상단은 젬 대신 휘장과 도전권을 세우고, 결투 상점은 그대로다", () => {
    expect(TOP_BAR_SLOT_KEYS.duelArena).toEqual(["duelEmblem", "duelTicket"]);
    expect(TOP_BAR_SLOT_KEYS.duel).toEqual(["duelEmblem", "gems"]);
  });

  it("충전 창은 스테미나 창과 같은 표를 칸 둘·사용처 없이 쓰고, 판과 칸이 몸판 안에 든다", () => {
    const layout = staminaPopupLayout(0, 2, false);
    const [left, right] = layout.cell.centers;
    expect(left! + right!).toBeCloseTo(0, 5);
    expect(insidePopupBody(layout, layout.hero)).toBe(true);
    for (const x of [left!, right!]) {
      expect(Math.abs(x) + layout.cell.width / 2).toBeLessThanOrEqual(layout.hero.width / 2 + 0.001);
    }
    expect(insidePopupBody(layout, { y: layout.cell.y, width: layout.hero.width, height: layout.cell.height })).toBe(true);
    expect(layout.height).toBeLessThan(staminaPopupLayout(1).height);
  });
});
