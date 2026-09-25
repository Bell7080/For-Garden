import { describe, expect, it, vi } from "vitest";
import type { ClaimMissionRewardsResponse, MissionDto } from "../../src/api/contracts";
import { MissionClaimController, missionDisplayModel } from "../../src/ui/missionsPopupModel";
import { boundsIntersect, MISSIONS_POPUP_LAYOUT, missionsTabX, researchTrackLayout } from "../../src/ui/missionsPopupLayout";
import { formatResetRemaining, missionResetRemainingMs } from "../../src/ui/missionsPopupModel";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";

/** UI 수령 테스트에는 서버 확정 필드 중 분기에서 읽는 값만 작은 계약 더블로 만든다. */
const response = (claimedIds: string[], amount = 20): ClaimMissionRewardsResponse => ({ claimedIds, granted: [{ currency: "cheesecake", amount }] } as unknown as ClaimMissionRewardsResponse);
const mission = (overrides: Partial<MissionDto> = {}): MissionDto => ({ id: "daily-one", period: "daily", title: "한 번 완료", progress: 1, target: 1, reward: { currency: "cheesecake", amount: 20 }, researchPoints: 20, claimed: false, ...overrides });

describe("MissionsPopup 표시 모델", () => {
  it("목표 0을 안전하게 표시하고 진행률을 100%에서 제한한다", () => {
    expect(missionDisplayModel(mission({ progress: 0, target: 0 }))).toMatchObject({ ratio: 0, progressLabel: "0/0", claimable: false });
    expect(missionDisplayModel(mission({ progress: 9, target: 2 }))).toMatchObject({ ratio: 1, progressLabel: "9/2", claimable: true });
  });
});

describe("MissionsPopup 영역 배치", () => {
  const popupWidth = 1080 - MISSIONS_POPUP_LAYOUT.popup.widthInset;
  const popupHeight = 1920 - MISSIONS_POPUP_LAYOUT.popup.heightInset;

  it("게이지는 0에서 시작하고 마디는 제 비율 자리에, 양끝 액자는 안전 영역 안에 선다", () => {
    const track = researchTrackLayout(popupWidth, [20, 40, 60, 80, 100]);
    const insideSafeWidth = (bounds: { left: number; right: number }): boolean => bounds.left >= track.safeBounds.left && bounds.right <= track.safeBounds.right;
    expect(insideSafeWidth(track.frameBounds[0])).toBe(true);
    expect(insideSafeWidth(track.frameBounds.at(-1)!)).toBe(true);
    expect(insideSafeWidth(track.barBounds)).toBe(true);
    expect(track.barX).toBe(track.barLeft + track.barWidth / 2);
    // 첫 마디가 왼쪽 끝에 붙으면 "처음부터 하나는 받은 것"처럼 읽힌다.
    expect(track.stageXs[0]).toBeCloseTo(track.barLeft + track.barWidth * 0.2);
    expect(track.stageXs.at(-1)).toBeCloseTo(track.barLeft + track.barWidth);
    // 이웃한 마디의 액자가 겹치지 않는다.
    track.frameBounds.slice(1).forEach((frame, index) => expect(boundsIntersect(frame, track.frameBounds[index])).toBe(false));
  });

  it("연구도 무대 → 임무 여섯 줄 → 하단 줄이 겹치지 않고 판 안에 선다", () => {
    const { research, list, footer } = MISSIONS_POPUP_LAYOUT;
    const panelBottom = research.panelY + research.panelHeight / 2;
    expect(list.firstCardY - list.cardHeight / 2).toBeGreaterThan(panelBottom);
    const lastCardBottom = list.firstCardY + 5 * list.cardGap + list.cardHeight / 2;
    expect(footer.y - footer.tab.height / 2).toBeGreaterThan(lastCardBottom);
    expect(footer.y + footer.tab.height / 2).toBeLessThan(popupHeight / 2);
    expect(research.panelY - research.panelHeight / 2).toBeGreaterThan(-popupHeight / 2 + 40);
  });

  it("하단 줄은 판 밖 뒤로가기 자리를 피한다", () => {
    const { footer } = MISSIONS_POPUP_LAYOUT;
    // 팝업 원점은 화면 가운데다 — 뒤로가기의 화면 좌표를 본문 좌표로 옮겨 비교한다.
    const back = { left: BACK_SLOT.x - 540 - BACK_BUTTON_SIZE / 2, top: BACK_SLOT.y - 960 - BACK_BUTTON_SIZE / 2, right: BACK_SLOT.x - 540 + BACK_BUTTON_SIZE / 2, bottom: BACK_SLOT.y - 960 + BACK_BUTTON_SIZE / 2 };
    const claim = { left: footer.claim.x - footer.claim.width / 2, top: footer.y - footer.claim.height / 2, right: footer.claim.x + footer.claim.width / 2, bottom: footer.y + footer.claim.height / 2 };
    expect(boundsIntersect(claim, back)).toBe(false);
    expect(missionsTabX(1) + footer.tab.width / 2).toBeLessThan(claim.left);
    expect(missionsTabX(0) - footer.tab.width / 2).toBeGreaterThan(-popupWidth / 2);
  });

  it("초기화까지 남은 시간은 일일은 UTC 자정, 주간은 UTC 월요일 자정이다", () => {
    const thursdayNoon = new Date("2026-08-20T12:00:00Z");
    expect(missionResetRemainingMs("daily", thursdayNoon)).toBe(12 * 3_600_000);
    expect(missionResetRemainingMs("weekly", thursdayNoon)).toBe((3 * 24 + 12) * 3_600_000);
    expect(missionResetRemainingMs("weekly", new Date("2026-08-23T23:00:00Z"))).toBe(3_600_000);
    expect(formatResetRemaining((3 * 24 + 12) * 3_600_000 + 5_000)).toBe("3D 12:00:05");
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
