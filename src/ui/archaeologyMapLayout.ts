import { clampArchaeologyCamera } from "../core/archaeologyMap";

/**
 * 고고학 지도 월드/노드 규격은 화면과 테스트가 함께 읽는다.
 *
 * 세 노드가 한 줄로 서던 때의 1480×1180으로는 열세 자리가 서로 겹친다. 월드를 넓히면
 * 줄기 사이에 빈 땅이 생겨 「여기서 갈라진다」가 선 하나로 읽히고, 노드는 그만큼 작아도
 * 손가락에 닿도록 입력면(`hitSize`)만 크게 남긴다.
 */
export const ARCHAEOLOGY_MAP_LAYOUT = { width: 2080, height: 1880, nodeSize: 96, hitSize: 132 } as const;

/** UI는 순수 clamp에 월드 규격만 주입한다. */
export function clampArchaeologyMapOffset(x: number, y: number, width: number, height: number): { x: number; y: number } {
  return clampArchaeologyCamera({ x, y }, { width, height }, ARCHAEOLOGY_MAP_LAYOUT);
}
