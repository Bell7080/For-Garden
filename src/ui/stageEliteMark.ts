import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";
import { t } from "../i18n";

/**
 * 단일 정예 관문의 **표식**.
 *
 * 원정 지도는 노드 종류를 이름으로 말하지만(「정예 조우」) 스토리 지도의 노드에는 그 자리가
 * 없다 — 관문 이름이 이미 장소를 말하고 있어서다. 그래서 정예임을 아는 자리는 **적이 서 있는
 * 줄**이고, 거기에 이름표 하나가 선다.
 *
 * 판때기를 받치지 않는다. 이름줄(`addUnitNameplate`)과 같은 규칙으로 강조색 글자에 검은 획과
 * 그림자만 둘러, 밝은 배경 원화 위에서도 글자 자신이 제 배경을 갖는다.
 */
export function addStageEliteMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Text {
  const mark = scene.add
    .text(x, y, t("stage.eliteMark"), textStyle({ role: "display", size, color: COLOR.dangerText }))
    .setOrigin(0.5, 1)
    .setStroke("#05070a", 4)
    .setShadow(0, 2, "#05070a", 3, true, true);
  parent?.add(mark);
  return mark;
}
