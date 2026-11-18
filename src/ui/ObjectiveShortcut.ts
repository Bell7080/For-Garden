import Phaser from "phaser";
import type { GuideDestination } from "../data/guideRoutes";
import { isTapDistance } from "../core/tapGuard";
import { contentOpen, showContentLockedToast } from "./contentLock";
import { drawGlyph } from "./glyphs";
import { followGuideDestination, guideDestinationUsable, type GuideNavigator } from "./guideNavigation";
import { chipPoints, drawLayer } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";

/**
 * 임무·업적·성장 가이드 줄 왼쪽 끝의 「바로가기」 칩 — **한 장**이다.
 *
 * 목표 문장만으로는 어디서 하는 일인지 알 수 없는 줄이 있어(「관찰 질문 1개 답변」), 그 일을 하는 화면으로
 * 곧장 데려간다. 줄 왼쪽의 상태 빗금 자리에 같은 높이로 서서 줄의 실루엣을 바꾸지 않고, 생김새는 재화
 * 안내창의 화살표 칩과 같은 강조색 칩 + 겹 꺾쇠다. 갈 곳이 없는 줄에는 세우지 않는다(부르는 쪽이 빗금을 둔다).
 */
export const OBJECTIVE_SHORTCUT = {
  width: 44,
  /** 줄 왼쪽 끝에서 칩 가운데까지. */
  inset: 34,
  /** 칩 오른쪽에서 글자가 시작하기까지의 여백. */
  textGap: 18,
} as const;

/** 칩을 세울 수 있으면 칩 오른쪽 끝의 x를, 아니면 `undefined`를 돌려준다. */
export function addObjectiveShortcut(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  options: { readonly left: number; readonly y: number; readonly height: number; readonly tone: number; readonly destination: GuideDestination | undefined; readonly navigator: GuideNavigator | undefined; readonly popups: PopupLayer },
): number | undefined {
  const { navigator, destination } = options;
  if (!navigator || !guideDestinationUsable(navigator, destination)) return undefined;
  const { width, inset } = OBJECTIVE_SHORTCUT;
  const chip = scene.add.container(options.left + inset, options.y);
  const bevel = Math.min(14, width * 0.32);
  chip.add(drawLayer(scene, 0, 0, chipPoints(width, options.height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } }), { fill: options.tone, alpha: 0.92, shadow: false }));
  chip.add(drawGlyph(scene, "page-next", -1, -9, 22, 0x1a1206, 1, 4));
  chip.add(drawGlyph(scene, "page-next", -1, 9, 22, 0x1a1206, 0.55, 4));
  const hit = scene.add.rectangle(0, 0, width + 24, options.height + 8, 0xffffff, 0).setInteractive({ useHandCursor: true });
  chip.add(hit);
  hit.on("pointerdown", () => pressIn(chip));
  hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
  hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    pressOut(chip);
    // 목록을 끌던 손이 칩 위에서 떨어진 것은 누른 것이 아니다.
    if (!isTapDistance(pointer.getDistance())) return;
    // 잠긴 콘텐츠는 창을 닫지 않고 그 자리에서 개방 조건만 말한다.
    if ("content" in destination && destination.content && !contentOpen(destination.content)) { showContentLockedToast(scene, destination.content); return; }
    // 창을 모두 닫고 나서 옮긴다 — 열린 판이 있으면 로비 판(출격 등)이 열리지 않는다.
    options.popups.closeAll();
    followGuideDestination(navigator, destination);
  });
  parent.add(chip);
  return options.left + inset + width / 2;
}
