import Phaser from "phaser";
import { BATTLE_PAUSE_BUTTON as L } from "./battleStatusLayout";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR } from "./theme";

/**
 * 전투 오른쪽 위의 일시 정지 버튼.
 *
 * 전투 조작 칩(`ControlChip`)과 같은 판(어두운 유리 + 윗변 강조선 + 어긋나게 깎은 모서리)을 정사각으로
 * 줄여 쓴다. 칩과 달리 켜고 끄는 상태가 없어 빛이 도는 결은 두지 않는다.
 */
export class BattlePauseButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, onClick: () => void) {
    super(scene, L.x, L.y);
    const size = L.size;
    const shape = chipPoints(size, size, { bevel: { topLeft: 6, topRight: 18, bottomRight: 6, bottomLeft: 14 } });
    const face = drawLayer(scene, 0, 0, shape, { fill: 0x161c26, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.4, shadow: { x: 4, y: 6 } });
    const icon = drawGlyph(scene, "pause", 0, 0, size * 0.46, COLOR.inkHex);
    const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this));
    hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(this); onClick(); });
    this.add([face, icon, hit]);
    this.setSize(size, size).setDepth(L.depth);
    scene.add.existing(this);
  }
}
