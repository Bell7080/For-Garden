import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { CurrencyGuideAction } from "../data/currencyGuide";
import type { WalletItemKey } from "../data/items";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { setCurrencyGuideOpener } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { StaminaPopup } from "./StaminaPopup";

/**
 * 재화를 눌러 여는 안내창의 **유일한 경계**.
 *
 * 예전에는 로비만 상단 재화 칸에 이 창을 이어 두어, 연구소에서 화석을 눌러도 도감에서 골드를
 * 눌러도 아무 일이 없었다 — 같은 그림이 화면에 따라 눌리기도, 눌리지 않기도 했다. 지금은
 * 씬이 열릴 때 이 한 줄만 걸면 **그 화면의 상단 줄과 액자 그림이 전부** 같은 창으로 이어진다.
 *
 * 이동은 여기서 직접 하지 않고 각 씬의 콜백에 넘긴다 — 무역처럼 로비 위에서만 열리는 판이
 * 있어, 어느 화면에서 눌렀는지에 따라 갈 곳이 다르다.
 */
export interface CurrencyGuideHost {
  scene: Phaser.Scene;
  popups: PopupLayer;
  /** 안내창의 이동 버튼을 눌렀을 때. 비우면 씬 전환만 공용 규칙으로 처리한다. */
  onAction?: (action: CurrencyGuideAction) => void;
}

/**
 * 그 화면의 재화 안내를 연다.
 *
 * **스테미나만 전용 창이다** — 남은 양·회복 시간·지금 채우는 수단이 다음 조작을 정하므로,
 * 획득처를 글로 읽는 공용 안내로는 모자란다.
 */
export function openCurrencyGuide(host: CurrencyGuideHost, key: WalletItemKey): void {
  if (key === "stamina") { new StaminaPopup(host.scene, host.popups, gameApi).open(); return; }
  new CurrencyGuidePopup(host.scene, host.popups, (action) => applyGuideAction(host, action)).open(key);
}

/** 이동 버튼의 공용 처리. 씬이 제 나름의 콜백을 주면 그쪽이 먼저다. */
function applyGuideAction(host: CurrencyGuideHost, action: CurrencyGuideAction): void {
  if (host.onAction) { host.onAction(action); return; }
  // 팝업 목적지(무역)는 그 판을 소유한 화면에서만 열 수 있으므로, 없는 화면에서는 로비로 돌아간다.
  if (action.kind === "scene") host.scene.scene.start(action.target);
  else host.scene.scene.start("lobby");
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
}
