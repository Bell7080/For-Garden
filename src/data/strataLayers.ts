/**
 * 지층 탐사의 판 규격과 보상 표다.
 *
 * 확률을 화면에 적지 않는다 — 탐사는 **탐지 수치를 숫자로 보여 주지 않는 콘텐츠**라,
 * 플레이어가 읽는 것은 구역의 은은한 색뿐이고 정확한 분포는 여기에만 있다.
 */

/** 한 칸을 파서 나오는 것의 종류다. 전투 계약처럼 판별 가능한 값만 쓴다. */
export type StrataRewardKind =
  /** 빈 흙. 발굴에는 언제나 실패 가능성이 있어야 고른 칸이 선택이 된다. */
  | "empty"
  | "gold"
  | "rawStone"
  | "fossil"
  | "amber"
  | "gems"
  /** 룬 한 개. 자리(part)와 희귀도는 서버가 정한다. */
  | "rune"
  /** 특성 연구에 쓰는 아이템 하나. 어느 아이템인지는 서버가 정한다. */
  | "researchItem";

/** 유적 미리보기가 같은 이름으로 합쳐 보여 주는 플레이어 보상 그룹이다. */
export type StrataRewardDisplayGroup = "rawStone" | "rune" | "gold" | "fossil" | "amber" | "gems" | "researchMaterial";

/**
 * 내부 추첨 종류를 플레이어 표시 그룹과 공개 단계에 연결하는 유일한 표다.
 *
 * 빈 흙은 보상이 아니므로 어디에도 표시하지 않는다. `researchItem`은 서버가 구체 아이템을
 * 정하기 전의 내부 묶음이어서 유적 미리보기에서는 숨기되, 실제로 캔 뒤에는 「특성 연구 재료」
 * 그룹으로 공개한다. 나머지는 미리보기와 결과 양쪽에서 같은 이름을 쓴다.
 */
export const STRATA_REWARD_DISPLAY: Readonly<Record<StrataRewardKind, {
  readonly group: StrataRewardDisplayGroup | null;
  readonly preview: boolean;
  readonly reveal: boolean;
}>> = {
  empty: { group: null, preview: false, reveal: false },
  rawStone: { group: "rawStone", preview: true, reveal: true },
  rune: { group: "rune", preview: true, reveal: true },
  gold: { group: "gold", preview: true, reveal: true },
  fossil: { group: "fossil", preview: false, reveal: true },
  amber: { group: "amber", preview: false, reveal: true },
  gems: { group: "gems", preview: false, reveal: true },
  researchItem: { group: "researchMaterial", preview: false, reveal: true },
};

/**
 * 구역의 색.
 *
 * 색은 **기대를 기울일 뿐 확정하지 않는다** — 황금빛 구역에 빈 흙이 있고 흙빛 구역에서
 * 다이아가 나올 수 있어야, 색을 보고 고르는 일이 도박이 아니라 판단이 된다.
 */
export type StrataZoneTone = "soil" | "teal" | "gold" | "deep";

/** 한 종류가 뽑힐 가중치와, 뽑혔을 때의 수량 범위다. 수량이 없는 종류는 0으로 둔다. */
export interface StrataRewardRow {
  readonly kind: StrataRewardKind;
  /** 구역 색별 가중치다. 0이면 그 색에서는 나오지 않는다. */
  readonly weight: Readonly<Record<StrataZoneTone, number>>;
  readonly min: number;
  readonly max: number;
}

/** 지층 한 겹의 정의다. */
export interface StrataLayerDefinition {
  readonly id: string;
  /** 판의 가로·세로 칸 수다. */
  readonly columns: number;
  readonly rows: number;
  /** 한 판에서 팔 수 있는 횟수다. 칸 수보다 적어야 「어디를 팔까」가 선택이 된다. */
  readonly digs: number;
  /** 판을 나누는 구역의 개수다. */
  readonly zones: number;
  /** 구역 색이 뽑히는 가중치다. */
  readonly toneWeight: Readonly<Record<StrataZoneTone, number>>;
  readonly rewards: readonly StrataRewardRow[];
}

/**
 * 첫 지층.
 *
 * **5×5에 여덟 번**이다. 세로 화면에서 칸 하나가 손가락에 충분히 크고 한 판이 30초 남짓에
 * 끝나며, 열지 않은 칸이 절반 넘게 남아 「다음엔 저기」라는 미련이 남는다.
 *
 * 수량은 20초짜리 전투 한 판의 보상과 견주어 잡았다 — 한 판을 다 파면 원석이 재해석 한 번
 * (고급 80)에 조금 못 미치게 모인다. 두 판이면 한 번 돌릴 수 있다.
 */
