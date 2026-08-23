import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { drawGlassFade, drawHairline, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 핵심 화면 다섯 개. 로비를 중심으로 고고학과 상점이 양 끝에서 서로 균형을 이룬다. */
export const NAV_TABS = [
  { key: "archaeology", scene: "archaeology", label: "고고학" },
  { key: "relics", scene: "relics", label: "렐릭" },
  { key: "lobby", scene: "lobby", label: "로비" },
  { key: "lab", scene: "lab", label: "연구소" },
  { key: "shop", scene: "shop", label: "상점" },
] as const;

export type NavKey = (typeof NAV_TABS)[number]["key"];

export const NAV_TOP = BASE_HEIGHT - 180;

/**
 * 아이콘은 아직 그림이 없어 선으로 그린다. 채운 덩어리 대신 얇은 선을 쓰는 이유는, 하단 바에
 * 판때기가 없어서 굵은 실루엣이 배경 원화 위에 얼룩처럼 보이기 때문이다.
 */
function drawIcon(scene: Phaser.Scene, key: NavKey, x: number, y: number, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(3, color, 1);
  switch (key) {
    case "archaeology":
      // 아래를 향한 드릴 — 땅속 자원과 장기 탐사를 파는 고고학 입구다.
      g.strokePoints([
        new Phaser.Geom.Point(-15, -20), new Phaser.Geom.Point(15, -20),
        new Phaser.Geom.Point(10, 6), new Phaser.Geom.Point(0, 23),
        new Phaser.Geom.Point(-10, 6),
      ], true);
      g.lineBetween(-19, -9, 19, -9);
      break;
    case "relics":
      // 사람 실루엣 — 보유 렐릭.
      g.strokeCircle(0, -13, 11);
      g.beginPath();
      g.arc(0, 20, 19, Math.PI, 0);
      g.strokePath();
      break;
    case "lobby":
      // 마름모 — 이터널 시티의 중심.
      g.strokePoints([
        new Phaser.Geom.Point(0, -22), new Phaser.Geom.Point(17, 0),
        new Phaser.Geom.Point(0, 22), new Phaser.Geom.Point(-17, 0),
      ], true);
      break;
    case "lab":
      // 플라스크 — 분석과 배양을 담당하는 연구소.
      g.strokePoints([
        new Phaser.Geom.Point(-7, -20), new Phaser.Geom.Point(7, -20),
        new Phaser.Geom.Point(7, -6), new Phaser.Geom.Point(19, 20),
        new Phaser.Geom.Point(-19, 20), new Phaser.Geom.Point(-7, -6),
      ], true);
      break;
    case "shop":
      // 각진 쇼핑백 — 별도 화면으로 독립한 상점이다.
      g.strokeRect(-18, -8, 36, 30);
      g.beginPath();
      g.moveTo(-10, -8);
      g.lineTo(-7, -19);
      g.lineTo(7, -19);
      g.lineTo(10, -8);
      g.strokePath();
      break;
  }
  return g;
}

/**
 * 하단 탭 막대.
 *
 * 판때기를 깔지 않고 검정에서 투명으로 빠지는 유리면만 둔다. 배경 원화가 바 아래까지 이어져
 * 보이되 아이콘과 글자는 읽힌다. 지금 화면인 탭은 강조색과 살짝 큰 크기로만 알린다.
 */
export class BottomNav {
  constructor(scene: Phaser.Scene, current: NavKey) {
    const height = BASE_HEIGHT - NAV_TOP;
    drawGlassFade(scene, BASE_WIDTH / 2, NAV_TOP + height / 2, BASE_WIDTH, height, {
      topAlpha: 0,
      bottomAlpha: 0.94,
    });
    drawHairline(scene, BASE_WIDTH / 2, NAV_TOP + 12, BASE_WIDTH, { color: COLOR.accent, alpha: 0.22 });

    const step = BASE_WIDTH / NAV_TABS.length;
    NAV_TABS.forEach((tab, i) => {
      const x = step * (i + 0.5);
      const active = tab.key === current;
      const color = active ? COLOR.accent : 0x9aa3ad;

      const group = scene.add.container(x, NAV_TOP + 84);
      group.add(drawIcon(scene, tab.key, 0, -16, color));
      group.add(
        scene.add
          .text(0, 26, tab.label, textStyle({ role: "emphasis", size: 26, color: active ? COLOR.accentText : COLOR.inkDim }))
          .setOrigin(0.5, 0),
      );
      // 지금 화면인 탭만 살짝 크다. 밑줄이나 상자 대신 크기로 알린다.
      group.setScale(active ? 1.12 : 1);

      const hit = scene.add
        .rectangle(x, NAV_TOP + 90, step - 8, 160, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      if (!active) {
        // 누르는 동안만 확대해 눌린 자리를 알린다.
        hit.on("pointerdown", () => group.setScale(1.16));
        hit.on("pointerout", () => group.setScale(1));
        hit.on("pointerup", () => scene.scene.start(tab.scene));
      }

      if (active) {
        // 탭 사이를 가르는 얇은 세로선. 상자를 두르지 않고 자리만 나눈다.
        for (const edge of [x - step / 2, x + step / 2]) {
          const divider = scene.add.graphics({ x: edge, y: NAV_TOP + 92 });
          divider.lineStyle(HOLO.lineWidth, COLOR.accent, 0.18);
          divider.lineBetween(0, -52, 0, 52);
        }
      }
    });
  }
}
