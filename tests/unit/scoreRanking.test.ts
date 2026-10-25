import { describe, expect, it } from "vitest";
import { rankClimbFrames, SCORE_RANK_ME_ID, scoreRankingView } from "../../src/core/scoreRanking";

const peers = [
  { id: "a", name: "A", score: 1000 }, { id: "b", name: "B", score: 800 }, { id: "c", name: "C", score: 600 },
  { id: "d", name: "D", score: 400 }, { id: "e", name: "E", score: 200 },
];

describe("scoreRankingView", () => {
  it("내 점수가 오르면 이웃을 넘고 내 줄의 ID는 그대로다", () => {
    const before = scoreRankingView(peers, "나", 100);
    expect(before.myRank).toBe(6);
    expect(before.rows.map((r) => r.id)).toEqual(["d", "e", SCORE_RANK_ME_ID]);
    const after = scoreRankingView(peers, "나", 700);
    expect(after.myRank).toBe(3);
    expect(after.rows.map((r) => r.id)).toEqual(["a", "b", SCORE_RANK_ME_ID, "c"]);
    expect(after.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
  it("같은 점수는 앞지른 것이 아니다", () => {
    const tie = scoreRankingView(peers, "나", 600);
    expect(tie.myRank).toBe(3);
    expect(tie.rows.find((r) => r.id === "c")?.rank).toBe(3);
  });
  it("1위면 위쪽 이웃이 없고 혼자여도 나만 선다", () => {
    expect(scoreRankingView(peers, "나", 5000).rows.map((r) => r.id)).toEqual([SCORE_RANK_ME_ID, "a"]);
    expect(scoreRankingView([], "나", 0).rows).toHaveLength(1);
  });
});

describe("rankClimbFrames", () => {
  it("끝 값으로 끝나고 단조 감소한다", () => {
    const frames = rankClimbFrames(300, 5, 10);
    expect(frames[0]).toBe(300);
    expect(frames.at(-1)).toBe(5);
    expect(frames.length).toBeLessThanOrEqual(10);
    expect(frames.every((r, i) => i === 0 || r < frames[i - 1])).toBe(true);
  });
  it("오르지 않으면 끝 값 하나", () => { expect(rankClimbFrames(3, 3)).toEqual([3]); expect(rankClimbFrames(2, 7)).toEqual([7]); });
});
