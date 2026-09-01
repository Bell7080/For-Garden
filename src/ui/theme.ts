import { FONT_FAMILY, fontStyleFor, type TextRole } from "./fonts";
import { getTextScale } from "./textScale";

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
  /** Graphics API는 CSS 문자열 대신 숫자 색을 요구하므로 같은 흰 잉크를 숫자로도 제공한다. */
  inkHex: 0xf2f0ec,
  inkDim: "#a9a7a2",
  /** Graphics API는 CSS 문자열 대신 숫자 색을 요구하므로 같은 흐린 잉크를 숫자로도 제공한다. */
  inkDimHex: 0xa9a7a2,
  accent: 0xd8b978,
  accentText: "#d8b978",
  /** 완료했지만 아직 받지 않은 보상만 쓰는 밝은 호박색 신호다. */
  missionClaim: 0xe0a83e,
  danger: 0xb03a3a,
  dangerText: "#e07a7a",
  ally: 0x5b86a3,
  /** 체력은 능력치 색과 같은 연두다. 어느 화면에서 보든 "체력은 초록"이 흔들리지 않는다. */
  hpFill: 0x6fc47f,
  /** 같은 값을 적는 글자색. 게이지보다 한 톤 밝아야 배경 원화 위에서 읽힌다. */
  hpText: "#8fd89b",
  hpEnemy: 0xb03a3a,
  energy: 0x7ea8d8,
  /** 발굴 생산 광고는 기존 SR 청록보다 어두운 저채도 청록으로 일반 수확과 구분한다. */
  excavationProduction: 0x5f9fa3,
  /** 발굴 보관 광고는 SSR 금색보다 차분한 보랏빛으로 용량 계열 효과를 구분한다. */
  excavationStorage: 0x8b72a6,
  /** 보관 버튼의 유리 면은 호박색을 아주 어둡게 눌러 보라 강조선과 따뜻한 대비만 남긴다. */
  excavationStorageFill: 0x302a24,
  /** 출격·출전처럼 "나가서 싸운다"를 뜻하는 입구의 강조색. 금색보다 붉다. */
  sortie: 0xd85f34,
  sortieText: "#f08b62",
  /** 기여도 방어 막대 전용 저채도 청색. 에너지와 구분하면서 같은 냉색 계열을 유지한다. */
  contributionDefense: 0x7392ad,
  /** 발굴 등급은 기본 금속 패널 위에서만 쓰는 보조 신호색이다. */
  /** 렐릭 R보다 낮은 비개체 연구 결과 전용 중립 회색이다. */
  researchGray: 0x596169,
  rarityR: 0x7890a3,
  raritySR: 0x6fc4bd,
  raritySRAlt: 0x9b78c7,
  raritySSR: 0xe0a83e,
  raritySSRLight: 0xffd37a,
  /** 야성은 연붉은색에서 시작해 차오를수록 짙어지고, 피버에서 가장 붉다. 한 계열로 묶는다. */
  ferocityLow: 0xe09a94,
  ferocityWarning: 0xe8675e,
  ferocityFever: 0xff5a4a,
  ferocityText: "#f0a49c",
  ferocityHotText: "#ff9184",
} as const;

/** 프로필 수식어는 외부 색 문자열 대신 희귀도→의미 토큰 표만 거쳐 색을 고른다. */
export const PROFILE_MODIFIER_RARITY_COLOR = {
  common: COLOR.inkDimHex,
  rare: COLOR.raritySR,
  epic: COLOR.sortie,
  legendary: COLOR.raritySSR,
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
    // 접근성 배율은 개별 씬 좌표 대신 모든 텍스트가 거치는 이 스타일 계층에서만 적용한다.
    fontSize: `${Math.round(opts.size * getTextScale())}px`,
    fontStyle: fontStyleFor(opts.role),
    color: opts.color ?? COLOR.ink,
    align: opts.align,
    lineSpacing: opts.lineSpacing,
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
  };
}
