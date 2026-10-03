import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { drawGlassFade, drawHairline, HOLO } from "./holo";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { startNavScene } from "./screenTransition";
import { NAV_TABS, navTabDirection, type NavKey } from "../core/navTabs";
import { pressIn, pressOut } from "./pressFeedback";
import { consumeUnlockCelebration, contentOpen, playUnlockSequence, showContentLockedToast } from "./contentLock";
import { addPadlock } from "./Padlock";
import { LOCK_DIM } from "./lockStyle";
import type { ContentId } from "../core/contentUnlock";

/** 차례와 넘김 규칙은 순수 표가 갖는다. 여기서는 그리기만 한다. */
export { NAV_TABS };
export type { NavKey };

/**
 * 탭의 이름.
 *
 * **표에 넣지 않는다** — 표는 모듈을 읽는 순간 굳어, 문구 표가 도착하기 전에 고른 낱말이
 * 언어를 바꿔도 그대로 남는다(일본어로 바꿔도 하단 탭만 한국어로 서 있었다).
 */
export function navLabel(key: NavKey): string {
  return t(`nav.${key}`);
}

/** 탭이 레벨로 잠기는 콘텐츠. 숨기지 않고 자물쇠를 건 채로 남긴다 — 줄에 있어야 할 자리가 비면 화면이 덜 만든 것으로 읽힌다. */
const NAV_CONTENT: Partial<Record<NavKey, ContentId>> = { archaeology: "archaeology" };

export const NAV_TOP = BASE_HEIGHT - 180;

/** 지금 화면인 탭이 커지는 배율. 이름을 칸에 맞출 때도 이만큼을 미리 뺀다. */
const ACTIVE_SCALE = 1.12;

/** 탭 이름이 칸 좌우에서 비워 두는 자리. 두 탭의 글자가 맞닿아 한 낱말로 읽히지 않게 한다. */
const NAV_LABEL_GUTTER = 18;

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
    case "premium":
      // 각진 쇼핑백 — 인게임 무역과 구분된 유료 프리미엄 상품 화면이다.
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
      const contentId = NAV_CONTENT[tab.key];
      // 방금 열린 탭은 잠긴 모습으로 시작해 자물쇠가 터지며 풀린다.
      const celebrate = contentId !== undefined && contentOpen(contentId) && consumeUnlockCelebration(contentId);
      let locked = contentId !== undefined && (!contentOpen(contentId) || celebrate);
      const color = active ? COLOR.accent : 0x9aa3ad;

      const group = scene.add.container(x, NAV_TOP + 84);
      const icon = drawIcon(scene, tab.key, 0, -16, color);
      group.add(icon);
      /*
       * **다섯이 폭을 나눠 갖는 줄이라 이름이 칸을 넘으면 옆 탭을 침범한다.**
       *
       * 낱말 길이는 언어가 정한다 — 「연구소」 세 글자가 영어에서는 `Research Lab` 열두
       * 글자다. 크기를 낮추지 않고 가로로만 누르는 것은 다섯이 나란히 선 줄에서 한 칸만
       * 글자가 작아지면 그 탭이 덜 중요한 것처럼 읽히기 때문이다. 지금 화면인 탭은 1.12배로
       * 커지므로 그만큼을 미리 뺀 자리에 맞춘다.
       */
      const label = squeezeTextToWidth(
        scene.add
          .text(0, 26, navLabel(tab.key), textStyle({ role: "emphasis", size: 26, color: active ? COLOR.accentText : COLOR.inkDim }))
          .setOrigin(0.5, 0),
        (step - NAV_LABEL_GUTTER) / ACTIVE_SCALE,
      );
      group.add(label);
      if (locked && contentId) {
        // 판을 덮지 않고 글자와 아이콘만 가라앉힌다 — 아이콘 자리에는 같은 크기의 회색 자물쇠가 대신 선다.
        icon.setVisible(false);
        label.setAlpha(LOCK_DIM.labelAlpha);
        const lock = addPadlock(scene, 0, -16, 44, { color: LOCK_DIM.lockColor, alpha: LOCK_DIM.lockAlpha * 0.7 });
        group.add(lock);
        if (celebrate) {
          scene.time.delayedCall(500, () => {
            if (!lock.active) return;
            playUnlockSequence(scene, lock, {
              id: contentId,
              onStart: () => scene.tweens.add({ targets: label, alpha: 1, duration: 420, ease: "Sine.easeOut" }),
              onOpen: () => {
                locked = false;
                if (!icon.active) return;
                icon.setVisible(true).setAlpha(0).setScale(0.6);
                scene.tweens.add({ targets: icon, alpha: 1, scale: 1, duration: 320, ease: "Back.easeOut" });
              },
            });
          });
        }
      }
      // 지금 화면인 탭만 살짝 크다. 밑줄이나 상자 대신 크기로 알린다.
      group.setScale(active ? ACTIVE_SCALE : 1);

      const hit = scene.add
        .rectangle(x, NAV_TOP + 90, step - 8, 160, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      if (!active) {
        // 누르는 동안 공용 눌림 연출로 눌린 자리를 알린다.
        hit.on("pointerdown", () => pressIn(group));
        hit.on("pointerout", () => pressOut(group, "normal", { pop: false }));
        hit.on("pointerup", () => {
          if (locked && contentId) { showContentLockedToast(scene, contentId); return; }
          startNavScene(scene, tab.scene, navTabDirection(current, tab.key));
        });
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

