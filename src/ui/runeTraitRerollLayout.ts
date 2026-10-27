/** 재해석 결과 비교 쪽지의 자리표. Phaser 없이 안전 영역 검사가 같은 값을 읽는다. */
export const REROLL_POPUP = { width: 900, height: 840, columnGap: 220 } as const;

/** 밑동의 긴 버튼. 오른쪽 아래 깎임(`popupRightEdgeAt`) 안에 16px 여유로 들도록 폭을 정했다. */
export const REROLL_AGAIN = { width: 780, height: 92, fromBottom: 90 } as const;
