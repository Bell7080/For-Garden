/**
 * 전장 이펙트의 잉크 조각 도형 — **흰 바탕 + 잉크선으로 한 번 굽고 tint로 색을 입힌다.**
 *
 * Phaser의 tint는 곱하기라 흰 면만 속성색이 되고 잉크선은 검게 남는다. 그래서 같은 조각 한 장이
 * 어느 개체의 색으로 물들어도 SD 원화와 같은 굵은 외곽선을 지킨다. 밝아지는 합성(ADD)으로 그리던
 * 조각은 밝은 배경 원화 위에서 하얗게 묻혔다 — 잉크선은 배경이 밝든 어둡든 떨어져 나온다.
 *
 * 이 파일은 Phaser를 읽지 않는다. 도형과 결은 굽는 쪽(`inkTextures.ts`)과 회귀 테스트가 같은 값을
 * 읽어야 하기 때문이다. 좌표는 **조각 가운데가 원점**인 게임 픽셀의 절반 단위(설계 화면 540×960)이고,
 * 굽는 쪽이 `INK_STYLE.bakeScale`배로 키워 게임 화면(1080×1920)과 1:1이 되게 한다.
 */

export type InkPoint = readonly [number, number];

/** 조각 하나를 이루는 다각형 한 겹. 여러 겹이 차례로 겹쳐 한 조각이 된다. */
export interface InkPart {
  /** 바깥 윤곽. 동그라미를 쓰지 않는다 — 곡선이 필요하면 짧은 선분으로 끊는다. */
  readonly points: readonly InkPoint[];
  /** 윤곽 안을 잘라 칠하는 그늘 영역(2단 셀). 없으면 흰 면 한 톤이다. */
  readonly shade?: readonly InkPoint[];
  /** 잉크선 두께(설계 단위). 0이면 선을 긋지 않는다. */
  readonly lineWidth: number;
  /** 면 색. 기본은 흰색이고, 그늘 톤으로 칠할 때만 `"shade"`를 준다. */
  readonly fill?: "white" | "shade";
}

export interface InkShape {
  /** 굽는 캔버스의 가로세로(설계 단위). 윤곽과 선 두께가 모두 이 안에 들어야 한다. */
  readonly width: number;
  readonly height: number;
  readonly parts: readonly InkPart[];
}

/** 잉크 조각의 결. 색은 여기 셋뿐이고 나머지는 전부 tint가 입힌다. */
export const INK_STYLE = {
  /** 외곽선. 순검정은 SD 원화의 선보다 튀므로 보랏빛이 도는 먹색이다. */
  ink: "#2e2836",
  /** 흰 면. tint가 곱해져 속성색이 된다. */
  white: "#ffffff",
  /** 2단 셀의 그늘. tint가 곱해져 같은 색의 어두운 톤이 된다. */
  shade: "#b4adc3",
  /** 설계 단위 → 텍스처 픽셀. 게임 화면이 설계 화면의 두 배다. */
  bakeScale: 2,
  /** 꺾인 모서리는 각지게 — 둥근 끝은 화면의 결과 어긋난다. */
  miterLimit: 8,
} as const;

/** 오른쪽 아래를 덮는 그늘 — 대부분의 조각이 같은 쪽에서 빛을 받는다. */
const LOWER_RIGHT: readonly InkPoint[] = [[0, 0], [80, 0], [80, 80], [0, 80]];

/**
 * 초승달 칼날. 바깥 호와 두께가 가운데로 부풀었다 양 끝에서 0이 되는 안쪽 호를 잇는다.
 * 그늘은 안쪽 호에서 두께의 42%까지 — 칼날 가운데에 흰 줄이 서지 않게 한쪽 가장자리만 누른다.
 */
