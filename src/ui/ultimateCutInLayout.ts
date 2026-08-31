/** Phaser 없이 테스트할 수 있는 평면 좌표다. */
export interface CutInPoint {
  x: number;
  y: number;
}

/** GeometryMask에 각각 채워 합집합으로 사용할 궁극기 원화 클리핑 영역이다. */
export interface UltimateCutInMaskLayout {
  /** 유리 패널 자체의 비대칭 사각형으로, 골반 아래와 화면 하단을 패널 경계에서 자른다. */
  panel: readonly CutInPoint[];
  /** 머리와 어깨만 패널 윗변 너머로 허용하는 좁은 상단 띠다. */
  upperBand: readonly CutInPoint[];
}

/**
 * 유리면과 상체 돌출 띠를 같은 로컬 좌표계로 만든다.
 *
 * 띠의 아래쪽은 기울어진 윗변의 가장 낮은 지점까지 겹친다. 따라서 두 도형 사이에는 빈틈이
 * 없지만, 띠가 패널 아래까지 내려가지 않아 골반과 다리는 반드시 비대칭 패널에 의해 잘린다.
 */
export function ultimateCutInMaskLayout(width: number): UltimateCutInMaskLayout {
  const panel = [
    { x: -80, y: 470 },
    { x: width, y: 320 },
    { x: width + 80, y: 1240 },
    { x: 0, y: 1390 },
  ] as const;
  // 좌우에 여백을 남긴 띠는 어깨까지 허용하되, 화면 전체를 열린 마스크로 만들지 않는다.
  const upperBand = [
    { x: width * 0.12, y: 170 },
    { x: width * 0.9, y: 170 },
    { x: width * 0.9, y: 470 },
    { x: width * 0.12, y: 470 },
  ] as const;
  return { panel, upperBand };
}
