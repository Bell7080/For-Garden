import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";
import { RUNE_SELECT } from "./runeSelectLayout";

/**
 * 가방 룬 탭의 세로 자리(판 가운데 기준) — 위에서부터 **고른 룬의 정보 판** → 공용 조작 두 줄 → 카드 목록.
 *
 * 정보 판은 특성 연구·합성의 고르기 판과 같은 한 장(`paintRuneInfoPanel`)이라 높이도 같은 값을 읽는다.
 * 일괄 판매·세공 버튼(제목표 줄 오른쪽, y −700)의 밑변 아래에서 시작한다.
 * Phaser 없는 모듈이라 화면과 E2E가 같은 값을 읽는다.
 */
export const INVENTORY_RUNE = (() => {
  const infoTop = -662;
  const infoHeight = RUNE_SELECT.infoHeight;
  const controlsY = infoTop + infoHeight + RUNE_SELECT.controlsGap + RUNE_LIST_CONTROLS.rowHeight / 2;
  const listTop = controlsY - RUNE_LIST_CONTROLS.rowHeight / 2 + RUNE_LIST_CONTROLS.height + 18;
  return { infoTop, infoHeight, controlsY, listTop } as const;
})();
