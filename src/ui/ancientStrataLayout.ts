/**
 * 고대 지층 지도의 노드 자리 — Phaser 없는 순수 배치표.
 *
 * 층은 위에서 아래로 내려가고(B1이 맨 위), 노드는 가운데 축 양옆을 번갈아 오간다. 폭이 서로 달라
 * 길이 지그재그로 읽히고, 구간의 마지막 층(관문)은 가운데에 큼직하게 선다.
 */
import { ANCIENT_FLOORS_PER_BLOCK, isAncientGate } from "../core/ancientStrata";

export const ANCIENT_MAP = {
  /** 층 사이 세로 간격. */
  gap: 250,
  /** 지도가 보이는 세로 구간. 위쪽 제목과 아래쪽 버튼을 침범하지 않는다. */
  window: { top: 430, bottom: 1560 },
  /** 일반 노드·관문 노드의 한 변. */
  node: 104,
  gateNode: 148,
  /** 구간 안 층 순서(0부터)마다 가운데 축에서 벌어지는 거리. 부호가 번갈아 좌우를 오간다. */
  offsets: [-250, 190, -130, 270, -220, 110, -270, 220, -150, 0],
  /** 첫 층·마지막 층 바깥으로 이어지는 길 토막의 길이. 끝없이 이어진다는 표식이다. */
  stub: 190,
} as const;

/** 구간 안 층 순서(0부터)의 가로 오프셋. */
export function ancientNodeOffset(indexInBlock: number): number {
  return ANCIENT_MAP.offsets[((indexInBlock % ANCIENT_FLOORS_PER_BLOCK) + ANCIENT_FLOORS_PER_BLOCK) % ANCIENT_FLOORS_PER_BLOCK];
}

/** 지도 컨테이너 안 노드 좌표. 첫 층이 원점이고 내려갈수록 y가 커진다. */
export function ancientNodePoint(indexInBlock: number, centerX: number): { x: number; y: number } {
  return { x: centerX + ancientNodeOffset(indexInBlock), y: indexInBlock * ANCIENT_MAP.gap };
}

export function ancientNodeSize(floor: number): number {
  return isAncientGate(floor) ? ANCIENT_MAP.gateNode : ANCIENT_MAP.node;
}

/** 지도 길이(첫 층부터 마지막 층까지). */
export function ancientMapHeight(): number {
  return (ANCIENT_FLOORS_PER_BLOCK - 1) * ANCIENT_MAP.gap;
}

/**
 * 컨테이너 y의 스크롤 한계. `max`는 첫 층이 창 위쪽에 걸린 상태(맨 위), `min`은 마지막 층이 창 아래에 걸린 상태다.
 * 원화는 컨테이너와 함께 움직이므로 화면 어디를 비추든 비지 않도록 `artSpan`이 그만큼의 길이를 준다.
 */
export function ancientScrollLimits(): { min: number; max: number; artTop: number; artHeight: number } {
  const { window, stub } = ANCIENT_MAP;
  const max = window.top + 130;
  const min = Math.min(max, window.bottom - 130 - ancientMapHeight());
  // 화면 맨 위(0)와 맨 아래(1920)까지 비추는 컨테이너 좌표 범위에 길 토막만큼 여유를 더한다.
  const artTop = -max - stub;
  const artBottom = 1920 - min + stub;
  return { min, max, artTop, artHeight: artBottom - artTop };
}