export const STRATA_LAYERS: readonly StrataLayerDefinition[] = [
  {
    id: "surface",
    columns: 5,
    rows: 5,
    digs: 8,
    zones: 3,
    toneWeight: { soil: 6, teal: 3, gold: 2, deep: 1 },
    rewards: [
      { kind: "empty", weight: { soil: 34, teal: 26, gold: 20, deep: 18 }, min: 0, max: 0 },
      { kind: "gold", weight: { soil: 30, teal: 24, gold: 18, deep: 14 }, min: 400, max: 1_200 },
      { kind: "rawStone", weight: { soil: 22, teal: 30, gold: 26, deep: 22 }, min: 6, max: 18 },
      { kind: "fossil", weight: { soil: 10, teal: 14, gold: 16, deep: 16 }, min: 20, max: 60 },
      { kind: "rune", weight: { soil: 3, teal: 4, gold: 8, deep: 10 }, min: 1, max: 1 },
      { kind: "researchItem", weight: { soil: 1, teal: 2, gold: 8, deep: 12 }, min: 1, max: 1 },
      { kind: "amber", weight: { soil: 0, teal: 0, gold: 3, deep: 5 }, min: 1, max: 2 },
      // 다이아는 이 콘텐츠의 잭팟이라 흙빛에서도 아주 드물게 나온다 — 심층에만 두면
      // 색이 곧 답이 되어 고르는 일이 사라진다.
      { kind: "gems", weight: { soil: 0.2, teal: 0.4, gold: 1, deep: 3 }, min: 5, max: 20 },
    ],
  },
  // 유적 지도 확장용 판도 같은 보상 계약을 쓴다. 가중치만 달라 미리보기 별점과 실제 추첨이 함께 움직인다.
  {
    id: "archive",
    columns: 6, rows: 5, digs: 9, zones: 4,
    toneWeight: { soil: 4, teal: 4, gold: 3, deep: 2 },
    rewards: [
      { kind: "empty", weight: { soil: 30, teal: 23, gold: 17, deep: 14 }, min: 0, max: 0 },
      { kind: "gold", weight: { soil: 25, teal: 22, gold: 18, deep: 14 }, min: 600, max: 1_500 },
      { kind: "rawStone", weight: { soil: 25, teal: 32, gold: 30, deep: 26 }, min: 8, max: 22 },
      { kind: "fossil", weight: { soil: 10, teal: 12, gold: 14, deep: 14 }, min: 25, max: 70 },
      { kind: "rune", weight: { soil: 5, teal: 6, gold: 10, deep: 13 }, min: 1, max: 1 },
      { kind: "researchItem", weight: { soil: 2, teal: 3, gold: 8, deep: 12 }, min: 1, max: 1 },
      { kind: "amber", weight: { soil: 0, teal: 1, gold: 4, deep: 6 }, min: 1, max: 2 },
      { kind: "gems", weight: { soil: 0.3, teal: 0.6, gold: 1.4, deep: 3.5 }, min: 5, max: 20 },
    ],
  },
  /**
   * 물이 든 수로층.
   *
   * 지층이 셋뿐이던 때는 유적이 늘어도 판이 셋 중 하나라, 다른 이름의 유적 넷이 **같은 판**을
   * 열었다. 판은 좁고 깊게(5×6) 두어 같은 굴착 횟수로도 열지 못한 칸이 더 많이 남고, 물에
   * 씻긴 자리라 원석과 룬이 흙보다 자주 드러난다.
   */
  {
    id: "canal",
    columns: 5, rows: 6, digs: 8, zones: 4,
    toneWeight: { soil: 5, teal: 5, gold: 2, deep: 2 },
    rewards: [
      { kind: "empty", weight: { soil: 32, teal: 24, gold: 18, deep: 16 }, min: 0, max: 0 },
      { kind: "gold", weight: { soil: 26, teal: 22, gold: 18, deep: 14 }, min: 500, max: 1_300 },
      { kind: "rawStone", weight: { soil: 24, teal: 32, gold: 28, deep: 24 }, min: 7, max: 20 },
      { kind: "fossil", weight: { soil: 10, teal: 13, gold: 15, deep: 15 }, min: 22, max: 64 },
      { kind: "rune", weight: { soil: 4, teal: 5, gold: 9, deep: 12 }, min: 1, max: 1 },
      { kind: "researchItem", weight: { soil: 1.5, teal: 2.5, gold: 8, deep: 12 }, min: 1, max: 1 },
      { kind: "amber", weight: { soil: 0, teal: 0.5, gold: 3.5, deep: 5.5 }, min: 1, max: 2 },
      { kind: "gems", weight: { soil: 0.25, teal: 0.5, gold: 1.2, deep: 3.2 }, min: 5, max: 20 },
    ],
  },
  /**
   * 불에 녹아붙은 용광로층.
   *
   * 기록고와 심층 사이를 메운다. 구역 다섯으로 가장 잘게 나뉘어 **색이 가장 복잡한 판**이라,
   * 같은 굴착 횟수라도 어느 구역을 고를지가 다른 지층보다 더 많이 갈린다.
   */
  {
    id: "furnace",
    columns: 6, rows: 6, digs: 9, zones: 5,
    toneWeight: { soil: 3, teal: 3, gold: 5, deep: 3 },
    rewards: [
      { kind: "empty", weight: { soil: 28, teal: 22, gold: 16, deep: 13 }, min: 0, max: 0 },
      { kind: "gold", weight: { soil: 24, teal: 21, gold: 18, deep: 13 }, min: 800, max: 1_800 },
      { kind: "rawStone", weight: { soil: 26, teal: 33, gold: 32, deep: 28 }, min: 9, max: 24 },
      { kind: "fossil", weight: { soil: 11, teal: 12, gold: 14, deep: 14 }, min: 28, max: 74 },
      { kind: "rune", weight: { soil: 6, teal: 8, gold: 11, deep: 15 }, min: 1, max: 1 },
      { kind: "researchItem", weight: { soil: 2.5, teal: 4, gold: 8.5, deep: 12.5 }, min: 1, max: 1 },
      { kind: "amber", weight: { soil: 0.5, teal: 1.5, gold: 4.5, deep: 6.5 }, min: 1, max: 2 },
      { kind: "gems", weight: { soil: 0.4, teal: 0.8, gold: 1.7, deep: 3.8 }, min: 6, max: 22 },
    ],
  },
  {
    id: "abyss",
    columns: 6, rows: 6, digs: 10, zones: 4,
    toneWeight: { soil: 2, teal: 3, gold: 4, deep: 5 },
    rewards: [
      { kind: "empty", weight: { soil: 25, teal: 20, gold: 15, deep: 12 }, min: 0, max: 0 },
      { kind: "gold", weight: { soil: 22, teal: 20, gold: 16, deep: 12 }, min: 900, max: 2_000 },
      { kind: "rawStone", weight: { soil: 28, teal: 34, gold: 34, deep: 30 }, min: 10, max: 26 },
      { kind: "fossil", weight: { soil: 12, teal: 13, gold: 14, deep: 14 }, min: 30, max: 80 },
      { kind: "rune", weight: { soil: 7, teal: 9, gold: 13, deep: 17 }, min: 1, max: 1 },
      { kind: "researchItem", weight: { soil: 3, teal: 5, gold: 9, deep: 13 }, min: 1, max: 1 },
      { kind: "amber", weight: { soil: 1, teal: 2, gold: 5, deep: 7 }, min: 1, max: 2 },
      { kind: "gems", weight: { soil: 0.5, teal: 1, gold: 2, deep: 4 }, min: 8, max: 24 },
    ],
  },
];

