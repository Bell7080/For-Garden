import Phaser from "phaser";
import type { RelicRarity } from "../core/types";
import { BREAKTHROUGH_GRADE_ROMAN } from "../core/relicProgression";
import { textStyle } from "./theme";
import { RESONANCE_CAP } from "../core/relicResonance";

/**
 * 돌파 등급 표식.
 *
 * 등급은 칸 다섯이 아니라 **로마자 한 글자**다. 칸은 세어야 알 수 있고 카드마다 다섯 개가
 * 반짝여 얼굴보다 먼저 눈에 들어왔다. 로마자는 한 글자라 자리를 적게 먹고, 크기와 색만으로
 * 위계가 읽힌다.
 *
 * 여기서 세는 것은 **희귀도가 아니라 한계 돌파 단계**다. 모든 개체가 표식 없이(돌파 0) 시작해 중복
 * 발굴로 모은 파편으로 돌파할 때마다 하나씩 올라 `IV`에서 멈춘다. 희귀도는 카드 바탕색
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
  // 돌파 0(한 번도 뚫지 않음)은 표식이 없다 — 얻자마자 「I」가 서면 뚫지 않은 개체가 1돌로 읽혔다(응태 2026-11-22).
  const grade = Math.min(BREAKTHROUGH_GRADE_ROMAN.length, Math.round(breakthroughGrade));
  if (!(grade >= 1)) return;
  paintRomanMark(scene, parent, x, y, size, BREAKTHROUGH_GRADE_ROMAN[grade - 1], GRADE_MARK_TONE);
}

/**
 * 공명 표식의 색 — 돌파 표식(호박)과 갈리는 **붉은** 로마자다. 같은 글자 양식이라 한 덩어리로 읽히고, 색이 축을 가른다.
 *
 * **글자 자체가 진한 다홍이다**(응태 2026-11-13). 글자를 연분홍(`#ffe1db`)으로 두고 붉은 빛무리만 두르던 때는
 * 밝은 글자가 빛보다 먼저 읽혀 붉은 표식인지 알기 어려웠다. 빛무리도 한 톤 어둡고 옅게 눌러 형광기를 덜고,
 * 색이 글자에서 먼저 읽히게 한다.
 */
export const RESONANCE_MARK_TONE = { ink: "#ff3a2c", halo: "#c8100c", haloAlpha: [0.12, 0.26], frame: 0xd81e16 } as const;

/** 로마자 한 글자를 각진 계단 그림자 + 발광 두 겹으로 박는다. 돌파·공명 표식이 같은 양식을 쓴다. */
function paintRomanMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, numeral: string, tone: { ink: string; halo: string; haloAlpha?: readonly [number, number] }): void {
  const put = (dx: number, dy: number, color: string, alpha: number, scale: number): void => {
    parent.add(scene.add.text(x + dx, y + dy, numeral, textStyle({ role: "display", size, color })).setOrigin(0.5, 0.5).setAlpha(alpha).setScale(scale, scale * 1.1));
  };
  const step = Math.max(2, size * 0.06);
  for (let i = 3; i >= 1; i -= 1) put(step * i, step * i, "#05070a", 0.6, 1);
  const [outer, inner] = tone.haloAlpha ?? [0.16, 0.3];
  put(0, 0, tone.halo, outer, 1.6);
  put(0, 0, tone.halo, inner, 1.24);
  put(0, 0, tone.ink, 1, 1);
}

/**
 * 공명 단계 글자 한 장 — **붉은 로마자**(`I`~`V`)다. 원점은 글자의 한가운데다.
 *
 * 「공명 1」처럼 낱말과 숫자로 적지 않는다(응태 결정, 2026-11-12). 돌파 등급과 같은 로마자 양식에 색만 붉게 바꿔,
 * 같은 줄에 서도 어느 쪽이 돌파이고 어느 쪽이 공명인지 색으로 갈린다. 확정 창의 「n ▶ n+1」도 이 글자를 쓴다.
 */
export function addResonanceGradeMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, resonance: number): void {
  const numeral = BREAKTHROUGH_GRADE_ROMAN[Math.max(1, Math.min(BREAKTHROUGH_GRADE_ROMAN.length, Math.round(resonance))) - 1];
  paintRomanMark(scene, parent, x, y, size, numeral, RESONANCE_MARK_TONE);
}

/**
 * 성장 등급 표식 한 글자 — **공명이 걸리면 돌파 등급 자리를 공명 등급이 대신한다**(응태 결정 2026-11-22).
 *
 * 공명은 돌파 IV 다음 칸이라 공명 I부터는 호박 `IV` 대신 그 자리에 붉은 로마자(`I`~`V`)가 선다 — 두 글자를 위아래로
 * 겹쳐 세우던 때는 작은 카드에서 무엇이 지금 등급인지 갈리지 않았다. 색이 축을 말하므로 붉으면 곧 돌파 IV를 마친
 * 개체다. 공명 V면 그 글자 둘레에 붉은 두 겹 테가 둘러 「끝까지 키운 개체」를 말한다. 공명이 0이면 돌파 표식 그대로다.
 * 공명을 알 수 없는 자리(적·공개 프로필)는 `resonance`를 넘기지 않는다.
 */
export function addGrowthGradeMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  breakthroughGrade: number,
  resonance = 0,
): void {
  const shown = Math.min(RESONANCE_CAP, Math.max(0, Math.round(resonance)));
  if (!(shown >= 1)) {
    addBreakthroughGradeMark(scene, parent, x, y, size, breakthroughGrade);
    return;
  }
  addResonanceGradeMark(scene, parent, x, y, size, shown);
  if (shown < RESONANCE_CAP) return;
  // 공명 V — 글자를 두 겹으로 감싸는 붉은 테. 판·칩과 같이 왼쪽 위·오른쪽 아래만 깎는다.
  const g = scene.add.graphics();
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
  parent.addAt(g, 0);
}
