import Phaser from "phaser";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { FORMATION_SLOT_PLATE } from "./formationSlotStyle";
import { COLOR, textStyle } from "./theme";

/**
 * 편성 자리의 겉치레 — 고른 칸과 빼는 표식.
 *
 * 네 화면(스토리·원정·발굴·교류 파견)이 같은 조작을 하므로 같은 것을 보여 준다. 화면마다
 * 제 나름의 테두리와 삭제 버튼을 만들면 같은 손짓이 어디서는 발광, 어디서는 빨간 X가 된다.
 *
 * **층 순서는 밑판 → SD → 표식이다.** 밑판을 SD 위에 깔면 고른 칸의 캐릭터만 반투명한 판에
 * 덮여 다른 칸보다 흐리게 보인다 — 고른 자리가 오히려 잘 안 보이는 셈이다. 반대로 표식은
 * SD보다 앞에 서야 머리에 가리지 않는다. 그래서 부르는 쪽이 두 층을 나눠 넘긴다.
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

export interface FormationSlotPlateOptions {
  /** 이 콘텐츠의 강조색. 발밑 그림자가 그 색을 옅게 쓴다. */
  accent?: number;
  /** 이 칸에 누군가 서 있는가. */
  occupied: boolean;
  /** 자리 번호(0부터). 빈 칸이 이 수를 적는다. */
  index: number;
  /** 판 중심에서 SD가 발을 딛는 줄까지의 거리. */
  groundOffset: number;
}

/** 칸 하나의 밑판과 그 위의 발밑 그림자(또는 빈 자리 번호)를 그린다. */
export function addFormationSlotPlate(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  box: FormationSlotBox,
  options: FormationSlotPlateOptions,
): void {
  parent.add(drawLayer(scene, box.x, box.y, slantedRect(box.width, box.height), {
    fill: COLOR.panel,
    alpha: HOLO.glassLight,
    edge: COLOR.inkDimHex,
    edgeAlpha: FORMATION_SLOT_PLATE.edgeAlpha,
  }));
  if (options.occupied) {
    // 사방 테두리나 입체 받침 대신 얇은 홀로그램 투영 그림자만 발 아래에 둔다.
    parent.add(scene.add.ellipse(
      box.x,
      box.y + options.groundOffset + 2,
      box.width * FORMATION_SLOT_PLATE.groundWidthRatio,
      FORMATION_SLOT_PLATE.groundHeight,
      options.accent ?? COLOR.accent,
      FORMATION_SLOT_PLATE.groundAlpha,
    ));
    return;
  }
  const style = textStyle({ role: "emphasis", size: FORMATION_SLOT_PLATE.emptyFontSize, color: COLOR.inkDim, align: "center" });
  parent.add(scene.add.text(box.x, box.y, `빈 슬롯\n${options.index + 1}`, style).setOrigin(0.5));
}
