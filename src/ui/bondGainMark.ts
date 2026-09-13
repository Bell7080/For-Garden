import Phaser from "phaser";
import { t } from "../i18n";
import { drawGlyph } from "./glyphs";
import { COLOR, textStyle } from "./theme";

/**
 * 상호작용으로 오른 유대 — **대사창이 아니라 그 옆에서 떠오르는 표식이다.**
 *
 * 예전에는 대사 뒤에 줄을 바꿔 `\n유대 EXP +12 · LEVEL UP +1`을 이어 붙였다. 캐릭터가 한 말과
 * 시스템이 준 보상이 한 문단에 섞여, 띠가 두 줄만큼 두꺼워지고 대사가 영수증처럼 읽혔다.
 * 지금은 대사는 대사대로 서고, 오른 몫은 피해 수치와 같은 문법으로 **위로 떠오르며 사라지는**
 * 작은 표식이 맡는다 — 읽지 않아도 무엇이 올랐는지 색과 그림이 말한다.
 */
export const BOND_GAIN = {
  /** 하트 지름과 수 사이의 틈. 아이콘과 수는 바짝 붙인다 — 멀면 두 정보로 읽힌다. */
  heart: 30,
  gap: 8,
  size: 27,
  /** 떠오르는 거리와 시간. 피해 수치처럼 멀리 떠올라 또렷해졌다 사라진다. */
  rise: 64,
  riseMs: 1150,
  fadeMs: 420,
  /** 레벨이 올랐을 때만 그 위에 한 줄 더 선다. */
  levelSize: 30,
  levelLift: 46,
} as const;

/** 유대가 오른 결과 한 벌. 오르지 않았으면 아무것도 세우지 않는다. */
export interface BondGain { xp: number; levels: number }

/**
 * `x`·`y`를 가운데로 삼아 표식 한 벌을 띄운다.
 *
 * 레벨이 오른 판은 그 위에 한 줄을 더 얹고 조금 더 오래 머문다 — 몇 번에 한 번뿐인 사건이라
 * 경험치와 같은 무게로 지나가면 올랐다는 것을 놓친다.
 */
export function showBondGain(scene: Phaser.Scene, x: number, y: number, gain: BondGain, depth = 520): void {
  if (gain.xp <= 0 && gain.levels <= 0) return;
  const layer = scene.add.container(x, y).setDepth(depth);

  if (gain.xp > 0) {
    const label = scene.add
      .text(0, 0, t("lobby.bondXp", { xp: gain.xp }), textStyle({ role: "emphasis", size: BOND_GAIN.size, color: COLOR.bondText }))
      .setOrigin(0, 0.5);
    // 하트와 수를 한 덩어리로 재서 가운데에 놓는다. 글자 폭은 언어가 정하므로 미리 적지 않는다.
    const total = BOND_GAIN.heart + BOND_GAIN.gap + label.width;
    const left = -total / 2;
    layer.add(drawGlyph(scene, "heart", left + BOND_GAIN.heart / 2, 0, BOND_GAIN.heart, COLOR.bond, 0.95));
    label.setX(left + BOND_GAIN.heart + BOND_GAIN.gap);
    layer.add(label);
  }

  if (gain.levels > 0) {
    layer.add(scene.add
      .text(0, -BOND_GAIN.levelLift, t("lobby.bondLevelUp", { levels: gain.levels }), textStyle({ role: "display", size: BOND_GAIN.levelSize, color: COLOR.accentText }))
      .setOrigin(0.5));
  }

  layer.setAlpha(0);
  scene.tweens.add({ targets: layer, alpha: 1, duration: 160 });
  scene.tweens.add({
    targets: layer, y: y - BOND_GAIN.rise,
    duration: BOND_GAIN.riseMs, ease: "Sine.easeOut",
  });
  scene.tweens.add({
    targets: layer, alpha: 0,
    delay: BOND_GAIN.riseMs - BOND_GAIN.fadeMs + (gain.levels > 0 ? 420 : 0),
    duration: BOND_GAIN.fadeMs,
    onComplete: () => layer.destroy(),
  });
}
