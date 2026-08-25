import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { setDebugRewardPopup } from "../debug";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { CurrencyIconKey } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** 상자 개봉·임무 수령·발굴 수확이 공유할 수 있는 한 개의 확정 보상 표기다. */
export interface RewardPopupItem {
  icon: CurrencyIconKey;
  amount: number;
  /** 이름이 필요한 보상만 짧게 붙인다. 재화는 아이콘과 숫자만으로도 구분되므로 생략할 수 있다. */
  label?: string;
}

export interface RewardPopupOptions {
  title?: string;
  /** 결과의 중요도에 따라 공용 26px 제목보다 한 단계 크게 요청할 수 있다. */
  titleSize?: number;
  /** 이미 다른 팝업 위에 뜨는 보상창이 뒤 화면을 얼마나 약하게 누를지 정한다. */
  dimAlpha?: number;
  items: readonly RewardPopupItem[];
  onConfirm?: () => void;
}

/** 모바일 안전 여백 안에서 네 칸까지 한 줄에 담고, 그 이상은 같은 줄을 가로로 훑는 낮은 규격이다. */
const REWARD_POPUP = { width: 920, height: 360, viewport: 820, frame: 158, gap: 198, frameY: -8 } as const;

/**
 * 서버에서 이미 지급이 확정된 결과를 짧게 확인시키는 공용 팝업이다.
 *
 * 진행을 막는 선택지가 아니라 영수증에 가까우므로 바깥·본문·안내 문구 어디를 눌러도 닫힌다.
 * 호출자는 지급 계산을 넘기지 않고, 확정된 아이콘과 수량만 전달한다.
 */
export function openRewardPopup(scene: Phaser.Scene, popups: PopupLayer, options: RewardPopupOptions): void {
  const items = options.items.filter((item) => item.amount > 0);
  if (items.length === 0) {
    options.onConfirm?.();
    return;
  }

  // 팝업 중심은 기준 게임 화면 중심이며 E2E에는 내용 대신 표시 칸 수와 확인 입력점만 알린다.
  setDebugRewardPopup(true, items.length, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 });
  popups.open({
    width: REWARD_POPUP.width,
    height: REWARD_POPUP.height,
    title: options.title ?? "획득 보상",
    titleSize: options.titleSize,
    // 얕은 암전은 뒤 현황의 맥락을 남기면서 보상 확인 중 입력 계층을 분명하게 구분한다.
    dim: true,
    dimAlpha: options.dimAlpha ?? 0.18,
    // 안전 여백의 암전면은 뒤 입력만 삼키고, 확인은 넓은 본문 입력면에서 명시적으로 받는다.
    closeOnBackdrop: false,
    onClose: () => {
      setDebugRewardPopup(false);
      options.onConfirm?.();
    },
  }, (body, close) => {
    const strip = scene.add.container(0, 0);
    const contentWidth = (items.length - 1) * REWARD_POPUP.gap + REWARD_POPUP.frame;
    const overflow = Math.max(0, contentWidth - REWARD_POPUP.viewport);
    // 한 개부터 네 개까지는 전체 묶음의 중심을 원점에 맞추고, 넘칠 때만 좌우 끝까지 이동시킨다.
    const startX = -((items.length - 1) * REWARD_POPUP.gap) / 2;
    items.forEach((item, index) => {
      const x = startX + index * REWARD_POPUP.gap;
      // 그림 한 장을 담는 칸만 사방 액자를 허용하는 기존 홀로그램 예외 규칙을 그대로 따른다.
      const frame = chipPoints(REWARD_POPUP.frame, REWARD_POPUP.frame, {
        bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 },
      });
      strip.add(drawLayer(scene, x, REWARD_POPUP.frameY, frame, { fill: 0x101722, alpha: 0.98 }));
      strip.add(scene.add.image(x, REWARD_POPUP.frameY, item.icon).setDisplaySize(120, 120));
      // 비네트가 아이콘 가장자리와 숫자 뒤를 눌러 작은 액자에서도 둘을 동시에 식별하게 한다.
      strip.add(drawInnerVignette(scene, x, REWARD_POPUP.frameY, frame, { strength: 0.62 }));
      strip.add(drawShapeOutline(scene, x, REWARD_POPUP.frameY, frame, { color: COLOR.accent, alpha: 0.82, width: 3 }));
      const amount = scene.add.text(x + REWARD_POPUP.frame / 2 - 11, REWARD_POPUP.frameY + REWARD_POPUP.frame / 2 - 9, `+${formatCurrency(item.amount)}`, textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(1, 1);
      amount.setShadow(2, 3, "#000000", 2, false, true);
      strip.add(amount);
      if (item.label) strip.add(scene.add.text(x, 91, item.label, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
    });
    body.add(strip);

    // 내용만 잘라 액자들이 닫기 버튼이나 안전 여백을 침범하지 않게 한다.
    const maskShape = scene.make.graphics({ x: body.x, y: body.y });
    maskShape.fillStyle(0xffffff).fillRect(-REWARD_POPUP.viewport / 2, -100, REWARD_POPUP.viewport, 205);
    strip.setMask(maskShape.createGeometryMask());

    body.add(drawHairline(scene, 0, 108, 700, { color: COLOR.accent, alpha: 0.3 }));
    body.add(scene.add.text(0, 139, overflow > 0 ? "좌우로 밀어 확인 · 화면을 눌러 닫기" : "화면을 눌러 확인", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));

    // 짧은 누름은 확인, 가로 끌기는 보상 줄 이동으로 갈라 눌러 닫기와 스크롤을 함께 보존한다.
    const hit = scene.add.rectangle(0, 20, REWARD_POPUP.width, REWARD_POPUP.height - 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let downX = 0; let stripX = 0; let dragged = false;
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { downX = pointer.x; stripX = strip.x; dragged = false; });
    hit.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || overflow === 0) return;
      const delta = pointer.x - downX; dragged ||= Math.abs(delta) > 8;
      strip.x = Phaser.Math.Clamp(stripX + delta, -overflow / 2, overflow / 2);
    });
    hit.on("pointerup", () => { if (!dragged) close(); });
    body.add(hit);
  });
}
