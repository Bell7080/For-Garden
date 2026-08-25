import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline, HOLO } from "./holo";
import type { CurrencyIconKey } from "./currencyIcons";
import { COLOR, textStyle } from "./theme";

/** 누적량 액자와 생산량 칩을 한 덩어리로 소유하는 발굴 전용 프리팹이다. */
export class ExcavationCurrencyFrame extends Phaser.GameObjects.Container {
  private readonly amountText: Phaser.GameObjects.Text;
  private readonly rateText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, iconKey: CurrencyIconKey, width = 172) {
    super(scene, x, y);
    scene.add.existing(this);
    const frame = chipPoints(width, 116, { bevel: { topLeft: 22, bottomRight: 18 } });
    // 원화와 분리되되 끊어진 판처럼 보이지 않도록 액자 예외의 외곽선 안을 반투명 유리로 채운다.
    this.add(drawLayer(scene, 0, -26, frame, { fill: COLOR.panel, alpha: HOLO.glass, shadow: true }));
    this.add(drawShapeOutline(scene, 0, -26, frame, { color: COLOR.accent, alpha: 0.72, width: 3 }));
    this.add(drawInnerVignette(scene, 0, -26, frame, { strength: 0.52 }));
    this.add(scene.add.image(-34, -27, iconKey).setDisplaySize(64, 64));
    // 아이콘과 굵은 수를 일부 겹쳐 한 개의 보상 표식으로 읽히게 하고 짧고 선명한 그림자를 둔다.
    this.amountText = scene.add.text(20, -25, "0", textStyle({ role: "display", size: 30, color: COLOR.ink }))
      .setOrigin(0.5).setShadow(3, 4, "#000000", 1, false, true);
    this.add(this.amountText);
    const rateChip = chipPoints(width - 20, 42, { bevel: { topLeft: 12, bottomRight: 10 } });
    this.add(drawLayer(scene, 0, 67, rateChip, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.35 }));
    this.add(scene.add.image(-38, 67, iconKey).setDisplaySize(28, 28));
    this.rateText = scene.add.text(10, 67, "0/시간", textStyle({ role: "emphasis", size: 18, color: COLOR.accentText })).setOrigin(0.5);
    this.add(this.rateText);
  }

  /** 틱에서는 프리팹을 재생성하지 않고 두 숫자 텍스처만 갱신한다. */
  setValues(amount: number, rate: number): void {
    this.amountText.setText(formatCurrency(Math.floor(amount)));
    this.rateText.setText(`${formatCurrency(Math.floor(rate))}/시간`);
  }
}
