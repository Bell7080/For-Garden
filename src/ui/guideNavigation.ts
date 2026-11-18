import Phaser from "phaser";
import type { GuideDestination } from "../data/guideRoutes";
import type { LobbyMenu } from "../scenes/lobbyEntry";
import { contentOpen, markContentEntered, showContentLockedToast } from "./contentLock";
import { startScene } from "./screenTransition";
import { relicCollection } from "../managers/RelicCollectionManager";
import { relicStories } from "../managers/RelicStoryManager";
import { session } from "../state/session";

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
    case "observation": return true;
  }
}

/**
 * 지금 답할 수 있는 관찰 질문 하나 — 애착 렐릭을 먼저 보고, 없으면 보유 순서대로 찾는다. 일지의 쪽 번호
 * (0이 본문, 1~3이 질문)를 함께 돌려준다. 열린 질문이 없으면 `undefined`.
 */
export function openObservationQuestion(): { relicId: string; page: number } | undefined {
  const owned = relicCollection.owned.map(({ id }) => id);
  const order = [session.favorite, ...owned.filter((id) => id !== session.favorite)].filter((id) => relicCollection.owns(id));
  for (const relicId of order) {
    const open = relicStories.questionViews(relicId).find(({ status }) => status === "open");
    if (open) return { relicId, page: open.index + 1 };
  }
  return undefined;
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
    case "observation": {
      // 답할 질문이 있으면 그 렐릭의 일지를 그 쪽으로 곧장 연다 — 정보창 → 일지 → 넘기기를 다시 찾지 않게 한다.
      const target = openObservationQuestion();
      startScene(scene, "relics", target ? { openRelicId: target.relicId, openJournalPage: target.page } : undefined);
      return;
    }
  }
}
