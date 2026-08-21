import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { COLOR, textStyle } from "./theme";

/** 하단 탭 세 개. 어느 화면에 있든 같은 자리, 같은 순서다. */
export const NAV_TABS = [
  { key: "relics", scene: "relics", label: "렐릭" },
  { key: "lobby", scene: "lobby", label: "로비" },
  { key: "lab", scene: "lab", label: "연구소" },
] as const;

export type NavKey = (typeof NAV_TABS)[number]["key"];

export const NAV_TOP = BASE_HEIGHT - 180;

/**
 * 아이콘은 아직 그림이 없어 도형으로 그린다. 나중에 아트가 나오면 이 함수만 바꾸면 된다.
 * 셋을 한눈에 구분하려고 실루엣을 다르게 뒀다.
 */
function drawIcon(scene: Phaser.Scene, key: NavKey, x: number, y: number, color: number): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];
  switch (key) {
    case "relics":
      // 사람 실루엣 — 보유 렐릭.
      parts.push(scene.add.circle(x, y - 14, 12, color));
      parts.push(scene.add.ellipse(x, y + 12, 36, 26, color));
      break;
    case "lobby":
      // 마름모 — 이터널 시티의 중심.
      parts.push(scene.add.star(x, y, 4, 12, 26, color));
      break;
    case "lab":
      // 플라스크 — 발굴과 배양. 점은 좌표 원점이 도형의 왼쪽 위라 모두 양수로 준다.
      parts.push(scene.add.rectangle(x, y - 20, 14, 14, color));
      parts.push(scene.add.triangle(x, y + 8, 22, 0, 44, 36, 0, 36, color));
      break;
  }
  return parts;
}

/**
 * 하단 탭 막대. 지금 화면에 해당하는 탭은 눌리지 않고 강조만 된다.
 */
export class BottomNav {
  constructor(scene: Phaser.Scene, current: NavKey) {
    scene.add
      .rectangle(BASE_WIDTH / 2, (NAV_TOP + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - NAV_TOP, COLOR.panel)
      .setStrokeStyle(2, COLOR.panelEdge);

    const step = BASE_WIDTH / NAV_TABS.length;
    NAV_TABS.forEach((tab, i) => {
      const x = step * (i + 0.5);
      const active = tab.key === current;
      const color = active ? COLOR.accent : COLOR.panelEdge;

      const hit = scene.add
        .rectangle(x, NAV_TOP + 90, step - 8, 160, COLOR.panel, 0)
        .setInteractive({ useHandCursor: true });
      if (!active) hit.on("pointerdown", () => scene.scene.start(tab.scene));

      for (const part of drawIcon(scene, tab.key, x, NAV_TOP + 62, color)) void part;

      scene.add
        .text(x, NAV_TOP + 110, tab.label, textStyle({ role: "emphasis", size: 26, color: active ? COLOR.accentText : COLOR.inkDim }))
        .setOrigin(0.5, 0);

      if (active) {
        // 지금 화면임을 위쪽 선으로 알린다.
        scene.add.rectangle(x, NAV_TOP + 3, step - 40, 6, COLOR.accent);
      }
    });
  }
}
