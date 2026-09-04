import Phaser from "phaser";
import type { AugmentBadgeGlyph, AugmentBadgeView } from "./expeditionAugmentBadges";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { COLOR } from "./theme";

/**
 * 원정 증강 하나가 화면에 서는 작은 액자.
 *
 * 전투 버프 칩과 **같은 액자 규칙**(깎인 네모 + 사방 외곽선 + 안쪽 비네트)을 더 작게 줄여 쓴다.
 * 두 표식이 다른 모양이면 같은 프로필 위에서 서로 다른 체계로 읽힌다. 안에는 글자를 넣지 않는다 —
 * 40px에 이름을 적으면 무엇이든 뭉개지고, 이름과 수치는 눌러서 여는 목록이 이미 말한다.
 */
export class ExpeditionAugmentChip extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, badge: AugmentBadgeView, size: number) {
    super(scene, x, y);
    scene.add.existing(this);
    // 고급은 출격 주황, 일반은 강조색이다. 등급을 색 하나로만 갈라 크기는 건드리지 않는다 —
    // 크기가 다르면 줄에 선 표식들이 서로 다른 종류처럼 보인다.
    const tone = badge.rarity === "advanced" ? COLOR.sortie : COLOR.accent;
    const shape = chipPoints(size, size, { bevel: { topLeft: size * 0.22, topRight: 0, bottomRight: size * 0.22, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: tone, alpha: 0.34 }));
    this.add(drawGlyph(scene, badge.glyph, size));
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.55 }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: tone, alpha: 0.92, width: 2 }));
  }
}

/**
 * 효과 종류를 각진 문양 하나로 그린다.
 *
 * 아이콘 파일을 두지 않는 이유는 증강이 운영 중 늘어나는 값이고, 늘어날 때마다 그림을 굽는
 * 대신 **효과 종류 셋**만 구별하면 되기 때문이다. 둥근 끝을 쓰지 않고 각지게 맞춘다.
 */
function drawGlyph(scene: Phaser.Scene, glyph: AugmentBadgeGlyph, size: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const unit = size * 0.24;
  graphics.lineStyle(Math.max(2, size * 0.07), 0xffffff, 0.96);
  if (glyph === "attack") {
    // 위로 뻗는 화살촉 — 공격력이 오른다.
    graphics.beginPath().moveTo(-unit, unit).lineTo(unit, -unit).moveTo(0, -unit).lineTo(unit, -unit).lineTo(unit, 0).strokePath();
  } else if (glyph === "bleed") {
    // 떨어지는 물방울을 각지게 — 지속 피해다.
    graphics.beginPath().moveTo(0, -unit * 1.2).lineTo(unit, unit * 0.4).lineTo(0, unit * 1.1).lineTo(-unit, unit * 0.4).closePath().strokePath();
  } else {
    // 십자 — 전투 뒤 회복이다.
    graphics.beginPath().moveTo(0, -unit).lineTo(0, unit).moveTo(-unit, 0).lineTo(unit, 0).strokePath();
  }
  return graphics;
}
