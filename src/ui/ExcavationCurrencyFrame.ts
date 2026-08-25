import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { CurrencyIconKey } from "./currencyIcons";
import { COLOR, textStyle } from "./theme";

/** 액자 한 칸의 규격. 보상 팝업의 액자와 같은 실루엣·같은 외곽선을 쓴다. */
const FRAME = { size: 128, icon: 100, bevel: 28 } as const;

/**
 * 발굴 현황의 재화 한 칸.
 *
 * 수확 팝업의 액자와 같은 모양이어야 "지금 쌓인 것"과 "방금 받은 것"이 한 계열로 읽힌다.
 * 그래서 그림 한 장을 담는 칸이라는 액자 예외(불투명 면 + 사방 외곽선 + 안쪽 비네트)를
 * 그대로 쓰고, 누적량은 액자 **오른쪽 아래**에 검은 테두리를 두른 굵은 수로 얹는다.
 * 시간당 생산량은 그 아래 한 줄에 시간 단위를 H·D 약자로만 적는다.
 */
export class ExcavationCurrencyFrame extends Phaser.GameObjects.Container {
  private readonly amountText: Phaser.GameObjects.Text;
  private readonly rateText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, iconKey: CurrencyIconKey) {
    super(scene, x, y);
    scene.add.existing(this);
    const frame = chipPoints(FRAME.size, FRAME.size, {
      bevel: { topLeft: FRAME.bevel, topRight: 0, bottomRight: FRAME.bevel, bottomLeft: 0 },
    });
    this.add(drawLayer(scene, 0, -18, frame, { fill: 0x101722, alpha: 0.98 }));
    this.add(scene.add.image(0, -18, iconKey).setDisplaySize(FRAME.icon, FRAME.icon));
    this.add(drawInnerVignette(scene, 0, -18, frame, { strength: 0.62 }));
    this.add(drawShapeOutline(scene, 0, -18, frame, { color: COLOR.accent, alpha: 0.82, width: 3 }));
    // 수는 액자 선 위에 걸치므로 검은 테두리로 한 겹 떼어 놓는다. 그림자만으로는 선과 붙어 읽힌다.
    this.amountText = scene.add.text(FRAME.size / 2 - 9, -18 + FRAME.size / 2 - 7, "0", textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(1, 1);
    this.amountText.setStroke("#000000", 6);
    this.amountText.setShadow(2, 3, "#000000", 2, false, true);
    this.add(this.amountText);
    this.rateText = scene.add.text(0, 68, "0/H", textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0.5);
    this.rateText.setShadow(0, 2, "#000000", 3, false, true);
    this.add(this.rateText);
  }

  /** 틱에서는 프리팹을 재생성하지 않고 두 숫자 텍스처만 갱신한다. */
  setValues(amount: number, rate: number): void {
    this.amountText.setText(formatCurrency(Math.floor(amount)));
    this.rateText.setText(formatRate(rate));
  }
}

/**
 * 시간당 생산량 한 줄.
 *
 * 시간당 1개도 못 채우는 느린 재화까지 `0/H`로 적으면 생산이 멈춘 것처럼 읽히므로,
 * 그런 값만 하루 단위(`/D`)로 바꿔 같은 한 줄 안에서 숫자가 살아 있게 한다.
 */
export function formatRate(rate: number): string {
  if (rate >= 1) return `${formatCurrency(Math.floor(rate))}/H`;
  if (rate > 0) return `${formatCurrency(Math.max(1, Math.floor(rate * 24)))}/D`;
  return "0/H";
}
