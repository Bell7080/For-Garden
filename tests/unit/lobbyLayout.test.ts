import { describe, expect, it } from "vitest";
import { LOBBY_ACTION_BOUNDS, LOBBY_NAV_TOP, LOBBY_RAIL_BOUNDS, LOBBY_UPPER_BOUNDS, lobbyBoundsGap, lobbyBoundsIntersect, type LobbyInputBounds } from "../../src/ui/lobbyLayout";

/** 중첩 검사를 위해 역할별 중첩 객체를 평평한 버튼 목록으로 바꾼다. */
const railButtons = Object.values(LOBBY_RAIL_BOUNDS).flatMap((rail) => Object.values(rail)) as LobbyInputBounds[];

describe("lobby input layout", () => {
  it("keeps mission and the single shop entry ordered on the content rail", () => {
    // 구형 무역 버튼을 되살리지 않고 임무 다음 한 슬롯만 일반 상점이 차지하도록 고정한다.
    const { mission, shop } = LOBBY_RAIL_BOUNDS.content;
    expect(Object.keys(LOBBY_RAIL_BOUNDS.content)).toEqual(["mission", "shop"]);
    expect(mission.x).toBe(shop.x);
    expect(mission.y).toBeLessThan(shop.y);
  });

  it("places mission content left and inventory utility right", () => {
    // 로비 핵심 요청인 좌우 반전을 x 좌표로 고정해 이후 버튼 추가가 되돌리지 못하게 한다.
    expect(LOBBY_RAIL_BOUNDS.content.mission.x).toBeLessThan(LOBBY_RAIL_BOUNDS.utility.inventory.x);
  });

  it("keeps every rail button separated from its neighbors", () => {
    // 눌림 확대가 있어도 같은 레일과 맞은편 레일의 입력면이 서로 가로채지 않아야 한다.
    for (let first = 0; first < railButtons.length; first += 1) {
      for (let second = first + 1; second < railButtons.length; second += 1) {
        expect(lobbyBoundsIntersect(railButtons[first], railButtons[second])).toBe(false);
      }
    }
  });

  it("fits both rails between the upper profile/promo region and NAV_TOP", () => {
    // 위쪽 홍보 판과 아래 내비게이션 사이에 최소 반 슬롯의 숨 쉴 공간을 남긴다.
    const halfSlot = LOBBY_RAIL_BOUNDS.content.mission.height / 2;
    expect(railButtons.every((bounds) => lobbyBoundsGap(bounds, LOBBY_UPPER_BOUNDS) >= halfSlot)).toBe(true);
    expect(railButtons.every((bounds) => bounds.y + bounds.height / 2 + halfSlot <= LOBBY_NAV_TOP)).toBe(true);
  });

  it("keeps utility buttons away from lower action controls", () => {
    // 우편·친구·가방은 중앙 캐릭터 대신 가장자리를 쓰며 하단 행동 입력도 침범하지 않는다.
    const actions = [LOBBY_ACTION_BOUNDS.expedition, LOBBY_ACTION_BOUNDS.sortie, LOBBY_ACTION_BOUNDS.bottomNav];
    expect(Object.values(LOBBY_RAIL_BOUNDS.utility).every((button) => actions.every((action) => !lobbyBoundsIntersect(button, action)))).toBe(true);
  });
});
