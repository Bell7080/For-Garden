/** 전환 라벨의 값 표. Phaser 없이 읽혀야 배치표 테스트가 같은 값을 쓴다. 설명은 `CategoryTab.ts`. */
export const CATEGORY_TAB = {
  labelSize: 28,
  /** 글자가 라벨 좌우 변에서 남겨야 하는 여백(빗금 자리를 포함한다). */
  padX: 30,
  /** 글자를 줄이는 하한. 더 줄이면 읽을 수 없어진다. */
  minScale: 0.66,
  /** 깎임 — 높이에 대한 비율. 판·버튼과 같은 기울기 체계를 쓴다. */
  slantRatio: 0.34,
  /** 켜진 라벨이 목록 쪽으로 솟는 높이. 먼 변은 그대로 두고 가까운 변만 올라간다. */
  lift: 10,
  /** 목록과 맞닿는 변에 흐르는 강조선의 굵기. 켜진 것만 그린다. */
  edgeWidth: 5,
  /** 켜진 라벨의 빗금. 제목표(`addSectionTitle`)와 같은 표식이다. */
  mark: { width: 8, heightRatio: 0.44, gap: 12 },
  selectedScale: 1.06,
} as const;