/** 외부 입력 ID는 반드시 정적 카탈로그를 통과한다. */
export function findStrataLayer(id: string): StrataLayerDefinition | undefined {
  return STRATA_LAYERS.find((layer) => layer.id === id);
}

/** 지금 열려 있는 유일한 지층이다. 지층이 늘면 해금 규칙과 함께 이 함수를 고친다. */
export const DEFAULT_STRATA_LAYER_ID = STRATA_LAYERS[0].id;

/**
 * 탐사 횟수.
 *
 * 스테미나를 나눠 쓰지 않는다 — 전투와 자원을 다투면 「전투를 포기하고 팔지」가 되어 두
 * 콘텐츠가 서로를 갉는다. 시간이 지나면 차오르고, 상한이 있어 며칠 치가 쌓이지는 않는다.
 */
export const STRATA_CHARGE = {
  max: 5,
  /** 한 번이 차는 데 걸리는 시간(ms). 세 시간마다 하나다. */
  intervalMs: 3 * 60 * 60 * 1000,
} as const;

/**
 * 한 번 파고 난 유적이 다시 열릴 때까지의 시간(ms).
 *
 * **다섯 번을 한 자리에 쏟지 못하게 하는 손잡이다.** 횟수만 있고 자리에 제한이 없던 때는
 * 가장 깊은 유적 하나를 다섯 번 연달아 파는 것이 언제나 최선이라, 지도가 아무리 넓어져도
 * 실제로 누르는 노드는 하나뿐이었다. 한 자리를 판 뒤 여섯 시간이 잠기면 그 다섯 번은
 * **서로 다른 다섯 자리**로 흩어진다.
 *
 * 충전 간격(3시간)의 두 배다 — 한 바퀴 도는 동안 처음 판 자리가 다시 열린다.
 */
export const STRATA_SITE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * 겉장 원화의 장수.
 *
 * 한 번 탐사할 때마다 이 중 한 장이 뽑혀 판을 덮고, 칸을 팔 때마다 그 칸만 부서져 아래층
 * (`strata_base`)과 그 위의 보상이 드러난다. 원화를 더 그리면 이 수만 올리고 같은 이름 규칙으로
 * 구우면 된다(`prepare_backgrounds.py`).
 */
export const STRATA_ART_COUNT = 4;
