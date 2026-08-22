import { FONT_FAMILY, fontStyleFor, type TextRole } from "./fonts";

/** 색과 글꼴을 한 곳에 모아둔다. 씬에서 값을 직접 박아 넣지 않는다. */
export const COLOR = {
  /**
   * 게임 화면 바탕. 순수 검정이 아니라 살짝 밝은 검회색이다 —
   * 세로 화면 바깥의 레터박스(검정)와 게임 화면의 경계가 보여야 한다.
   */
  void: 0x1a1d21,
  panel: 0x24282e,
  panelEdge: 0x3a404a,
  ink: "#f2f0ec",
  inkDim: "#a9a7a2",
  /** Graphics API는 CSS 문자열 대신 숫자 색을 요구하므로 같은 흐린 잉크를 숫자로도 제공한다. */
  inkDimHex: 0xa9a7a2,
  accent: 0xd8b978,
  accentText: "#d8b978",
  danger: 0xb03a3a,
  dangerText: "#e07a7a",
  ally: 0x5b86a3,
  hpFill: 0xd8b978,
  hpEnemy: 0xb03a3a,
  energy: 0x7ea8d8,
  /** 출격·출전처럼 "나가서 싸운다"를 뜻하는 입구의 강조색. 금색보다 붉다. */
  sortie: 0xd85f34,
  sortieText: "#f08b62",
  /** 발굴 등급은 기본 금속 패널 위에서만 쓰는 보조 신호색이다. */
  rarityR: 0x7890a3,
  raritySR: 0x6fc4bd,
  raritySRAlt: 0x9b78c7,
  raritySSR: 0xe0a83e,
  raritySSRLight: 0xffd37a,
  /** 야성 단계색은 청록→황색으로 차오르고 피버에서는 공용 황동 강조색을 사용한다. */
  ferocityLow: 0x42b8ad,
  ferocityWarning: 0xd6a83d,
} as const;

export { FONT_FAMILY, type TextRole } from "./fonts";

export interface TextOpts {
  size: number;
  /**
   * 글의 위계. 크기가 아니라 역할로 고른다 — `src/ui/fonts.ts`의 `TextRole` 설명이 기준이다.
   * 기본값을 두지 않는 이유는, 기본값이 있으면 아무도 고르지 않고 화면마다 굵기가 어긋나기
   * 때문이다. 고르기 애매하면 문장은 `body`다.
   */
  role: TextRole;
  color?: string;
  align?: "left" | "center" | "right";
  wrap?: number;
  lineSpacing?: number;
}

/** 글자 스타일을 만든다. 굵기는 역할에서만 나오고 씬이 직접 정하지 못한다. */
export function textStyle(opts: TextOpts): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${opts.size}px`,
    fontStyle: fontStyleFor(opts.role),
    color: opts.color ?? COLOR.ink,
    align: opts.align,
    lineSpacing: opts.lineSpacing,
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
  };
}
