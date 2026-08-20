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
  accent: 0xd8b978,
  accentText: "#d8b978",
  danger: 0xb03a3a,
  dangerText: "#e07a7a",
  ally: 0x5b86a3,
  hpFill: 0xd8b978,
  hpEnemy: 0xb03a3a,
  energy: 0x7ea8d8,
  /** 야성 단계색은 HP/궁극기와 즉시 구분되는 청록→황색→적색 신호다. */
  ferocityLow: 0x42b8ad,
  ferocityWarning: 0xd6a83d,
  ferocityDanger: 0xc84646,
} as const;

/**
 * 작은 화면에서 읽혀야 하므로 획이 굵고 자간이 넓은 산세리프를 쓴다.
 * 세리프(Georgia)는 한글 글자가 얇게 렌더링돼 가독성이 떨어졌다.
 */
export const FONT = '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export interface TextOpts {
  size: number;
  color?: string;
  align?: "left" | "center" | "right";
  wrap?: number;
  lineSpacing?: number;
  /** 굵기를 낮추고 싶을 때만 끈다. 기본은 굵게다. */
  bold?: boolean;
}

/** 글자 스타일을 만든다. 기본이 굵은 글씨라 어두운 배경에서도 또렷하다. */
export function textStyle(opts: TextOpts): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${opts.size}px`,
    fontStyle: opts.bold === false ? "normal" : "bold",
    color: opts.color ?? COLOR.ink,
    align: opts.align,
    lineSpacing: opts.lineSpacing,
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
  };
}
