/** 세로 원정 HUD의 구역 이름이다. 회귀 테스트가 렌더 구현 대신 이 단일 배치 계약을 읽는다. */
export type ExpeditionLayoutRegion = "rewards" | "map" | "augments" | "relics" | "actions";

/** 기준 1080×1920 화면에서 각 정보군이 독점하는 세로 안전 영역이다. */
export const EXPEDITION_LAYOUT: Readonly<Record<ExpeditionLayoutRegion, { top: number; bottom: number }>> = {
  rewards: { top: 116, bottom: 224 },
  map: { top: 276, bottom: 1192 },
  augments: { top: 1218, bottom: 1304 },
  relics: { top: 1332, bottom: 1708 },
  actions: { top: 1730, bottom: 1902 },
};

/** 인접 구역의 최소 여백을 계산해 모바일 세로 화면에서 겹침을 순수하게 검증한다. */
export function expeditionLayoutGaps(): number[] {
  const order: ExpeditionLayoutRegion[] = ["rewards", "map", "augments", "relics", "actions"];
  return order.slice(1).map((key, index) => EXPEDITION_LAYOUT[key].top - EXPEDITION_LAYOUT[order[index]].bottom);
}
