import { describe, expect, it, vi } from "vitest";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { createLobbyUtilityRail } from "../../src/ui/lobbyUtilityRail";

describe("lobby utility rail", () => {
  it("creates one inventory input center and opens inventory once for one click", () => {
    // 세 동작을 따로 감시해 가방 입력이 다른 편의 기능에 잘못 연결되는 경우도 함께 막는다.
    const actions = { openMail: vi.fn(), openFriends: vi.fn(), openInventory: vi.fn() };
    const rail = createLobbyUtilityRail(actions);

    // 우편·친구·가방이 하나씩 생성되어 같은 좌표에서 입력을 중복 수신하지 않아야 한다.
    expect(rail.map(({ label }) => label)).toEqual(["우편", "친구", "가방"]);
    const inventoryInputs = rail.filter(({ bounds }) => bounds === LOBBY_RAIL_BOUNDS.utility.inventory);
    expect(inventoryInputs).toHaveLength(1);

    // 실제 RailButton이 한 번 실행할 콜백 하나가 가방 열기도 정확히 한 번만 전달해야 한다.
    inventoryInputs[0].onClick();
    expect(actions.openInventory).toHaveBeenCalledTimes(1);
    expect(actions.openMail).not.toHaveBeenCalled();
    expect(actions.openFriends).not.toHaveBeenCalled();
  });
});
