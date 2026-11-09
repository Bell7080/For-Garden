import Phaser from "phaser";
import type { RelicRarity } from "../core/types";
import { BREAKTHROUGH_GRADE_ROMAN } from "../core/relicProgression";
import { textStyle } from "./theme";

/**
 * 돌파 등급 표식.
 *
 * 등급은 칸 다섯이 아니라 **로마자 한 글자**다. 칸은 세어야 알 수 있고 카드마다 다섯 개가
 * 반짝여 얼굴보다 먼저 눈에 들어왔다. 로마자는 한 글자라 자리를 적게 먹고, 크기와 색만으로
 * 위계가 읽힌다.
 *
 * 여기서 세는 것은 **희귀도가 아니라 한계 돌파 단계**다. 모든 개체가 `I`로 시작해 중복
 * 발굴로 모은 파편으로 돌파할 때마다 하나씩 올라 `V`에서 멈춘다. 희귀도는 카드 바탕색
 * (`RARITY_TONE`)이 맡는다 — 둘은 서로 다른 축이라 같은 자리에서 겹쳐 말하지 않는다.
 */
export { BREAKTHROUGH_GRADE_ROMAN };

/** 표식의 색 한 벌. 희귀도색과 섞이지 않게 어느 개체에서나 같은 호박색으로 박힌다. */
const GRADE_MARK_TONE = { ink: "#fff3c4", halo: "#f5a623" } as const;

/** 등급 한 벌의 색. `chip`은 카드 바탕, `ink`는 표식 몸통, `halo`는 그 뒤의 발광이다. */
export interface RarityTone {
  chip: number;
  ink: string;
  halo: string;
}

/**
 * 카드 바탕색은 **밝게** 잡는다.
 *
 * 어둡게 누르면 세 등급이 다 같은 잿빛 판으로 보이고, 원화가 칩을 거의 채우므로 가장자리에
 * 남는 한 줄로는 등급이 읽히지 않는다. SR과 R이 같은 남보라 계열이던 것도 함께 벌린다 —
 * SR은 분홍에 가까운 보라, R은 하늘빛이다(룬 등급색과 같은 결).
 */
export const RARITY_TONE: Record<RelicRarity, RarityTone> = {
  SSR: { chip: 0xc78a1c, ink: "#fff3c4", halo: "#ffc247" },
  SR: { chip: 0xa749c9, ink: "#ffe2ff", halo: "#e070f5" },
  R: { chip: 0x2f9ad4, ink: "#e8fbff", halo: "#5fd4ff" },
};

/**
 * 로마자 등급 한 글자를 그린다. 원점은 글자의 한가운데다.
 *
 * 그림자는 흐리게 번지지 않고 **각지게 계단으로** 진다 — 화면의 다른 면이 모두 각져 있고,
 * 밝은 원화 위에서도 획이 뭉개지지 않기 때문이다. 그 위로 같은 색 발광 두 겹을 깔아
 * 글자가 카드에서 떠 보이게 한다.
 */
export function addBreakthroughGradeMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  breakthroughGrade: number,
): void {
  const numeral = BREAKTHROUGH_GRADE_ROMAN[Math.max(1, Math.min(BREAKTHROUGH_GRADE_ROMAN.length, Math.round(breakthroughGrade))) - 1];
  const put = (dx: number, dy: number, color: string, alpha: number, scale: number): void => {
    const mark = scene.add
      .text(x + dx, y + dy, numeral, textStyle({ role: "display", size, color }))
      .setOrigin(0.5, 0.5)
      .setAlpha(alpha)
      // 세로로 살짝 늘려야 로마자가 비석 글씨처럼 곧게 선다.
      .setScale(scale, scale * 1.1);
    parent.add(mark);
  };
  const step = Math.max(2, size * 0.06);
  for (let i = 3; i >= 1; i -= 1) put(step * i, step * i, "#05070a", 0.6, 1);
  put(0, 0, GRADE_MARK_TONE.halo, 0.16, 1.6);
  put(0, 0, GRADE_MARK_TONE.halo, 0.3, 1.24);
  put(0, 0, GRADE_MARK_TONE.ink, 1, 1);
}

/** 공명 표식의 색 — 돌파 표식과 같은 호박색 계열이라 한 덩어리로 읽힌다. */
const RESONANCE_MARK_TONE = { on: 0xffc247, off: 0x05070a, edge: 0xfff3c4, frame: 0xf5a623 } as const;

/**
 * 공명 표식 — 돌파 등급 글자 **아래**의 작은 마름모 다섯과, 공명 V의 금빛 두 겹 테두리.
 *
 * 공명은 돌파 V 다음의 축이라 새 글자를 세우지 않고 같은 표식에 붙는다. 마름모는 채운 것이
 * 지금 공명 단계이고, 다섯이 다 차면 글자 둘레에 금빛 테가 두 겹 둘러 「끝까지 키운 개체」를
 * 말한다. 공명이 0이면 아무것도 그리지 않는다(돌파 중인 개체에 빈 칸 다섯이 서면 할 일처럼 읽힌다).
 */
export function addResonanceMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  resonance: number,
  cap: number,
): void {
  if (resonance <= 0) return;
  const g = scene.add.graphics();
  const dot = Math.max(5, size * 0.11);
  const gap = dot * 2.6;
  const rowY = y + size * 0.92;
  for (let i = 0; i < cap; i += 1) {
    const cx = x + (i - (cap - 1) / 2) * gap;
    const points = [new Phaser.Math.Vector2(cx, rowY - dot), new Phaser.Math.Vector2(cx + dot * 0.8, rowY), new Phaser.Math.Vector2(cx, rowY + dot), new Phaser.Math.Vector2(cx - dot * 0.8, rowY)];
    const on = i < resonance;
    g.fillStyle(on ? RESONANCE_MARK_TONE.on : RESONANCE_MARK_TONE.off, on ? 1 : 0.55);
    g.fillPoints(points, true);
    g.lineStyle(2, on ? RESONANCE_MARK_TONE.edge : RESONANCE_MARK_TONE.frame, on ? 0.9 : 0.5);
    g.strokePoints(points, true);
  }
  if (resonance >= cap) {
    // 공명 V — 글자를 두 겹으로 감싸는 금빛 테. 판·칩과 같이 왼쪽 위·오른쪽 아래만 깎는다.
    for (const [grow, alpha, width] of [[0, 1, 3], [size * 0.12, 0.5, 2]] as const) {
      const hw = size * 0.56 + grow;
      const hh = size * 0.66 + grow;
      const cut = size * 0.22;
      g.lineStyle(width, RESONANCE_MARK_TONE.frame, alpha);
      g.strokePoints([
        new Phaser.Math.Vector2(x - hw + cut, y - hh), new Phaser.Math.Vector2(x + hw, y - hh),
        new Phaser.Math.Vector2(x + hw, y + hh - cut), new Phaser.Math.Vector2(x + hw - cut, y + hh),
        new Phaser.Math.Vector2(x - hw, y + hh), new Phaser.Math.Vector2(x - hw, y - hh + cut),
      ], true);
    }
  }
  parent.addAt(g, 0);
}
