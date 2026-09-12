import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RANKING_LIST, RANKING_MEDALS, RANKING_VISIBLE_RANKS, placeholderRankingEntries, rankedLeaderboard,
  rankingMedal, rankingRowY, rankingScrollMetrics,
} from "../../src/ui/expeditionRankingLayout";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { insidePopupBody } from "../../src/ui/staminaPopupLayout";

/** 순위 팝업은 화면을 거의 다 쓰는 작업판이다. 줄과 창이 그 판 안에 드는지 여기서 고정한다. */
const POPUP = { width: BASE_WIDTH - 100, height: BASE_HEIGHT - 180 } as const;

describe("원정 주간 기록 순위표", () => {
  it("은 100등까지 한 목록에서 흐른다", () => {
    const metrics = rankingScrollMetrics(RANKING_VISIBLE_RANKS);
    // 창보다 목록이 길어야 스크롤이 뜻을 갖는다.
    expect(metrics.minY).toBeLessThan(0);
    // 마지막 줄이 끝까지 올라온다 — 한 줄이라도 못 보면 "100등까지 본다"가 거짓이 된다.
    const lastRowBottom = rankingRowY(RANKING_VISIBLE_RANKS - 1) + RANKING_LIST.rowHeight / 2;
    expect(lastRowBottom + metrics.minY).toBeLessThanOrEqual(metrics.viewportHeight);
  });

  it("은 줄이 적으면 아예 움직이지 않는다", () => {
    // 표본이 없던 주에도 목록이 위로 끌려 올라가면 빈 자리가 생긴다.
    expect(rankingScrollMetrics(3).minY).toBe(0);
    expect(rankingScrollMetrics(0).minY).toBe(0);
  });

  it("은 줄과 스크롤 창이 팝업 몸판의 깎인 모서리 안에 든다", () => {
    const metrics = rankingScrollMetrics(RANKING_VISIBLE_RANKS);
    expect(insidePopupBody(POPUP, { y: metrics.viewportCenterY, width: RANKING_LIST.rowWidth, height: metrics.viewportHeight })).toBe(true);
    // 줄 안의 자리도 줄 판을 넘지 않는다.
    for (const x of [RANKING_LIST.rankX, RANKING_LIST.faceX, RANKING_LIST.nameX, RANKING_LIST.scoreX]) {
      expect(Math.abs(x)).toBeLessThan(RANKING_LIST.rowWidth / 2);
    }
    expect(RANKING_LIST.faceSize).toBeLessThan(RANKING_LIST.rowHeight);
  });

  it("은 금·은·동을 1·2·3등에만 준다", () => {
    expect(RANKING_MEDALS.map(({ rank }) => rank)).toEqual([1, 2, 3]);
    expect(rankingMedal(4)).toBeUndefined();
    expect(rankingMedal(1)?.edge).not.toBe(rankingMedal(2)?.edge);
    expect(rankingMedal(2)?.edge).not.toBe(rankingMedal(3)?.edge);
    // 금이 가장 밝고 동이 가장 어둡다 — 단의 순서가 색으로도 읽혀야 한다.
    const luminance = (color: number): number => ((color >> 16) & 0xff) * 0.299 + ((color >> 8) & 0xff) * 0.587 + (color & 0xff) * 0.114;
    expect(luminance(rankingMedal(1)!.edge)).toBeGreaterThan(luminance(rankingMedal(3)!.edge));
  });

  it("은 점수순으로 등수를 다시 매기고 상한에서 끊는다", () => {
    const ranked = rankedLeaderboard([
      { rank: 0, playerId: "a", displayName: "가", score: 100, achievedAt: "", isMe: false },
      { rank: 0, playerId: "me", displayName: "연구원", score: 300, achievedAt: "", isMe: true },
      { rank: 0, playerId: "b", displayName: "나", score: 200, achievedAt: "", isMe: false },
    ]);
    expect(ranked.map(({ playerId, rank }) => [playerId, rank])).toEqual([["me", 1], ["b", 2], ["a", 3]]);
    expect(rankedLeaderboard(placeholderRankingEntries(1_000, 200))).toHaveLength(RANKING_VISIBLE_RANKS);
  });

  it("은 표본이 열 때마다 같은 사람·같은 얼굴로 서고 점수가 내려간다", () => {
    const first = placeholderRankingEntries(1_200, RANKING_VISIBLE_RANKS);
    // 난수로 지으면 열 때마다 다른 사람이 서서 "몇 등 올랐나"를 읽을 수 없다.
    expect(placeholderRankingEntries(1_200, RANKING_VISIBLE_RANKS)).toEqual(first);
    expect(new Set(first.map(({ displayName }) => displayName)).size).toBe(first.length);
    for (let index = 1; index < first.length; index += 1) {
      expect(first[index].score).toBeLessThanOrEqual(first[index - 1].score);
    }
    // 얼굴은 실제로 존재하는 개체여야 한다 — 순위표가 없는 개체를 세우면 그 줄에서 터진다.
    const playable = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    expect(first.every(({ favoriteRelicId }) => favoriteRelicId !== undefined && playable.has(favoriteRelicId))).toBe(true);
  });
});
