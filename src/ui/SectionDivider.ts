import Phaser from "phaser";
import { drawHairline } from "./holo";
import { COLOR } from "./theme";

/** 공용 구분선의 기본 치수. 중앙 표식과 선 사이에는 숨 쉴 틈을 남긴다. */
const MARK_OUTER_RADIUS = 10;
const MARK_INNER_RADIUS = 6;
const MARK_GAP = 14;

/**
 * 얇은 금색 선 사이에 홀로그램 마름모를 세우는 공용 섹션 구분 요소다.
 *
 * 선과 표식을 컨테이너 하나에 묶어, 목록을 다시 조립할 때 장식 일부만 화면에 남지 않게 한다.
 */
export class SectionDivider extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);

    // 중앙 표식 자리를 비운 두 hairline이 기존 홀로그램 화면의 얇은 경계선과 같은 결을 만든다.
    const halfLineWidth = Math.max(0, (width / 2 - MARK_OUTER_RADIUS - MARK_GAP));
    const lineOffset = MARK_OUTER_RADIUS + MARK_GAP + halfLineWidth / 2;
    const leftLine = drawHairline(scene, -lineOffset, 0, halfLineWidth, { color: COLOR.accent, alpha: 0.5 });
    const rightLine = drawHairline(scene, lineOffset, 0, halfLineWidth, { color: COLOR.accent, alpha: 0.5 });

    // 로딩 칸과 같은 네 꼭짓점 Star를 축소해 공용 홀로그램 마름모 문법을 재사용한다.
    const mark = scene.add
      .star(0, 0, 4, MARK_INNER_RADIUS, MARK_OUTER_RADIUS, COLOR.accent, 0.2)
      .setStrokeStyle(2, COLOR.accent, 0.85);
    this.add([leftLine, rightLine, mark]);
    scene.add.existing(this);
  }
}
