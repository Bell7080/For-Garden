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
    // 원정 등급도 기존 렐릭 희귀도 토큰을 공유한다. 새 색을 만들지 않아 다른 화면의 SR/SSR과 같은 뜻으로 읽힌다.
    const tone = badge.rarity === "ssr" ? COLOR.raritySSR : COLOR.raritySR;
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
  } else if (glyph === "status") {
    // 떨어지는 물방울을 각지게 — 출혈을 포함한 상태 계열이다.
    graphics.beginPath().moveTo(0, -unit * 1.2).lineTo(unit, unit * 0.4).lineTo(0, unit * 1.1).lineTo(-unit, unit * 0.4).closePath().strokePath();
  } else if (glyph === "heal") {
    // 십자 — 전투 뒤 회복이다.
    graphics.beginPath().moveTo(0, -unit).lineTo(0, unit).moveTo(-unit, 0).lineTo(unit, 0).strokePath();
  } else if (glyph === "spell") {
    // 마름모 속 점은 응축된 주문력을 나타낸다.
    graphics.strokePoints([{ x: 0, y: -unit }, { x: unit, y: 0 }, { x: 0, y: unit }, { x: -unit, y: 0 }], true).fillStyle(0xffffff, 0.96).fillCircle(0, 0, unit * 0.22);
  } else if (glyph === "survival") {
    // 아래가 넓은 갑각은 체력·방어·저항 생존군을 함께 묶는다.
    graphics.beginPath().moveTo(-unit, -unit).lineTo(unit, -unit).lineTo(unit * 0.65, unit).lineTo(-unit * 0.65, unit).closePath().strokePath();
  } else if (glyph === "shield") {
    // 방패의 V형 아래 꼭짓점으로 시작 보호막을 구별한다.
    graphics.beginPath().moveTo(-unit, -unit).lineTo(unit, -unit).lineTo(unit * 0.75, unit * 0.45).lineTo(0, unit).lineTo(-unit * 0.75, unit * 0.45).closePath().strokePath();
  } else {
    // 끊긴 번개는 체력 조건을 만족할 때만 켜지는 효과다.
    graphics.beginPath().moveTo(unit * 0.3, -unit).lineTo(-unit * 0.45, 0).lineTo(unit * 0.1, 0).lineTo(-unit * 0.3, unit).strokePath();
  }
  return graphics;
}
