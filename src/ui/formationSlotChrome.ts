import Phaser from "phaser";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { COLOR } from "./theme";

/**
 * 편성 자리의 겉치레 — 고른 칸과 빼는 표식.
 *
 * 네 화면(스토리·원정·발굴·교류 파견)이 같은 조작을 하므로 같은 것을 보여 준다. 화면마다
 * 제 나름의 테두리와 삭제 버튼을 만들면 같은 손짓이 어디서는 발광, 어디서는 빨간 X가 된다.
 */

/** 고른 칸을 알리는 밑판이 칸보다 넉넉히 커지는 몫. */
const SELECTION_PAD = 26;

/** 빼는 표식 한 변. 칸 모서리 안에 앉을 만큼 작고, 엄지가 닿을 만큼은 크다. */
const REMOVE_CHIP_SIZE = 58;

export interface FormationSlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 고른 칸의 밑판.
 *
 * 칸 자체에 테두리를 두르지 않는다 — 칸 위에는 카드나 SD가 서므로 테두리가 그 뒤로 숨는다.
 * 대신 칸보다 한 뼘 큰 판을 뒤에 깔아 **칸이 판 위에 얹힌 것처럼** 보이게 한다.
 */
export function addFormationSlotSelection(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  box: FormationSlotBox,
  accent: number = COLOR.accent,
): void {
  parent.add(drawLayer(scene, box.x, box.y, slantedRect(box.width + SELECTION_PAD, box.height + SELECTION_PAD), {
    fill: accent,
    alpha: 0.22,
    edge: accent,
    edgeAlpha: 0.95,
  }));
}

/**
 * 고른 칸에서 캐릭터를 빼는 `−` 표식.
 *
 * **고른 칸에 누군가 서 있을 때만 선다.** 칸을 한 번 누르면 고르기만 하고 캐릭터는 그대로
 * 남으므로, 빼는 손이 갈 곳이 눈에 보여야 한다. 같은 칸을 한 번 더 눌러도 같은 결과가 되지만
 * 그건 익히고 나서 쓰는 지름길이고, 표식은 처음 보는 사람을 위한 것이다.
 */
export function addFormationRemoveChip(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  box: FormationSlotBox,
  onRemove: () => void,
  size: number = REMOVE_CHIP_SIZE,
): void {
  // 오른쪽 위 모서리 **안쪽**에 앉힌다. 밖으로 내밀면 붙인 스티커처럼 보이고, 카드 모서리는
  // 대각선으로 깎여 있어 두 변에서 같은 만큼 들어가면 그 빗변을 넘는다.
  const chip = scene.add.container(box.x + box.width / 2 - size * 0.46, box.y - box.height / 2 + size * 0.46);
  chip.add(drawLayer(scene, 0, 0, chipPoints(size, size, {
    bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
  }), { fill: 0x1a0f12, alpha: HOLO.glass, edge: COLOR.danger, edgeAlpha: 0.8 }));
  chip.add(drawGlyph(scene, "remove", 0, 0, size * 0.62, COLOR.danger));
  const hit = scene.add.rectangle(0, 0, size + 16, size + 16, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => chip.setScale(1.12));
  hit.on("pointerout", () => chip.setScale(1));
  hit.on("pointerup", () => { chip.setScale(1); onRemove(); });
  chip.add(hit);
  parent.add(chip);
}
