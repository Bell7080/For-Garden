import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { drawGlassFade, drawHairline, HOLO } from "./holo";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { startNavScene } from "./screenTransition";
import { NAV_TABS, navSwipeStep, navTabDirection, neighborNavTab, type NavKey } from "../core/navTabs";
import { anyPopupOpen } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";

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
      const color = active ? COLOR.accent : 0x9aa3ad;

      const group = scene.add.container(x, NAV_TOP + 84);
      group.add(drawIcon(scene, tab.key, 0, -16, color));
      /*
       * **다섯이 폭을 나눠 갖는 줄이라 이름이 칸을 넘으면 옆 탭을 침범한다.**
       *
       * 낱말 길이는 언어가 정한다 — 「연구소」 세 글자가 영어에서는 `Research Lab` 열두
       * 글자다. 크기를 낮추지 않고 가로로만 누르는 것은 다섯이 나란히 선 줄에서 한 칸만
       * 글자가 작아지면 그 탭이 덜 중요한 것처럼 읽히기 때문이다. 지금 화면인 탭은 1.12배로
       * 커지므로 그만큼을 미리 뺀 자리에 맞춘다.
       */
      group.add(squeezeTextToWidth(
        scene.add
          .text(0, 26, navLabel(tab.key), textStyle({ role: "emphasis", size: 26, color: active ? COLOR.accentText : COLOR.inkDim }))
          .setOrigin(0.5, 0),
        (step - NAV_LABEL_GUTTER) / ACTIVE_SCALE,
      ));
      // 지금 화면인 탭만 살짝 크다. 밑줄이나 상자 대신 크기로 알린다.
      group.setScale(active ? ACTIVE_SCALE : 1);

      const hit = scene.add
        .rectangle(x, NAV_TOP + 90, step - 8, 160, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      if (!active) {
        // 누르는 동안 공용 눌림 연출로 눌린 자리를 알린다.
        hit.on("pointerdown", () => pressIn(group));
        hit.on("pointerout", () => pressOut(group, "normal", { pop: false }));
        hit.on("pointerup", () => startNavScene(scene, tab.scene, navTabDirection(current, tab.key)));
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

    enableNavSwipe(scene, current);
  }
}

/**
 * 이번 손짓을 화면이 **제 것으로 가져갔는가**.
 *
 * 고고학 지도는 손가락을 따라 상하좌우로 자유롭게 움직인다 — 그 손을 넘김으로 읽으면 지도를
 * 옆으로 미는 것만으로 화면이 갈려 지도를 볼 수가 없다. 가로 드래그를 제 조작으로 쓰는 것은
 * 누르기 시작한 자리가 어디인지 스스로 알고 있으므로, **그쪽이 가져간다**고 말하게 한다.
 */
let claimed = false;

/** 지금 도는 손짓을 화면이 가져간다. 다음 `pointerdown`에 저절로 풀린다. */
export function claimNavSwipe(): void {
  claimed = true;
}

/**
 * 좌우로 밀어 옆 화면으로 간다.
 *
 * **다섯 화면이 모두 이 막대를 세우므로 여기 한 곳에 건다.** 씬마다 붙이면 화면이 늘 때
 * 빠뜨리고, 같은 손짓이 어디서는 되고 어디서는 안 되는 일이 생긴다.
 *
 * 판이 떠 있는 동안에는 받지 않는다 — 가방이나 무역 작업판 위에서 목록을 훑던 손이 그 판을
 * 통째로 갈아 치우면 안 된다. 세로로 더 많이 움직인 손도 넘기지 않는다(도감은 세로로 훑는
 * 목록이라 손이 비스듬히 지나가기 쉽다). 판단은 순수 규칙(`navSwipeStep`)이 한다.
 */
function enableNavSwipe(scene: Phaser.Scene, current: NavKey): void {
  let start: { x: number; y: number } | undefined;
  let left = false;
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    claimed = false;
    start = anyPopupOpen() ? undefined : { x: pointer.x, y: pointer.y };
  };
  const onUp = (pointer: Phaser.Input.Pointer): void => {
    const from = start;
    start = undefined;
    // 이미 넘어가는 중이면 두 번 세지 않는다 — 다음 화면이 뜨기 전의 손까지 받으면 두 칸 건너뛴다.
    if (!from || left || claimed || anyPopupOpen()) return;
    const step = navSwipeStep(pointer.x - from.x, pointer.y - from.y);
    if (step === 0) return;
    const next = neighborNavTab(current, step);
    if (!next) return;
    left = true;
    startNavScene(scene, next.scene, step);
  };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
  });
}
