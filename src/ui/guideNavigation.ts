import Phaser from "phaser";
import type { GuideDestination } from "../data/guideRoutes";
import type { LobbyMenu } from "../scenes/lobbyEntry";
import { contentOpen, markContentEntered, showContentLockedToast } from "./contentLock";
import { startScene } from "./screenTransition";

/**
 * 안내창 줄 옆 화살표가 실제로 가는 길 — **한 곳**에서만 정한다.
 *
 * 재화·아이템 안내는 연구소·상점·가방·우편·영수증 어디서든 열리므로, 화살표가 화면마다 다른 길을 고르면
 * 같은 줄이 어디서는 상점으로, 어디서는 아무 데도 가지 않는다. 잠긴 콘텐츠는 옮기지 않고 개방 조건을
 * 토스트로 말한다(로비 입구와 같은 규칙).
 */
export interface GuideNavigator {
  readonly scene: Phaser.Scene;
  /** 로비 위 판(발굴·무역·임무·출격)을 그 자리에서 여는 길. 로비만 준다 — 없으면 로비로 돌아가 그 판을 연다. */
  readonly onLobbyPanel?: (panel: LobbyMenu) => void;
  /** 스테미나 창을 그 자리에서 연다. */
  readonly openStamina?: () => void;
}

/** 이 화면에서 그 줄에 화살표를 세울 것인가 — 이미 그 화면에 서 있으면 갈 곳이 없다. */
export function guideDestinationUsable(navigator: GuideNavigator, destination: GuideDestination | undefined): destination is GuideDestination {
  if (!destination) return false;
  const here = navigator.scene.scene.key;
  switch (destination.kind) {
    case "scene": return destination.scene !== here;
    case "premium": return here !== "premium";
    case "shop": return true;
    case "lobby": return true;
    case "stamina": return navigator.openStamina !== undefined;
  }
}

/** 화살표를 눌렀다. 안내창은 부르는 쪽이 먼저 닫는다. */
export function followGuideDestination(navigator: GuideNavigator, destination: GuideDestination): void {
  const { scene } = navigator;
  const content = "content" in destination ? destination.content : undefined;
  if (content && !contentOpen(content)) { showContentLockedToast(scene, content); return; }
  if (content) markContentEntered(content);
  switch (destination.kind) {
    case "scene": startScene(scene, destination.scene); return;
    case "premium": startScene(scene, "premium", { section: "premium", tab: destination.tab }); return;
    case "shop": startScene(scene, "shop", { storefront: destination.storefront, returnScene: "lobby" }); return;
    case "lobby":
      if (navigator.onLobbyPanel) navigator.onLobbyPanel(destination.panel);
      else startScene(scene, "lobby", { menu: destination.panel });
      return;
    case "stamina": navigator.openStamina?.(); return;
  }
}
