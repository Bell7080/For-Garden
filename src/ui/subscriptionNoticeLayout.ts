/** 정기권 결제 안내의 자리와 크기. 화면과 테스트가 같은 값을 읽는다. */
export const SUBSCRIPTION_NOTICE = {
  /** 값 버튼 위 한 줄의 글자 크기와 ⓘ 칩. 칩은 글 오른쪽 끝에서 이만큼 떨어져 선다. */
  line: { size: 28, room: 740, chipGap: 40 },
  chip: { size: 44, hit: 64 },
  /** 자세한 안내창. 높이는 쌓인 글에서 구한다. */
  detail: { width: 840, pad: 44, top: 110, bottom: 70, headSize: 28, headGap: 14, bodySize: 26, sectionGap: 38 },
} as const;
