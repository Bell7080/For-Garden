import { describe, expect, it, vi } from "vitest";
import type { ClaimMissionRewardsResponse, MissionDto } from "../../src/api/contracts";
import { MissionClaimController, missionDisplayModel } from "../../src/ui/missionsPopupModel";
import { boundsIntersect, MISSIONS_POPUP_LAYOUT, missionsPopupCollisionBounds, researchTrackLayout } from "../../src/ui/missionsPopupLayout";

/** UI 수령 테스트에는 서버 확정 필드 중 분기에서 읽는 값만 작은 계약 더블로 만든다. */
const response = (claimedIds: string[], cheesecakeEarned = 20): ClaimMissionRewardsResponse => ({ claimedIds, cheesecakeEarned } as ClaimMissionRewardsResponse);
const mission = (overrides: Partial<MissionDto> = {}): MissionDto => ({ id: "daily-one", period: "daily", title: "한 번 완료", progress: 1, target: 1, rewardCheesecake: 20, researchPoints: 20, claimed: false, ...overrides });

describe("MissionsPopup 표시 모델", () => {
  it("목표 0을 안전하게 표시하고 진행률을 100%에서 제한한다", () => {
    expect(missionDisplayModel(mission({ progress: 0, target: 0 }))).toMatchObject({ ratio: 0, progressLabel: "0/0", claimable: false });
    expect(missionDisplayModel(mission({ progress: 9, target: 2 }))).toMatchObject({ ratio: 1, progressLabel: "9/2", claimable: true });
  });
});

describe("MissionsPopup 영역 배치", () => {
  it("최소·최대 임계값 액자와 게이지 bounds가 팝업 안전 영역 안에 머문다", () => {
    const track = researchTrackLayout(1080 - MISSIONS_POPUP_LAYOUT.popup.widthInset, [20, 40, 60, 80, 100, 120]);
    const insideSafeWidth = (bounds: { left: number; right: number }): boolean => bounds.left >= track.safeBounds.left && bounds.right <= track.safeBounds.right;
    // 극단 액자를 명시적으로 검사해 프레임 크기나 외곽선이 커질 때 좌우 돌출을 회귀로 잡는다.
    expect(insideSafeWidth(track.frameBounds[0])).toBe(true);
    expect(insideSafeWidth(track.frameBounds.at(-1)!)).toBe(true);
    expect(insideSafeWidth(track.barBounds)).toBe(true);
    expect(track.labelX).toBe(track.barX);
  });

  it("보상 액자의 외곽선 반지름까지 포함한 bounds가 일일·주간 탭과 교차하지 않는다", () => {
    const { tabs, researchFrames } = missionsPopupCollisionBounds();
    // 양 끝 액자를 양쪽 탭 모두와 비교해 향후 크기나 기준점 변경도 즉시 회귀로 드러낸다.
    expect(researchFrames.every((frame) => tabs.every((tab) => !boundsIntersect(frame, tab)))).toBe(true);
  });

  it("연구도 라벨과 첫 임무 카드 사이에 고정 여백을 둔다", () => {
    const { research, list } = MISSIONS_POPUP_LAYOUT;
    const labelBaseline = research.barY + research.labelOffsetY;
    const firstCardTop = list.firstCardY - list.cardHeight / 2;
    expect(firstCardTop - labelBaseline).toBeGreaterThanOrEqual(50);
  });
});

describe("MissionsPopup 수령 입력", () => {
  it("카드의 개별 수령은 선택한 ID 하나만 보낸다", async () => {
    const claimMissionRewards = vi.fn(async () => response(["daily-one"]));
    await new MissionClaimController({ claimMissionRewards }).claim(["daily-one"]);
    expect(claimMissionRewards).toHaveBeenCalledWith(["daily-one"]);
  });

  it("보상 아이콘 수령도 카드와 같은 단일 ID 계약을 쓴다", async () => {
    const claimMissionRewards = vi.fn(async () => response(["weekly-one"]));
    await new MissionClaimController({ claimMissionRewards }).claim(["weekly-one"]);
    expect(claimMissionRewards).toHaveBeenCalledWith(["weekly-one"]);
  });

  it("일괄 수령은 완료 ID 배열을 한 요청으로 보낸다", async () => {
    const claimMissionRewards = vi.fn(async () => response(["a", "b"], 40));
    await new MissionClaimController({ claimMissionRewards }).claim(["a", "b"]);
    expect(claimMissionRewards).toHaveBeenCalledOnce(); expect(claimMissionRewards).toHaveBeenCalledWith(["a", "b"]);
  });

  it("같은 임무의 연타는 첫 요청이 끝날 때까지 중복 호출하지 않는다", async () => {
    let resolve!: (value: ClaimMissionRewardsResponse) => void;
    const claimMissionRewards = vi.fn(() => new Promise<ClaimMissionRewardsResponse>((done) => { resolve = done; }));
    const controller = new MissionClaimController({ claimMissionRewards });
    const first = controller.claim(["daily-one"]); const duplicate = controller.claim(["daily-one"]);
    await expect(duplicate).resolves.toBeUndefined(); expect(claimMissionRewards).toHaveBeenCalledOnce(); resolve(response(["daily-one"])); await first;
  });

  it("빈 일괄 수령 결과도 빈 배열 계약과 0 보상을 그대로 돌려준다", async () => {
    const empty = response([], 0); const claimMissionRewards = vi.fn(async () => empty);
    await expect(new MissionClaimController({ claimMissionRewards }).claim([])).resolves.toBe(empty);
    expect(claimMissionRewards).toHaveBeenCalledWith([]);
  });
});
