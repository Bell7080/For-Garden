/** 정기권 결제 안내의 자리와 크기. 화면과 테스트가 같은 값을 읽는다. */
export const SUBSCRIPTION_NOTICE = {
  /** 값 버튼 위 한 줄의 글자 크기와 ⓘ 칩. 칩은 글 오른쪽 끝에서 이만큼 떨어져 선다. */
  line: { size: 28, room: 740, chipGap: 40 },
  chip: { size: 44, hit: 64 },
  /** 자세한 안내창. 높이는 쌓인 글에서 구한다. */
  /**
   * 자세한 안내창. 높이는 쌓인 글에서 구한다. 맨 위 `summary` 판에 값과 주기가 크게 서고, 항목마다 유리 판 한 장 +
   * 머리 그림(`icon`)이 선다.
   */
  detail: { width: 840, pad: 44, top: 96, bottom: 64, headSize: 28, headGap: 12, bodySize: 26, sectionGap: 16, cardPad: 22, icon: 34, summary: { height: 120, gap: 22, priceSize: 52 } },
} as const;
