import Phaser from "phaser";

/**
 * 성급 별.
 *
 * 도감 카드·정보창·결과 화면이 같은 별을 쓴다. 화면마다 겹 수와 색을 다시 정하면 같은 등급이
 * 어디서는 화려하고 어디서는 밋밋해 보이므로, 모양과 색은 여기 한 곳에서만 정하고 화면은
 * 크기만 고른다.
 *
 * 찬 별은 겹으로 화려하게 만든다 — 뒤로 지는 그림자, 넓게 번지는 빛무리 두 겹, 몸통 하나.
 * 겹마다 색을 바꾸지 않고 호박(amber) 한 계열의 밝기와 투명도만 달리해, 같은 빛에서 나온
 * 것처럼 보이게 한다. 안쪽에 작은 별을 하나 더 얹으면 "별 안의 별"이 되어 오히려 지저분하다.
 */
export const STAR = {
  /** 별 하나의 바깥 반지름 대비 안쪽 반지름 비율. 5각별이 뾰족해 보이는 값이다. */
  innerRatio: 0.42,
  /** 이웃한 별 사이의 거리(바깥 반지름 배수). */
  gapRatio: 2.18,
  shadow: 0x1a0f00,
  halo: 0xffb340,
  glow: 0xffcf5e,
  body: 0xf5a623,
  /** 빈 별의 테두리 색. 도형이므로 문자열이 아니라 숫자 색이다. */
  empty: 0x8b8f96,
} as const;

/**
 * 별 한 벌의 색.
 *
 * 겹의 수와 크기 비율은 어디서나 같고, 이 네 색만 갈아 끼운다. 성급은 호박색 한 계열이고,
 * 룬 세공의 결과 표식처럼 성급이 아닌 별은 자기 색을 가져오되 **같은 모양과 같은 겹**을 쓴다.
 */
export interface StarTones {
  shadow: number;
  halo: number;
  glow: number;
  body: number;
  /** 빛무리를 얼마나 넓게 펼지. 어두운 별은 낮춰서 가라앉힌다. */
  bloom?: number;
}

/** 성급의 호박색 한 벌. 별의 기본값이다. */
export const AMBER_STAR: StarTones = { shadow: STAR.shadow, halo: STAR.halo, glow: STAR.glow, body: STAR.body };

/**
 * 색만 고른 별 하나. 모양·겹·크기 비율은 성급 별과 같다.
 *
 * 겹마다 색을 바꾸지 않고 한 계열의 밝기와 투명도만 달리한다는 규칙은 여기서도 그대로다 —
 * 같은 빛에서 나온 것처럼 보여야 여러 별이 한 화면에 서도 어수선하지 않다.
 */
export function addGlowStar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  outer: number,
  tones: StarTones = AMBER_STAR,
): void {
  const inner = outer * STAR.innerRatio;
  const bloom = tones.bloom ?? 1;
  parent.add(scene.add.star(x + outer * 0.06, y + outer * 0.14, 5, inner, outer, tones.shadow, 0.5));
  parent.add(scene.add.star(x, y, 5, inner * 1.5, outer * 1.95, tones.halo, 0.1 * bloom));
  parent.add(scene.add.star(x, y, 5, inner * 1.3, outer * 1.5, tones.halo, 0.18 * bloom));
  parent.add(scene.add.star(x, y, 5, inner * 1.12, outer * 1.18, tones.glow, 0.34 * bloom));
  parent.add(scene.add.star(x, y, 5, inner, outer, tones.body, 1));
}

/**
 * 별 하나를 그려 컨테이너에 담는다. 원점은 별의 한가운데다.
 *
 * `outer`는 별의 바깥 반지름이다. 카드처럼 작은 자리에서는 빛무리가 이웃 별과 겹쳐 뭉치므로
 * 크기에 비례해 함께 줄어든다.
 */
export function addStar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  outer: number,
  filled: boolean,
): void {
  if (!filled) {
    // 빈 별도 같은 크기다. 다섯 칸이 나란히 읽히려면 자리가 흔들리지 않아야 한다.
    parent.add(scene.add.star(x, y, 5, outer * STAR.innerRatio, outer, 0x000000, 0.3).setStrokeStyle(2, STAR.empty, 0.8));
    return;
  }
  addGlowStar(scene, parent, x, y, outer, AMBER_STAR);
}

/**
 * 한 줄에 별 여러 개를 가운데 정렬로 놓는다.
 *
 * `x`는 줄 전체의 가운데다. 성급은 어느 화면에서나 "가운데에 모인 다섯 칸"으로 읽혀야 한다.
 */
export function addStarRow(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  outer: number,
  filled: number,
  total: number,
): void {
  const gap = outer * STAR.gapRatio;
  const left = x - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i += 1) addStar(scene, parent, left + i * gap, y, outer, i < filled);
}
