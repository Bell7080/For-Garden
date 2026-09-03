import Phaser from "phaser";
import type { PopupLayer } from "./PopupLayer";
import { drawHairline } from "./holo";
import { COLOR, textStyle } from "./theme";
import type { UnitStatusView } from "./unitStatusModel";

/**
 * 머리 위 상태 칩을 누르면 열리는 쪽지.
 *
 * 칩은 작아 "무엇이 걸렸나"까지만 말한다 — 몇 겹이 얼마나 남았고 그게 무슨 뜻인지는 눌러서
 * 읽는다. 목록은 칩과 **같은 순서·같은 색**(`unitStatusViews`)이라 어느 줄이 어느 칩인지
 * 세어 보지 않아도 안다.
 */
export function openUnitStatusPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  name: string,
  views: readonly UnitStatusView[],
  anchor?: { x: number; y: number },
): void {
  if (views.length === 0) return;
  const rowHeight = 78;
  // 글자가 들어가는 만큼만 넓다. 남는 여백은 읽는 데 도움이 되지 않고 전장만 가린다.
  const width = 620;
  const height = 150 + views.length * rowHeight;
  popups.open({ width, height, title: `${name} · 상태`, anchor, tilt: -1.2 }, (content) => {
    const top = -height / 2 + 118;
    views.forEach((view, index) => {
      const y = top + index * rowHeight;
      const marker = scene.add.graphics().fillStyle(view.color, 1).fillPoints([
        { x: -250, y }, { x: -238, y: y - 12 }, { x: -226, y }, { x: -238, y: y + 12 },
      ], true);
      content.add(marker);
      content.add(scene.add.text(-208, y, view.name, textStyle({ role: "display", size: 26 })).setOrigin(0, 0.5));
      content.add(scene.add.text(250, y, view.detail, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(1, 0.5));
      if (index < views.length - 1) content.add(drawHairline(scene, 0, y + rowHeight / 2, 520, { color: COLOR.accent, alpha: 0.2 }));
    });
  });
}
