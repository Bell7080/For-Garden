/**
 * 수호전 결과판 성적 블록의 자리(`GuardResultReport`). 좌표는 결과판 몸판(940 × 1360, 가운데가 원점) 안이다.
 *
 * 수호전은 스테미나를 쓰지 않아 경험치 블록이 서지 않으므로, 그 빈 띠만큼 보상 줄을 끌어올리고(`lootShift`)
 * 남는 아래를 막대 셋과 순위 줄이 넉넉히 쓴다. Phaser를 읽지 않아 테스트가 같은 표로 겹침을 잰다.
 */
export const GUARD_REPORT_LAYOUT = {
  /** 보상 줄(기본 y 320 · 액자 132)을 올리는 만큼. 기여도 버튼(y 50 · 높이 84) 아래에 여백을 남긴다. */
  lootShift: -80,
  /** 막대 셋 — 이름표 · 큰 수 · 막대 · 곁말 한 줄. 칸 가운데 x는 `-cellGap · 0 · +cellGap`. */
  stats: { y: 398, cellGap: 290, labelDy: -40, valueDy: 0, barDy: 40, barWidth: 236, barHeight: 16, captionDy: 70, labelSize: 24, valueSize: 44, captionSize: 22 },
  /** 오늘 길드원 순위 — 머리줄과 줄 셋. */
  ranking: { headerY: 516, rowTop: 560, rowGap: 42, rowHeight: 36, left: -400, right: 380, rankX: -368, nameX: -322, nameWidth: 200, barLeft: -100, barRight: 250, barHeight: 14, headerSize: 24, rowSize: 26 },
} as const;

/** 줄 `index`(0부터)의 가운데 y. */
export function guardReportRowY(index: number): number {
  return GUARD_REPORT_LAYOUT.ranking.rowTop + index * GUARD_REPORT_LAYOUT.ranking.rowGap;
}
