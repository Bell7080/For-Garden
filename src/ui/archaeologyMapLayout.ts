import { clampArchaeologyCamera } from "../core/archaeologyMap";

/** 고고학 지도 월드/노드 규격은 화면과 테스트가 함께 읽는다. */
export const ARCHAEOLOGY_MAP_LAYOUT = { width: 1480, height: 1180, nodeSize: 104, hitSize: 132 } as const;

/** UI는 순수 clamp에 월드 규격만 주입한다. */
export function clampArchaeologyMapOffset(x: number, y: number, width: number, height: number): { x: number; y: number } {
  return clampArchaeologyCamera({ x, y }, { width, height }, ARCHAEOLOGY_MAP_LAYOUT);
}
