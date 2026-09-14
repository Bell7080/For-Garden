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
