import { UI_ICON } from "./icons";
import { t } from "../i18n";
import { LOBBY_RAIL_BOUNDS } from "./lobbyLayout";

/** 로비 편의 버튼이 호출할 씬 동작만 주입해 순수 단위 테스트에서 클릭 연결을 검증한다. */
export interface LobbyUtilityRailActions {
  openMail: () => void;
  openFriends: () => void;
  openInventory: () => void;
}

/** 편의 기능별 버튼 하나가 입력 중심 하나만 만들도록 고정한 레일 명세다. */
export function createLobbyUtilityRail(actions: LobbyUtilityRailActions) {
  // 우편·친구·가방은 각각 정확히 한 번만 생성하며 같은 동작의 입력면을 중복해서 만들지 않는다.
  return [
    { bounds: LOBBY_RAIL_BOUNDS.utility.mail, icon: "mail", label: t("rail.mail"), onClick: actions.openMail },
    { bounds: LOBBY_RAIL_BOUNDS.utility.friends, icon: "friends", label: t("rail.friends"), onClick: actions.openFriends },
    { bounds: LOBBY_RAIL_BOUNDS.utility.inventory, icon: UI_ICON.bag, label: t("rail.bag"), onClick: actions.openInventory },
  ] as const;
}
