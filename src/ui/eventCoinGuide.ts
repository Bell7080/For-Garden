import Phaser from "phaser";
import { findItem } from "../data/items";
import { ItemGuidePopup } from "./ItemGuidePopup";
import type { PopupLayer } from "./PopupLayer";

/**
 * 정기 이벤트(티아의 보물상자·델로피의 보물 찾기·슈테의 리듬 낚시) 코인 칩을 누르면 여는 안내.
 *
 * 예전에는 코인 칩 아래에 「코인은 이긴 전투에서 쓴 스테미나만큼 쌓여요 · 초기화 시각」을 늘 적어
 * 두었는데, 그 줄은 조작을 바꾸지 않는 설명이라 화면에서 걷고 가방과 같은 아이템 안내창에 맡긴다 —
 * 무엇으로 쌓이는지는 아이템 설명이, 언제 사라지는지는 기한 줄(`expiry`)이 초 단위로 말한다.
 */
export function openEventCoinGuide(scene: Phaser.Scene, popups: PopupLayer, itemId: string, coins: number, resetsAt: string): void {
  const definition = findItem(itemId);
  if (!definition) return;
  new ItemGuidePopup(scene, popups).open({ definition, quantity: coins, expiry: coins > 0 ? { count: coins, expiresAt: resetsAt } : undefined });
}