export function crescentPart(
  radius: number,
  thickness: number,
  fromAngle: number,
  toAngle: number,
  centerY: number,
  lineWidth: number,
  segments = 18,
): InkPart {
  const outer: InkPoint[] = [];
  const inner: InkPoint[] = [];
  const shadeEdge: InkPoint[] = [];
  for (let k = 0; k <= segments; k += 1) {
    const t = k / segments;
    const angle = fromAngle + (toAngle - fromAngle) * t;
    const width = thickness * Math.sin(Math.PI * t);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    outer.push([cos * radius, sin * radius + centerY]);
    inner.unshift([cos * (radius - width), sin * (radius - width) + centerY]);
    shadeEdge.push([cos * (radius - width * 0.42), sin * (radius - width * 0.42) + centerY]);
  }
  return { points: [...outer, ...inner], shade: [...shadeEdge, ...inner], lineWidth };
}

/** 점 목록을 원점 둘레로 돌린다. */
export function rotateInkPoints(points: readonly InkPoint[], radians: number): InkPoint[] {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as const);
}

/**
 * 폭주 머리 표식(💢)의 한 갈래. **꺾인 모서리가 가운데를 향하고 두 팔이 바깥으로 벌어진다** —
 * 모서리가 바깥을 향하면 네 갈래가 네모 테두리로 모여 화난 표식이 아니라 틀로 읽힌다.
 */
const ANGER_ARM: readonly InkPoint[] = [[-3, -3], [-5, -21], [-10, -19], [-9, -9], [-19, -10], [-21, -5]];

