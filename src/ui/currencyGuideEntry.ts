import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { LobbyMenu } from "../scenes/lobbyEntry";
import type { GuideNavigator } from "./guideNavigation";
import type { WalletItemKey } from "../data/items";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { setCurrencyGuideOpener, setItemGuideOpener } from "./itemFrame";
import { ItemGuidePopup } from "./ItemGuidePopup";
import { session } from "../state/session";
import type { ItemDefinition } from "../data/items";
import type { PopupLayer } from "./PopupLayer";
import { StaminaPopup } from "./StaminaPopup";

/**
 * 재화를 눌러 여는 안내창의 **유일한 경계**.
 *
 * 예전에는 로비만 상단 재화 칸에 이 창을 이어 두어, 연구소에서 화석을 눌러도 도감에서 골드를
 * 눌러도 아무 일이 없었다 — 같은 그림이 화면에 따라 눌리기도, 눌리지 않기도 했다. 지금은
 * 씬이 열릴 때 이 한 줄만 걸면 **그 화면의 상단 줄과 액자 그림이 전부** 같은 창으로 이어진다.
 *
 * 줄 옆 화살표의 길은 `guideNavigation` 한 곳이 정한다. 로비만 판(발굴·무역·임무·출격)을 그 자리에서
 * 여는 콜백을 넘기고, 다른 화면은 로비로 돌아가 그 판을 연다.
 */
export interface CurrencyGuideHost {
  scene: Phaser.Scene;
  popups: PopupLayer;
  /** 로비 위 판을 그 자리에서 여는 길 — 로비만 준다. */
  onLobbyPanel?: (panel: LobbyMenu) => void;
}

/**
 * 그 화면의 재화 안내를 연다.
 *
 * **스테미나만 전용 창이다** — 남은 양·회복 시간·지금 채우는 수단이 다음 조작을 정하므로,
 * 획득처를 글로 읽는 공용 안내로는 모자란다.
 */
export function openCurrencyGuide(host: CurrencyGuideHost, key: WalletItemKey): void {
  if (key === "stamina") { openStaminaGuide(host); return; }
  new CurrencyGuidePopup(host.scene, host.popups, guideNavigatorParts(host)).open(key);
}

function openStaminaGuide(host: CurrencyGuideHost): void {
  // 스테미나 창 안의 줄은 스테미나 창을 다시 열 필요가 없다(`openStamina`를 넘기지 않는다).
  new StaminaPopup(host.scene, host.popups, gameApi, { onLobbyPanel: host.onLobbyPanel }).open();
}

/** 안내창 줄 옆 화살표가 쓰는 길 — 로비 판 콜백과 그 자리에서 여는 스테미나 창. */
export function guideNavigatorParts(host: CurrencyGuideHost): Omit<GuideNavigator, "scene"> {
  return { onLobbyPanel: host.onLobbyPanel, openStamina: () => openStaminaGuide(host) };
}

/**
 * 이 화면의 모든 재화 액자를 안내창에 잇는다.
 *
 * 화면 하나에 한 번만 부르면 된다 — 그 뒤로 이 씬에서 `addFramedIcon`이 세우는 재화 그림은
 * 상점이든 무역이든 가방이든 전부 눌리는 그림이 된다. 액자를 세우는 자리마다 따로 이어 주면
 * 새 화면이 생길 때마다 한 곳을 빠뜨리고, 빠뜨린 것이 보이지 않는다.
 */
export function bindCurrencyGuide(host: CurrencyGuideHost): void {
  setCurrencyGuideOpener(host.scene, (key) => openCurrencyGuide(host, key));
  setItemGuideOpener(host.scene, (definition) => openItemGuide(host, definition));
}

/**
 * 재료·소비품 안내 — 가방에서 여는 것과 **같은 창**이다(`ItemGuidePopup`). 보유 수는 지금 가방에서
 * 읽고, 「사용하기」는 가방에서만 선다(쓰는 일은 가방의 몫이고 영수증·우편은 보여 주기만 한다).
 */
export function openItemGuide(host: CurrencyGuideHost, definition: ItemDefinition): void {
  const quantity = session.itemInventory.find(({ itemId }) => itemId === definition.id)?.quantity ?? 0;
  new ItemGuidePopup(host.scene, host.popups, guideNavigatorParts(host)).open({ definition, quantity });
}
