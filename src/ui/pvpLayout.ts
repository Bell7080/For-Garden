/**
 * 결투 상세 화면의 복귀 목적지.
 *
 * 모드를 고르는 일은 씬이 아니라 로비 위의 판 한 장이 맡는다(출격과 같은 프리팹·같은 돌아가기
 * 자리). 그래서 상세에서 돌아갈 곳은 선택 씬이 아니라 로비다. 씬과 테스트가 같은 값을 읽어
 * 문자열이 엇갈리지 않게 여기 한 곳에만 적는다.
 */
export const PVP_RETURN_SCENE = { preview: "lobby" } as const;

/**
 * 결투 선택판.
 *
 * 출격판과 **같은 여백 문법**을 쓴다 — 판 윗변에서 첫 칸까지 100, 칸 사이 76, 마지막 칸에서
 * 밑변까지 62(밑 왼쪽에 곁팝업이 달리는 자리)이고 판을 같은 만큼 올려 세운다. 판 높이는 손으로
 * 적지 않고 칸 높이에서 거꾸로 구한다. Phaser 없는 모듈이라 E2E도 같은 값으로 칸을 누른다. 결투장만 입구 원화를 가진 주 콘텐츠라 한 뼘 높다.
 */
export const PVP_MENU = {
  panel: { width: 980, offsetY: -80 },
  pad: { top: 100, bottom: 62 },
  gap: 76,
  entry: { width: 800, height: 180, featured: 260 },
} as const;

/** 결투 선택판의 칸 높이(모드 순서대로). 원화를 가진 결투장만 크게 선다. */
export function pvpEntryHeight(id: string): number {
  return id === "arena" ? PVP_MENU.entry.featured : PVP_MENU.entry.height;
}

/** 칸 높이에서 판 높이와 각 칸의 중심 y를 구한다. */
export function pvpMenuLayout(ids: readonly string[]): { height: number; centers: number[] } {
  const heights = ids.map(pvpEntryHeight);
  const height = PVP_MENU.pad.top + PVP_MENU.pad.bottom + heights.reduce((sum, h) => sum + h, 0) + PVP_MENU.gap * (heights.length - 1);
  let top = -height / 2 + PVP_MENU.pad.top;
  const centers = heights.map((h) => { const center = top + h / 2; top += h + PVP_MENU.gap; return center; });
  return { height, centers };
}