export const INK_SHAPES = {
  /** 베기 — 초승달 칼날. */
  blade: { width: 190, height: 76, parts: [crescentPart(92, 30, -Math.PI * 0.86, -Math.PI * 0.14, 66, 4)] },
  /** 발톱·채찍 끝의 짧은 획. */
  streak: {
    width: 140,
    height: 30,
    parts: [{ points: [[-62, 0], [-12, -7], [62, -1], [-12, 6]], shade: [[-70, 1], [70, 1], [70, 12], [-70, 12]], lineWidth: 3 }],
  },
  /** 맞은 자리에서 터지는 별. 치명타는 같은 별을 한 등급 크게 노랗게 쓴다. */
  star: {
    width: 100,
    height: 100,
    parts: [{ points: [[0, -40], [9, -9], [40, -2], [9, 7], [2, 36], [-8, 8], [-38, 0], [-9, -8]], shade: LOWER_RIGHT, lineWidth: 4 }],
  },
  /** 작은 네 갈래 반짝임. */
  spark: {
    width: 36,
    height: 36,
    parts: [{ points: [[0, -14], [3, -3], [14, 0], [3, 3], [0, 14], [-3, 3], [-14, 0], [-3, -3]], lineWidth: 2.5 }],
  },
  /** 위로 튀는 파편 — 좌우 꼭짓점 높이를 어긋나게 깎은 마름모. */
  shard: {
    width: 32,
    height: 40,
    parts: [{ points: [[0, -15], [9, -3], [1, 15], [-7, 2]], shade: [[0, -20], [20, -20], [20, 20], [0, 20]], lineWidth: 3 }],
  },
  /** 화살. 깃 둘 + 살대 + 촉. */
  arrow: {
    width: 126,
    height: 34,
    parts: [
      { points: [[-46, -2.6], [30, -2.6], [30, 2.6], [-46, 2.6]], lineWidth: 2.5 },
      { points: [[-58, -10], [-45, -10], [-37, -2.6], [-50, -2.6]], lineWidth: 2.5 },
      { points: [[-58, 10], [-45, 10], [-37, 2.6], [-50, 2.6]], shade: [[-60, 0], [-30, 0], [-30, 12], [-60, 12]], lineWidth: 2.5 },
      { points: [[27, -10], [55, 0], [27, 10], [33, 0]], shade: [[20, 0], [60, 0], [60, 12], [20, 12]], lineWidth: 3 },
    ],
  },
  /** 탄환 — 끝이 각진 탄두. 원이 아니다. */
  bullet: {
    width: 64,
    height: 26,
    parts: [{ points: [[-22, -7], [12, -7], [26, 0], [12, 7], [-22, 7]], shade: [[-30, 1.5], [30, 1.5], [30, 10], [-30, 10]], lineWidth: 3.5 }],
  },
  /** 투사체 꼬리. */
  trail: { width: 112, height: 18, parts: [{ points: [[32, -5], [32, 5], [-52, 0]], lineWidth: 2.5 }] },
  /** 음표(현악). 머리는 원이 아니라 기운 마름모다. */
  note: {
    width: 52,
    height: 62,
    parts: [
      { points: [[2, -25], [7, -25], [7, 13], [2, 13]], lineWidth: 2.5 },
      { points: [[7, -25], [21, -15], [19, -6], [7, -14]], shade: [[7, -18], [24, -18], [24, -4], [7, -4]], lineWidth: 2.5 },
      { points: [[-19, 15], [-6, 6], [8, 13], [-5, 23]], shade: [[-20, 16], [10, 16], [10, 26], [-20, 26]], lineWidth: 3 },
    ],
  },
  /** 종이 조각. */
  paper: {
    width: 46,
    height: 50,
    parts: [{ points: [[-15, -18], [16, -13], [12, 18], [-17, 13]], shade: [[16, -13], [12, 18], [-2, 2]], lineWidth: 3 }],
  },
  /** 카드 — 가운데 마름모 문양. */
  card: {
    width: 42,
    height: 52,
    parts: [
      { points: [[-12, -20], [16, -20], [16, 14], [10, 20], [-16, 20], [-16, -16]], shade: [[-20, 6], [20, 6], [20, 24], [-20, 24]], lineWidth: 3 },
      { points: [[0, -8], [6, 0], [0, 8], [-6, 0]], lineWidth: 2, fill: "shade" },
    ],
  },
  /** 회복의 굵은 십자. */
  cross: {
    width: 58,
    height: 58,
    parts: [{
      points: [[-8, -22], [8, -22], [8, -8], [22, -8], [22, 8], [8, 8], [8, 22], [-8, 22], [-8, 8], [-22, 8], [-22, -8], [-8, -8]],
      shade: LOWER_RIGHT,
      lineWidth: 4.5,
    }],
  },
  /** 물방울 — 원이 아니라 위가 뾰족한 마름모. */
  drop: {
    width: 22,
    height: 30,
    parts: [{ points: [[0, -12], [7, 3], [0, 10], [-7, 3]], shade: [[0, -14], [10, -14], [10, 12], [0, 12]], lineWidth: 2.5 }],
  },
  /** 깨진 보호막에서 떨어지는 조각. */
  ringShard: {
    width: 38,
    height: 22,
    parts: [{ points: [[-14, -6], [14, -6], [10, 6], [-10, 6]], shade: [[-16, 1], [16, 1], [16, 8], [-16, 8]], lineWidth: 3 }],
  },
  /** 폭주 머리 표식(💢) — 한 갈래를 네 번 돌려 세운다. */
  anger: {
    width: 52,
    height: 52,
    parts: [0, 1, 2, 3].map((quarter) => ({ points: rotateInkPoints(ANGER_ARM, (quarter * Math.PI) / 2), lineWidth: 3 })),
  },
  /** 퇴장·착지의 먼지 한 덩이 — 원이 아니라 각진 육각. */
  puff: {
    width: 34,
    height: 26,
    parts: [{ points: [[-14, 2], [-6, -9], [6, -8], [14, 1], [6, 9], [-6, 8]], shade: [[-20, 2], [20, 2], [20, 14], [-20, 14]], lineWidth: 2.5 }],
  },
} as const satisfies Record<string, InkShape>;

export type InkShapeId = keyof typeof INK_SHAPES;

export const INK_SHAPE_IDS = Object.keys(INK_SHAPES) as InkShapeId[];

/** 구운 텍스처 키. 메뉴의 홀로그램 조각(`fx-*`)과 섞이지 않게 머리말을 따로 둔다. */
export function inkTextureKey(id: InkShapeId): string {
  return `fx-ink-${id}`;
}
