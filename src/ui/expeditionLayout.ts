/** 세로 원정 HUD의 구역 이름이다. 회귀 테스트가 렌더 구현 대신 이 단일 배치 계약을 읽는다. */
export type ExpeditionLayoutRegion = "rewards" | "map" | "augments" | "relics" | "actions";

/**
 * 기준 1080×1920 화면에서 각 정보군이 독점하는 세로 안전 영역이다.
 *
 * `relics`는 전투와 같은 크기로 선 생존 HUD의 실제 bounds이고, 출격 버튼은 뒤로가기와 같은
 * 하단 행동선(`actions`)에 속한다 — 둘을 따로 두면 같은 줄이 두 이름을 갖는다.
 */
export const EXPEDITION_LAYOUT: Readonly<Record<ExpeditionLayoutRegion, { top: number; bottom: number }>> = {
  rewards: { top: 116, bottom: 286 },
  map: { top: 316, bottom: 1138 },
  augments: { top: 1162, bottom: 1234 },
  relics: { top: 1271, bottom: 1734 },
  actions: { top: 1756, bottom: 1902 },
};

/**
 * 증강 선택판의 규격이다.
 *
 * 개인 대상은 판 안이 아니라 화면에 이미 선 생존 HUD에서 고르므로, 판은 `relics` 구역 위에서
 * 멈춰야 한다. 높이를 늘릴 때는 이 계약을 함께 확인한다.
 */
export const EXPEDITION_AUGMENT_POPUP = { width: 940, height: 840, centerY: 690 } as const;

/** 인접 구역의 최소 여백을 계산해 모바일 세로 화면에서 겹침을 순수하게 검증한다. */
export function expeditionLayoutGaps(): number[] {
  const order: ExpeditionLayoutRegion[] = ["rewards", "map", "augments", "relics", "actions"];
  return order.slice(1).map((key, index) => EXPEDITION_LAYOUT[key].top - EXPEDITION_LAYOUT[order[index]].bottom);
}

/** 지도 프리팹이 공유하는 월드 규격으로, 한 화면에는 약 다섯 층만 보이게 한다. */
export const EXPEDITION_MAP_LAYOUT = {
  floors: 20,
  columns: 5,
  columnGap: 188,
  floorGap: 176,
  sidePadding: 164,
  verticalPadding: 112,
  nodeSize: 72,
  bossSize: 92,
  hitSize: 112,
} as const;

/** 1층 아래와 20층 위에 같은 숨 쉴 공간을 둔 전체 세로 월드 높이를 계산한다. */
export function expeditionMapWorldHeight(): number {
  return (EXPEDITION_MAP_LAYOUT.floors - 1) * EXPEDITION_MAP_LAYOUT.floorGap + EXPEDITION_MAP_LAYOUT.verticalPadding * 2;
}

/** 생성 데이터의 floor/column을 아래 1층, 위 20층 순서의 월드 좌표로 바꾼다. */
export function expeditionNodePosition(floor: number, column: number): { x: number; y: number } {
  const height = expeditionMapWorldHeight();
  return {
    x: EXPEDITION_MAP_LAYOUT.sidePadding + column * EXPEDITION_MAP_LAYOUT.columnGap,
    y: height - EXPEDITION_MAP_LAYOUT.verticalPadding - (floor - 1) * EXPEDITION_MAP_LAYOUT.floorGap,
  };
}

/** 월드 이동량을 끝층 바깥이 노출되지 않는 닫힌 스크롤 범위로 제한한다. */
export function clampExpeditionMapOffset(offset: number, viewportHeight: number, worldHeight = expeditionMapWorldHeight()): number {
  const minimum = Math.min(0, viewportHeight - worldHeight);
  return Math.min(0, Math.max(minimum, offset));
}

/** 현재 도달 가능한 층의 노드 줄이 뷰포트 중앙에 오도록 이동량을 계산한다. */
export function focusExpeditionFloor(floor: number, viewportHeight: number): number {
  const nodeY = expeditionNodePosition(Math.min(EXPEDITION_MAP_LAYOUT.floors, Math.max(1, floor)), 0).y;
  return clampExpeditionMapOffset(viewportHeight / 2 - nodeY, viewportHeight);
}
/** 원정 씬이 표현하는 세 화면 상태다. 저장 상태와 표시 단계를 섞지 않고 테스트할 수 있게 분리한다. */
export type ExpeditionBackgroundState = "ranking" | "preparation" | "active";

/** Phaser 없이 기록 → 편성 → 지도의 배경 역할을 선택해 단위 테스트가 로더에 의존하지 않게 한다. */
export function expeditionBackgroundFor<T>(state: ExpeditionBackgroundState, backgrounds: {
  expeditionRanking: T; expeditionField: T; expeditionMap: T;
}): T {
  // 기록 화면은 인물이 없는 도시 원경 위에 폰토스 Puppet을 주 피사체로 세운다.
  if (state === "ranking") return backgrounds.expeditionRanking;
  // 편성은 이후 교전과 같은 지형을 미리 보여 주어 출격 흐름을 잇는다.
  if (state === "preparation") return backgrounds.expeditionField;
  // 활성 런은 길과 노드가 놓일 전용 장축 지도를 사용한다.
  return backgrounds.expeditionMap;
}
