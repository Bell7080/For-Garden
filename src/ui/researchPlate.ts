import Phaser from "phaser";
import { chipPoints, drawLayer, drawShapeEdge, HOLO } from "./holo";
import { researchPlateBevel } from "./researchBenchLayout";
import { COLOR } from "./theme";

/**
 * 특성 연구대·합성대·확률 판이 함께 쓰는 판 한 장.
 *
 * 유리면 한 겹에 **윗변 강조선과 밑변 한 줄**, 그리고 덜 깎인 두 모서리(오른쪽 위·왼쪽 아래)의 바깥에
 * 투영 장비의 **모서리 표식**을 단다. 표식이 없던 때는 판이 배경 원화 위에 놓인 어두운 사각형으로만
 * 읽혀 「장비의 한 칸」이라는 말을 하지 못했다. 사방 외곽선은 두르지 않는다(판때기 규칙) — 표식은
 * 모서리에만 짧게 서서 판의 실루엣을 잡아 줄 뿐이다.
 *
 * 두 탭(특성 연구·룬 합성)이 같은 함수를 지나 한 장비의 두 자리로 읽힌다.
 */
export const RESEARCH_PLATE = {
  fill: 0x111b24,
  /** 모서리 표식 한 팔의 길이·굵기·판에서 떨어진 거리. */
  bracketArm: 34,
  bracketWidth: 4,
  bracketGap: 8,
  bracketAlpha: 0.75,
} as const;

export function addResearchPlate(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  bounds: { left: number; right: number; top: number; bottom: number },
): void {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const bevel = researchPlateBevel(width);
  const shape = chipPoints(width, height, { bevel });
  const x = (bounds.left + bounds.right) / 2;
  const y = (bounds.top + bounds.bottom) / 2;
  parent.add(drawLayer(scene, x, y, shape, { fill: RESEARCH_PLATE.fill, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
  // 밑변 안쪽으로 한 줄. 깎인 모서리를 그대로 돌아 판이 바닥에서 떠 있는 것으로 읽힌다.
  parent.add(drawShapeEdge(scene, x, y, shape, "bottom", { color: COLOR.accent, alpha: 0.2, inset: 10 }));

  const P = RESEARCH_PLATE;
  const g = scene.add.graphics();
  g.lineStyle(P.bracketWidth, COLOR.accent, P.bracketAlpha);
  // 오른쪽 위 — 덜 깎인 모서리를 바깥에서 감싼다.
  const rx = bounds.right + P.bracketGap;
  const ty = bounds.top - P.bracketGap;
  g.strokePoints([
    new Phaser.Geom.Point(rx - bevel.topRight - P.bracketArm, ty),
    new Phaser.Geom.Point(rx - bevel.topRight, ty),
    new Phaser.Geom.Point(rx, ty + bevel.topRight),
    new Phaser.Geom.Point(rx, ty + bevel.topRight + P.bracketArm),
  ], false);
  // 왼쪽 아래 — 마주 보는 모서리.
  const lx = bounds.left - P.bracketGap;
  const by = bounds.bottom + P.bracketGap;
  g.strokePoints([
    new Phaser.Geom.Point(lx + bevel.bottomLeft + P.bracketArm, by),
    new Phaser.Geom.Point(lx + bevel.bottomLeft, by),
    new Phaser.Geom.Point(lx, by - bevel.bottomLeft),
    new Phaser.Geom.Point(lx, by - bevel.bottomLeft - P.bracketArm),
  ], false);
  parent.add(g);
}
