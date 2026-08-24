import Phaser from "phaser";
import type { RelicRarity } from "../core/types";
import { textStyle } from "./theme";

/**
 * 별 표식.
 *
 * 별은 다섯 칸이 아니라 **로마자 한 글자**다. 칸은 세어야 알 수 있고 카드마다 다섯 개가
 * 반짝여 얼굴보다 먼저 눈에 들어왔다. 로마자는 한 글자라 자리를 적게 먹고, 크기와 색만으로
 * 위계가 읽힌다.
 *
 * 여기서 세는 별은 **희귀도가 아니라 한계 돌파 단계**다. 모든 개체가 `I`로 시작해 중복
 * 발굴로 모은 파편으로 돌파할 때마다 하나씩 올라 `V`에서 멈춘다. 희귀도는 카드 바탕색
 * (`RARITY_TONE`)이 맡는다 — 둘은 서로 다른 축이라 같은 자리에서 겹쳐 말하지 않는다.
 */
export const STAR_ROMAN: readonly string[] = ["I", "II", "III", "IV", "V"];

/** 별의 색 한 벌. 등급색과 섞이지 않게 어느 개체에서나 같은 호박색으로 박힌다. */
const STAR_TONE = { ink: "#fff3c4", halo: "#f5a623" } as const;

/** 등급 한 벌의 색. `chip`은 카드 바탕, `ink`는 표식 몸통, `halo`는 그 뒤의 발광이다. */
export interface RarityTone {
  chip: number;
  ink: string;
  halo: string;
}

export const RARITY_TONE: Record<RelicRarity, RarityTone> = {
  SSR: { chip: 0x6b4a12, ink: "#ffeaa8", halo: "#f5a623" },
  SR: { chip: 0x452a63, ink: "#f0d6ff", halo: "#c07cff" },
  R: { chip: 0x1b4a70, ink: "#d9f3ff", halo: "#63c4f2" },
};

/**
 * 로마자 별 한 글자를 그린다. 원점은 글자의 한가운데다.
 *
 * 그림자는 흐리게 번지지 않고 **각지게 계단으로** 진다 — 화면의 다른 면이 모두 각져 있고,
 * 밝은 원화 위에서도 획이 뭉개지지 않기 때문이다. 그 위로 같은 색 발광 두 겹을 깔아
 * 글자가 카드에서 떠 보이게 한다.
 */
export function addStarMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  stars: number,
): void {
  const numeral = STAR_ROMAN[Math.max(1, Math.min(STAR_ROMAN.length, Math.round(stars))) - 1];
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
  put(0, 0, STAR_TONE.halo, 0.16, 1.6);
  put(0, 0, STAR_TONE.halo, 0.3, 1.24);
  put(0, 0, STAR_TONE.ink, 1, 1);
}
