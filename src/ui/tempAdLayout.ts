// Phaser 없이 읽히는 임시 광고 팝업의 자리표(테스트도 같은 값을 읽는다).

/** 실제 광고 SDK가 붙기 전까지 광고 자리를 메우는 임시 팝업의 값. */
export const TEMP_AD = {
  seconds: 3,
  depth: 6000,
  dimAlpha: 0.82,
  card: { width: 820, height: 760 },
  bar: { width: 620, height: 34 },
  sdHeight: 230,
  /**
   * 카드 안의 세로 자리(카드 가운데가 0). 위에서부터 제목 줄 → SD 무대 → 게이지 → 퍼센트 → 버튼이고,
   * 서로의 상자가 겹치지 않는다(`tempAdPopup.test.ts`가 지킨다).
   */
  lay: { titleY: -306, sdGroundY: -10, barY: 130, percentY: 196, buttonY: 292, buttonHeight: 120 },
  /** 받는 중 표시를 못 닫은 채 남기지 않는 안전 한도. */
  holdLimitMs: 6000,
} as const;

/** 팝업이 닫히기 전까지 광고 뒤 지급을 기다리는 자리. 지급이 끝나면 `release`로 놓는다. */
export interface TempAdHandle { release(): void }

