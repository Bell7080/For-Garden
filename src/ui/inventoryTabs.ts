/** 가방 탭 한 면의 크기와 줄 전체의 배치를 한곳에서 고정한다. */
export const INVENTORY_TAB_LAYOUT = {
  count: 4,
  width: 176,
  height: 82,
  gap: 8,
  centerY: 590,
  selectedScale: 1.1,
} as const;

/** 목록 창 아래변과 탭 윗변 사이의 틈. 목록은 이 선까지만 보이고 손도 이 선까지만 받는다. */
export const INVENTORY_TAB_CLEARANCE = 20;
/** 목록 창의 아래변(판 가운데 기준). E2E가 "창 밖" 자리를 같은 값에서 읽는다. */
export const INVENTORY_LIST_BOTTOM = INVENTORY_TAB_LAYOUT.centerY - INVENTORY_TAB_LAYOUT.height * INVENTORY_TAB_LAYOUT.selectedScale / 2 - INVENTORY_TAB_CLEARANCE;

/** 탭 줄이 팝업 가운데를 기준으로 좌우 대칭을 유지하도록 로컬 중심점을 계산한다. */
export function inventoryCategoryTabPosition(index: number): { x: number; y: number } {
  const { count, width, gap, centerY } = INVENTORY_TAB_LAYOUT;
  // 너비와 간격만으로 시작점을 구해 항목 수가 바뀌어도 눈대중 좌표가 남지 않게 한다.
  const rowWidth = count * width + (count - 1) * gap;
  return { x: -rowWidth / 2 + width / 2 + index * (width + gap), y: centerY };
}
