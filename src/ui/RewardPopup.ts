import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { setDebugRewardPopup } from "../debug";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { CurrencyIconKey } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 상자 개봉·임무 수령·발굴 수확이 공유할 수 있는 한 개의 확정 보상 표기다. */
export interface RewardPopupItem {
  icon: CurrencyIconKey;
  amount: number;
  /** 이름이 필요한 보상만 짧게 붙인다. 재화는 아이콘과 숫자만으로도 구분되므로 생략할 수 있다. */
  label?: string;
}

export interface RewardPopupOptions {
  title?: string;
  items: readonly RewardPopupItem[];
  onConfirm?: () => void;
}

/** 최대 세 개 보상을 한 줄에 놓아 모바일에서도 액자와 숫자가 먼저 읽히게 하는 간결한 고정 규격이다. */
const REWARD_POPUP = { width: 720, height: 500, frame: 170, gap: 210 } as const;

/**
 * 서버에서 이미 지급이 확정된 결과를 짧게 확인시키는 공용 팝업이다.
 *
 * 진행을 막는 선택지가 아니라 영수증에 가까우므로 바깥·본문·안내 문구 어디를 눌러도 닫힌다.
 * 호출자는 지급 계산을 넘기지 않고, 확정된 아이콘과 수량만 전달한다.
 */
export function openRewardPopup(scene: Phaser.Scene, popups: PopupLayer, options: RewardPopupOptions): void {
  const items = options.items.filter((item) => item.amount > 0).slice(0, 3);
  if (items.length === 0) {
    options.onConfirm?.();
    return;
  }

  setDebugRewardPopup(true);
  popups.open({
    width: REWARD_POPUP.width,
    height: REWARD_POPUP.height,
    title: options.title ?? "획득 보상",
    // 확인 영수증은 선택을 막는 모달이 아니므로, 발굴장 배경과 작업 중 SD를 두 번 어둡게 덮지 않는다.
    dim: false,
    closeOnBackdrop: true,
    onClose: () => {
      setDebugRewardPopup(false);
      options.onConfirm?.();
    },
  }, (body, close) => {
    const startX = -((items.length - 1) * REWARD_POPUP.gap) / 2;
    items.forEach((item, index) => {
      const x = startX + index * REWARD_POPUP.gap;
      // 그림 한 장을 담는 칸만 사방 액자를 허용하는 기존 홀로그램 예외 규칙을 그대로 따른다.
      const frame = chipPoints(REWARD_POPUP.frame, REWARD_POPUP.frame, {
        bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 },
      });
      body.add(drawLayer(scene, x, -35, frame, { fill: 0x101722, alpha: 0.98 }));
      body.add(scene.add.image(x, -35, item.icon).setDisplaySize(124, 124));
      body.add(drawInnerVignette(scene, x, -35, frame, { strength: 0.48 }));
      body.add(drawShapeOutline(scene, x, -35, frame, { color: COLOR.accent, alpha: 0.82, width: 3 }));
      body.add(scene.add.text(x, 92, `+${formatCurrency(item.amount)}`, textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(0.5));
      if (item.label) body.add(scene.add.text(x, 132, item.label, textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));
    });

    body.add(drawHairline(scene, 0, 155, 570, { color: COLOR.accent, alpha: 0.3 }));
    body.add(scene.add.text(0, 194, "화면을 눌러 확인", textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));

    // 가장 위의 투명 입력면이 아이콘과 문구까지 포함하므로 팝업 안 어느 위치를 눌러도 확인된다.
    body.add(scene.add.rectangle(0, 0, REWARD_POPUP.width, REWARD_POPUP.height, 0xffffff, 0).setInteractive({ useHandCursor: true }).on("pointerup", close));
  });
}
