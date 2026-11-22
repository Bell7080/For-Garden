/**
 * 광고 칸·광고 버튼이 함께 쓰는 색 한 벌.
 *
 * 광고 그림(`UI_ICON.ad`)이 붉은 영상 표라, 판도 그 결을 따라 짙은 와인빛에 산호색 윗줄을 두른다.
 * 예전에는 광고 버튼이 화면마다 회색 유리판(발굴)·보랏빛(충전 칸)·검은 줄(프리미엄)로 갈려 같은
 * 「광고 보고 받기」가 세 가지 조작처럼 읽혔다. 금빛은 화면의 주 조작(수확·출격) 몫이라 광고는 쓰지 않는다.
 */
export const AD_TONE = {
  /** 윗줄·밑 턱·시간 게이지의 색. */
  accent: 0xff7a86,
  /** 판의 바탕 — 강조색을 짙게 누른 와인빛. */
  fill: 0x2e1119,
  /** 판 위 글자색. */
  text: "#ffd6db",
  /** 진하게 서야 하는 수(남은 횟수)의 색. */
  value: "#ffb3bb",
} as const;

/** 광고를 보고 무언가를 받는 버튼 한 벌(`Button`에 펼쳐 넘긴다). 주 조작보다 한 단계 가볍게 점 무늬는 두지 않는다. */
export const AD_BUTTON_STYLE = {
  variant: "primary",
  accentColor: AD_TONE.accent,
  accentTextColor: AD_TONE.text,
  labelColor: AD_TONE.text,
  fill: AD_TONE.fill,
} as const;
