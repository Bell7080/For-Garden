import { describe, expect, it } from "vitest";
import { expeditionRewardTrackFillY, expeditionRewardTrackHeight, expeditionRewardTrackNodes, REWARD_TRACK } from "../../src/ui/expeditionRewardTrack";

describe("기록 보상 길", () => {
  it("마디는 아래에서 위로 같은 간격으로 서고 보상은 우·좌를 번갈아 뻗는다", () => {
    const nodes = expeditionRewardTrackNodes(4);
    expect(nodes.map(({ y }) => y)).toEqual([150, 400, 650, 900]);
    expect(nodes.map(({ side }) => side)).toEqual(["right", "left", "right", "left"]);
  });

  it("길 길이는 마디 수를 따라가고 빈 목록은 길도 만들지 않는다", () => {
    expect(expeditionRewardTrackHeight(0)).toBe(0);
    expect(expeditionRewardTrackHeight(1)).toBe(REWARD_TRACK.bottomPad + REWARD_TRACK.topPad);
    expect(expeditionRewardTrackHeight(3)).toBe(150 + 500 + 170);
  });

  it("채움 높이는 마디 사이를 선형으로 잇고 마지막 마디에서 멈춘다", () => {
    const thresholds = [10_000, 50_000, 100_000];
    expect(expeditionRewardTrackFillY(0, thresholds)).toBe(0);
    // 첫 마디의 절반까지 왔으면 바닥에서 첫 마디까지의 절반이다.
    expect(expeditionRewardTrackFillY(5_000, thresholds)).toBeCloseTo(75);
    expect(expeditionRewardTrackFillY(10_000, thresholds)).toBeCloseTo(150);
    // 1·2단계 사이 정확히 절반.
    expect(expeditionRewardTrackFillY(30_000, thresholds)).toBeCloseTo(275);
    expect(expeditionRewardTrackFillY(999_999, thresholds)).toBe(650);
  });

  it("점수가 음수여도 길 밖으로 나가지 않는다", () => {
    expect(expeditionRewardTrackFillY(-100, [10_000])).toBe(0);
  });
});
